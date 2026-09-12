/**
 * SwasthyaSetu — Real-Time Exotel WebSocket Voice Streaming Gateway (Phase 11)
 * Bidirectional audio streaming between Exotel Stream Applet, Sarvam AI, and VoiceGatewayService
 */

import { WebSocket } from "ws";
import { FastifyRequest } from "fastify";
import {
  VoiceSession,
  ExotelStreamInboundMessage,
  ExotelStreamOutboundMediaMessage,
  ExotelStreamOutboundMarkMessage,
  ExotelStreamOutboundClearMessage,
  ExotelStreamMediaFormat,
  SupportedVoiceLanguage,
  toVoiceLanguage,
} from "../../../../shared/types/voice.js";
import { ExotelStreamInboundMessageSchema } from "../../../../shared/schemas/voice.schema.js";
import { VoiceGatewayService } from "./voice-gateway.service.js";
import { VoiceSessionRepository } from "../../repositories/voice-session.repository.js";
import { SarvamService } from "./sarvam.service.js";
import { VoiceResponseFormatter } from "./voice-response-formatter.js";
import {
  mulawToLinear16,
  linear16ToMulaw,
  mulawToWav,
  pcmToWav,
  extractPcmFromWav,
  calculatePcmRms,
  chunkAudioBuffer,
} from "./audio-codec.js";
import { env } from "../../config/env.js";

// VAD & Buffering Constants
const SILENCE_ENERGY_THRESHOLD = 400; // RMS threshold for voice activity on 16-bit PCM (elevated to ignore telephony line hiss)
const SILENCE_CHUNKS_THRESHOLD = 45; // ~900ms of consecutive silence after speech (20ms frames)
const MIN_SPEECH_CHUNKS = 12; // Minimum ~240ms of accumulated speech before triggering STT
const MAX_TURN_CHUNKS = 350; // Maximum ~7 seconds of accumulated audio per speech turn
const NO_SPEECH_TIMEOUT_MS = 7000; // 7 seconds wait time for caller to start speaking before reprompting
export const FRAME_CHUNK_SIZE_MULAW = 160; // 20ms of 8kHz 8-bit μ-law audio
export const FRAME_CHUNK_SIZE_PCM = 320; // 20ms of 8kHz 16-bit linear PCM audio

export interface StreamSessionContext {
  streamSid: string | null;
  callSid: string | null;
  sessionId: string | null;
  session: VoiceSession | null;
  mediaFormat: ExotelStreamMediaFormat;
  language: SupportedVoiceLanguage;
  streamUrlLanguage?: SupportedVoiceLanguage | null;
  languageSource?: string;
  turnCount: number;
  maxTurns: number;
  startTime: number;
  durationTimer: NodeJS.Timeout | null;
  audioBufferChunks: Buffer[];
  turnSilenceChunks: number;
  turnTotalChunks: number;
  isProcessingTurn: boolean;
  isPlayingGreeting: boolean;
  isPlayingOutbound?: boolean;
  currentMarkName?: string | null;
  playbackFallbackTimer?: NodeJS.Timeout | null;
  noSpeechTimer?: NodeJS.Timeout | null;
  timeoutCount?: number;
  consecutiveFallbacks?: number;
  isWaitingForCaller?: boolean;
  initialGreetingSent: boolean;
  isStopped: boolean;
}

export class ExotelStreamGatewayService {
  private activeStreams: Map<string, StreamSessionContext> = new Map();

  constructor(
    private gatewayService: VoiceGatewayService,
    private sessionRepository: VoiceSessionRepository,
    private sarvamService: SarvamService
  ) {}

  /**
   * Main WebSocket connection handler mounted on Fastify GET /api/v1/voice/stream
   */
  public handleConnection(socket: WebSocket, req: FastifyRequest): void {
    const remoteAddress = req.ip || req.socket?.remoteAddress || "unknown";
    const hostHeader = req.headers?.host || "unknown";

    // Safely parse URL, searchParams, query and params to extract requested stream language (e.g. ?language=kn-IN)
    let streamUrlLanguage: SupportedVoiceLanguage | null = null;
    try {
      if (req.params && typeof req.params === "object") {
        const pLang = (req.params as any).language || (req.params as any).lang;
        if (pLang) streamUrlLanguage = toVoiceLanguage(pLang);
      }
      if (!streamUrlLanguage && req.query && typeof req.query === "object") {
        const qLang = (req.query as any).language || (req.query as any).lang;
        if (qLang) streamUrlLanguage = toVoiceLanguage(qLang);
      }
      if (!streamUrlLanguage && typeof req.url === "string") {
        const parsedUrl = new URL(req.url, "http://localhost");
        const urlLang = parsedUrl.searchParams.get("language") || parsedUrl.searchParams.get("lang");
        if (urlLang) {
          streamUrlLanguage = toVoiceLanguage(urlLang);
        } else {
          // Check if path ends in a language code (e.g. /stream/kn-IN)
          const segments = parsedUrl.pathname.split("/").filter(Boolean);
          const last = segments[segments.length - 1];
          if (last && last !== "stream") {
            streamUrlLanguage = toVoiceLanguage(last);
          }
        }
      }
    } catch {
      // Safe non-blocking parse
    }

    const defaultLang = streamUrlLanguage || toVoiceLanguage(env.VOICE_LANGUAGE || "en-IN");
    const languageSource = streamUrlLanguage ? "STREAM_URL_QUERY" : "ENVIRONMENT_DEFAULT";

    console.log("🔗 [ExotelStreamGateway] WebSocket Client Connection Established", {
      remoteAddress,
      host: hostHeader,
      url: req.url,
      streamUrlLanguage,
      resolvedLanguage: defaultLang,
      languageSource,
      timestamp: new Date().toISOString(),
    });

    const context: StreamSessionContext = {
      streamSid: null,
      callSid: null,
      sessionId: null,
      session: null,
      mediaFormat: {
        encoding: "audio/x-mulaw",
        sampleRate: 8000,
        channels: 1,
      },
      language: defaultLang,
      streamUrlLanguage,
      languageSource,
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      startTime: Date.now(),
      durationTimer: null,
      audioBufferChunks: [],
      turnSilenceChunks: 0,
      turnTotalChunks: 0,
      isProcessingTurn: false,
      isPlayingGreeting: false,
      isPlayingOutbound: false,
      currentMarkName: null,
      playbackFallbackTimer: null,
      noSpeechTimer: null,
      timeoutCount: 0,
      consecutiveFallbacks: 0,
      isWaitingForCaller: false,
      initialGreetingSent: false,
      isStopped: false,
    };

    const maxDurationSec = env.VOICE_MAX_CALL_DURATION_SEC || 300;
    context.durationTimer = setTimeout(() => {
      this.handleCallDurationLimit(socket, context);
    }, maxDurationSec * 1000);

    socket.on("message", async (rawMessage: Buffer | string) => {
      try {
        const messageStr = typeof rawMessage === "string" ? rawMessage : rawMessage.toString("utf-8");
        let parsedJson: any;
        try {
          parsedJson = JSON.parse(messageStr);
        } catch {
          // Ignore non-JSON frames
          return;
        }

        if (!parsedJson || typeof parsedJson !== "object") {
          return;
        }

        const rawEventName = String(parsedJson.event || parsedJson.Event || "").toLowerCase().trim();
        if (!rawEventName) {
          return;
        }

        // Parse with Zod schema for safety, fallback to parsedJson for lenient fields
        const parseResult = ExotelStreamInboundMessageSchema.safeParse(parsedJson);
        const eventData = parseResult.success ? (parseResult.data as any) : parsedJson;

        await this.handleStreamEvent(socket, context, eventData);
      } catch (err: any) {
        console.error("⚠️ [ExotelStreamGateway] Error handling stream message:", err.message);
      }
    });

    socket.on("close", (code, reason) => {
      console.log("🔌 [ExotelStreamGateway] WebSocket Client Disconnected", {
        streamSid: context.streamSid,
        callSid: context.callSid,
        sessionId: context.sessionId,
        resolvedLanguage: context.language,
        languageSource: context.languageSource,
        code,
        reason: reason?.toString("utf-8") || "normal",
      });
      this.cleanupStreamContext(context);
    });

    socket.on("error", (err) => {
      console.error("⚠️ [ExotelStreamGateway] WebSocket client error:", {
        streamSid: context.streamSid,
        callSid: context.callSid,
        sessionId: context.sessionId,
        resolvedLanguage: context.language,
        error: err.message,
      });
      this.cleanupStreamContext(context);
    });
  }

  /**
   * Dispatch parsed Exotel stream lifecycle events
   */
  public async handleStreamEvent(
    socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): Promise<void> {
    if (context.isStopped) return;

    const eventType = String(event.event || event.Event || "").toLowerCase().trim();

    switch (eventType) {
      case "connected":
        console.log("🤝 [ExotelStreamGateway] Exotel 'connected' handshake acknowledged", {
          protocol: event.protocol || "Call",
          version: event.version || "1.0.0",
        });
        break;

      case "start":
        await this.handleStartEvent(socket, context, event);
        break;

      case "media":
        await this.handleMediaEvent(socket, context, event);
        break;

      case "stop":
        await this.handleStopEvent(socket, context);
        break;

      case "dtmf":
        await this.handleDtmfEvent(socket, context, event);
        break;

      case "mark":
        this.handleMarkEvent(socket, context, event);
        break;

      default:
        // Safely ignore unknown events
        break;
    }
  }

  /**
   * Handles Exotel 'start' event: associates CallSid, StreamSid, and VoiceSession
   */
  private async handleStartEvent(
    socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): Promise<void> {
    const startData = event.start || {};
    const streamSid =
      startData.streamSid ||
      startData.stream_sid ||
      event.streamSid ||
      event.stream_sid ||
      `stream_${Date.now()}`;
    const callSid =
      startData.callSid ||
      startData.call_sid ||
      event.callSid ||
      event.call_sid ||
      `call_${Date.now()}`;

    context.streamSid = streamSid;
    context.callSid = callSid;

    const format = startData.mediaFormat || startData.media_format || event.mediaFormat || {};
    context.mediaFormat = {
      encoding: format.encoding || "audio/x-mulaw",
      sampleRate: format.sampleRate || format.sample_rate || 8000,
      channels: format.channels || 1,
    };

    const customParams =
      startData.customParameters ||
      startData.custom_parameters ||
      event.customParameters ||
      {};

    const metadataLang =
      customParams?.language ||
      startData?.language ||
      event?.language ||
      null;

    const callerPhone =
      customParams?.callerPhone ||
      customParams?.From ||
      startData?.from ||
      event?.from ||
      "";

    // Authoritative Precedence (Sections 7 & 9 of docs/backend_exotel_fix.md):
    // 1. Existing explicit VoiceSession.language from outbound website call request (must be preserved)
    // 2. Explicit language supplied by the current stream/query URL (?language=kn-IN from IVR selection)
    // 3. Pre-existing session with explicit valid language (if no URL override)
    // 4. Exotel start-event metadata (customParameters.language)
    // 5. Inbound caller profile / recent session lookup or default en-IN
    let session = callSid ? await this.sessionRepository.getSessionByCallSid(callSid) : null;
    let resolvedLanguage: SupportedVoiceLanguage = "en-IN";
    let languageSource = "SAFE_FALLBACK";

    if (session && session.direction === "OUTBOUND" && session.language) {
      resolvedLanguage = toVoiceLanguage(session.language);
      languageSource = "EXISTING_OUTBOUND_SESSION";
    } else if (context.streamUrlLanguage) {
      resolvedLanguage = context.streamUrlLanguage;
      languageSource = "STREAM_URL_QUERY";
      if (session && session.language !== resolvedLanguage) {
        session.language = resolvedLanguage;
        await this.sessionRepository.updateSession(session.id, { language: resolvedLanguage });
      }
    } else if (session && session.language && ["en-IN", "kn-IN", "hi-IN"].includes(session.language)) {
      resolvedLanguage = toVoiceLanguage(session.language);
      languageSource = "EXISTING_SESSION";
    } else if (metadataLang) {
      resolvedLanguage = toVoiceLanguage(metadataLang);
      languageSource = "EXOTEL_START_METADATA";
    } else {
      resolvedLanguage = await this.gatewayService.resolveInboundVoiceLanguage(callerPhone);
      languageSource = "CALLER_RESOLUTION_OR_DEFAULT";
    }

    context.language = resolvedLanguage;
    context.languageSource = languageSource;

    if (streamSid) {
      this.activeStreams.set(streamSid, context);
    }

    // Associate or create VoiceSession
    if (callSid) {
      if (!session) {
        // Inbound call direct into stream applet
        const callerPhoneNormalized = callerPhone || "+919876543210";
        session = await this.gatewayService.createInboundSession(callerPhoneNormalized, callSid, resolvedLanguage);
      }
      context.session = session;
      context.sessionId = session.id;
      context.language = toVoiceLanguage(session.language);
    }

    console.log("▶️ [ExotelStreamGateway] Voice session initialized", {
      streamSid: context.streamSid,
      callSid: context.callSid,
      sessionId: context.sessionId,
      language: context.language,
      source: context.languageSource,
      encoding: context.mediaFormat.encoding,
      sampleRate: context.mediaFormat.sampleRate,
    });

    // Send localized initial Voicebot spoken greeting (Sections 1, 3, 8 & 14)
    if (!context.initialGreetingSent) {
      await this.sendInitialGreeting(socket, context);
    }
  }

  /**
   * Handles Exotel 'dtmf' event: processes caller keypresses for IVR language selection
   * 1 -> en-IN
   * 2 -> kn-IN
   * 3 -> hi-IN
   */
  public async handleDtmfEvent(
    _socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): Promise<void> {
    const rawDigit = String(event.dtmf?.digit || event.digit || event.dtmf?.Digit || "").trim();
    let newLang: SupportedVoiceLanguage | null = null;
    if (rawDigit === "1") newLang = "en-IN";
    else if (rawDigit === "2") newLang = "kn-IN";
    else if (rawDigit === "3") newLang = "hi-IN";

    if (newLang) {
      context.language = newLang;
      if (context.session) {
        context.session.language = newLang;
        await this.sessionRepository.updateSession(context.session.id, { language: newLang });
      }
      console.log(`🔤 [ExotelStreamGateway] Language switched via DTMF '${rawDigit}' to ${newLang}`);
    }
  }

  /**
   * Handles Exotel 'media' event: accumulates chunks & performs turn detection
   */
  /**
   * Handles Exotel 'mark' event: physical playback of outbound audio frames has completed on caller device
   */
  public handleMarkEvent(
    socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): void {
    if (context.isStopped) return;
    const markName = event.mark?.name || event.name || event.markName;
    console.log("📍 [ExotelStreamGateway] Playback mark event received from Exotel", {
      streamSid: context.streamSid,
      markName,
      expectedMark: context.currentMarkName,
    });

    // If mark name doesn't match current active mark, ignore stale marks
    if (context.currentMarkName && markName && markName !== context.currentMarkName) {
      return;
    }

    this.onPlaybackFinished(socket, context, `mark:${markName || "acknowledged"}`);
  }

  /**
   * Called when outbound audio playback finishes (via Exotel mark event or fallback duration timer).
   * Unmutes microphone audio, flushes echo buffers, logs waiting state, and starts caller silence timer.
   */
  public onPlaybackFinished(
    socket: WebSocket,
    context: StreamSessionContext,
    reason: string
  ): void {
    if (context.isStopped) return;
    if (!context.isPlayingOutbound && !context.isPlayingGreeting) {
      return;
    }

    context.isPlayingOutbound = false;
    context.isPlayingGreeting = false;
    context.currentMarkName = null;

    if (context.playbackFallbackTimer) {
      clearTimeout(context.playbackFallbackTimer);
      context.playbackFallbackTimer = null;
    }

    // Flush any acoustic echo/bleed-through accumulated during outbound playback
    context.audioBufferChunks = [];
    context.turnSilenceChunks = 0;
    context.turnTotalChunks = 0;
    context.isWaitingForCaller = true;

    // Requirement 8: Logging for waiting for caller
    console.log(`⏳ [ExotelStreamGateway] Assistant playback complete (${reason}). WAITING for caller to speak...`, {
      streamSid: context.streamSid,
      turnCount: context.turnCount,
      language: context.language,
    });

    // Start caller response timeout timer
    this.startNoSpeechTimer(socket, context);
  }

  /**
   * Starts a timer waiting for the caller to speak.
   */
  public startNoSpeechTimer(socket: WebSocket, context: StreamSessionContext): void {
    if (context.isStopped || context.isPlayingOutbound || context.isProcessingTurn) {
      return;
    }

    if (context.noSpeechTimer) {
      clearTimeout(context.noSpeechTimer);
      context.noSpeechTimer = null;
    }

    const timer = setTimeout(async () => {
      await this.handleNoSpeechTimeout(socket, context);
    }, NO_SPEECH_TIMEOUT_MS);

    if (timer.unref) timer.unref();
    context.noSpeechTimer = timer;
  }

  /**
   * Handles silence timeout when caller does not speak.
   * Requirement 3:
   * - On first timeout: reprompt ONCE with a short message.
   * - On second timeout: end call with goodbye, do not enter infinite retry loop.
   */
  public async handleNoSpeechTimeout(
    socket: WebSocket,
    context: StreamSessionContext
  ): Promise<void> {
    if (context.isStopped || context.isPlayingOutbound || context.isProcessingTurn) {
      return;
    }

    const currentTimeout = context.timeoutCount ?? 0;

    // Requirement 8: Logging for timeout/no-speech
    console.log("⏰ [ExotelStreamGateway] Timeout/no-speech detected", {
      streamSid: context.streamSid,
      timeoutCount: currentTimeout,
      turnCount: context.turnCount,
      language: context.language,
    });

    if (currentTimeout === 0) {
      // First timeout: reprompt ONCE with short friendly message
      context.timeoutCount = 1;
      const repromptText = VoiceResponseFormatter.getTimeoutReprompt(context.language);

      // Requirement 8: Logging for prompt sent
      console.log("🗣️ [ExotelStreamGateway] Prompt sent (timeout reprompt)", {
        streamSid: context.streamSid,
        promptPreview: repromptText.slice(0, 80),
        language: context.language,
      });

      await this.synthesizeAndStreamResponse(
        socket,
        context,
        repromptText,
        `timeout_reprompt_${context.turnCount}`
      );
    } else {
      // Second timeout: do NOT enter infinite retry loop; say goodbye and terminate
      console.log("🛑 [ExotelStreamGateway] Consecutive timeout - sending goodbye and ending call", {
        streamSid: context.streamSid,
        timeoutCount: currentTimeout,
        language: context.language,
      });

      const goodbyeText = VoiceResponseFormatter.getTimeoutGoodbye(context.language);

      // Requirement 8: Logging for prompt sent
      console.log("🗣️ [ExotelStreamGateway] Prompt sent (timeout goodbye)", {
        streamSid: context.streamSid,
        promptPreview: goodbyeText.slice(0, 80),
        language: context.language,
      });

      await this.synthesizeAndStreamResponse(
        socket,
        context,
        goodbyeText,
        "timeout_goodbye"
      );

      // Gracefully terminate call after goodbye audio finishes playing
      setTimeout(() => {
        this.cleanupStreamContext(context);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "No speech received after reprompt");
        }
      }, 2500);
    }
  }

  /**
   * Handles Exotel 'media' event: accumulates chunks & performs turn detection
   */
  private async handleMediaEvent(
    socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): Promise<void> {
    // If assistant is currently speaking or processing, drop incoming audio to prevent self-echo feedback loop
    if (
      context.isStopped ||
      context.isProcessingTurn ||
      context.isPlayingOutbound ||
      context.isPlayingGreeting
    ) {
      return;
    }

    const payload = event.media?.payload || event.payload;
    if (!payload || typeof payload !== "string") {
      return;
    }

    let chunkBuffer: Buffer;
    try {
      chunkBuffer = Buffer.from(payload, "base64");
    } catch {
      return;
    }

    if (chunkBuffer.length === 0) return;

    // Decode to 16-bit linear PCM for energy calculation
    const pcmBuffer = context.mediaFormat.encoding.includes("mulaw")
      ? mulawToLinear16(chunkBuffer)
      : chunkBuffer;

    const energy = calculatePcmRms(pcmBuffer);

    if (energy > SILENCE_ENERGY_THRESHOLD) {
      // Caller has started speaking! Immediately cancel the no-speech silence timer
      if (context.noSpeechTimer) {
        clearTimeout(context.noSpeechTimer);
        context.noSpeechTimer = null;
      }

      // Requirement 8: Logging for caller audio received (logged on first speech frame of turn)
      if (context.audioBufferChunks.length === 0) {
        console.log("🎙️ [ExotelStreamGateway] Caller audio received", {
          streamSid: context.streamSid,
          turnCount: context.turnCount,
          energy: Math.round(energy),
        });
      }

      context.isWaitingForCaller = false;
      context.audioBufferChunks.push(chunkBuffer);
      context.turnSilenceChunks = 0;
      context.turnTotalChunks += 1;
    } else {
      // Frame is silent
      if (context.audioBufferChunks.length > 0) {
        context.audioBufferChunks.push(chunkBuffer);
        context.turnSilenceChunks += 1;
        context.turnTotalChunks += 1;

        // Turn Boundary 1: Silence detected after speech
        if (
          context.turnSilenceChunks >= SILENCE_CHUNKS_THRESHOLD &&
          context.audioBufferChunks.length >= MIN_SPEECH_CHUNKS
        ) {
          await this.processSpeechTurn(socket, context);
          return;
        }
      }
    }

    // Turn Boundary 2: Maximum duration reached for current turn
    if (
      context.turnTotalChunks >= MAX_TURN_CHUNKS &&
      context.audioBufferChunks.length >= MIN_SPEECH_CHUNKS
    ) {
      await this.processSpeechTurn(socket, context);
    }
  }

  /**
   * Executes the full speech-to-intent-to-speech loop for an accumulated speech turn
   */
  public async processSpeechTurn(socket: WebSocket, context: StreamSessionContext): Promise<void> {
    if (context.isProcessingTurn || context.audioBufferChunks.length === 0 || context.isStopped) {
      return;
    }

    context.isProcessingTurn = true;
    if (context.noSpeechTimer) {
      clearTimeout(context.noSpeechTimer);
      context.noSpeechTimer = null;
    }

    const audioChunks = [...context.audioBufferChunks];
    context.audioBufferChunks = [];
    context.turnSilenceChunks = 0;
    context.turnTotalChunks = 0;

    try {
      // Requirement 7: Verify Sarvam STT is not being called with an empty audio buffer
      const fullTelephonyBuffer = Buffer.concat(audioChunks);
      if (fullTelephonyBuffer.length === 0) {
        console.log("🔇 [ExotelStreamGateway] Empty audio buffer, skipping STT and resuming waiting for caller");
        context.isProcessingTurn = false;
        this.startNoSpeechTimer(socket, context);
        return;
      }

      // Check max turn cost control
      context.turnCount = (context.turnCount || 0) + 1;
      const maxTurns = context.maxTurns || 10;
      if (context.turnCount > maxTurns) {
        console.log("🛑 [ExotelStreamGateway] Max turns reached, sending farewell", {
          streamSid: context.streamSid,
          turnCount: context.turnCount,
        });
        await this.handleMaxTurnsReached(socket, context);
        return;
      }

      // Synthesize WAV from accumulated telephony chunks
      const sampleRate = context.mediaFormat.sampleRate || 8000;
      const wavBuffer = context.mediaFormat.encoding.includes("mulaw")
        ? mulawToWav(fullTelephonyBuffer, sampleRate)
        : pcmToWav(fullTelephonyBuffer, sampleRate);

      const wavBase64 = wavBuffer.toString("base64");

      console.log("🗣️ [ExotelStreamGateway] Sarvam STT", {
        streamSid: context.streamSid,
        turnCount: context.turnCount,
        audioLengthBytes: fullTelephonyBuffer.length,
        language: context.language,
      });

      // Speech-to-Text via Sarvam saaras:v3
      const sttResult = await this.sarvamService.speechToText(wavBase64, context.language, "wav");
      const transcript = sttResult?.transcript?.trim() || "";

      // Requirement 8: Logging for STT result
      console.log("📝 [ExotelStreamGateway] STT result", {
        streamSid: context.streamSid,
        hasTranscript: Boolean(transcript),
        transcriptLength: transcript.length,
        language: context.language,
      });

      // Requirement 2 & 4: If STT returned empty or whitespace, do NOT treat as UNKNOWN or say "Sorry, I didn't understand"
      if (!transcript || transcript.length === 0) {
        console.log("🔇 [ExotelStreamGateway] STT returned empty transcript (background noise), resuming listening");
        context.isProcessingTurn = false;
        this.startNoSpeechTimer(socket, context);
        return;
      }

      console.log("📝 [ExotelStreamGateway] Sarvam STT Transcript:", {
        streamSid: context.streamSid,
        transcript,
      });

      // Caller spoke actual words -> reset silence timeout count
      context.timeoutCount = 0;

      // Safe session recovery if needed
      if (!context.sessionId || context.sessionId === "unbound") {
        try {
          let recSession = context.callSid
            ? await this.sessionRepository.getSessionByCallSid(context.callSid)
            : null;
          if (!recSession) {
            recSession = await this.gatewayService.createInboundSession(
              "+919876543210",
              context.callSid || `exo_rec_${Date.now()}`,
              context.language
            );
          }
          context.session = recSession;
          context.sessionId = recSession.id;
        } catch (recErr: any) {
          console.warn("⚠️ [ExotelStreamGateway] Safe session recovery warning:", recErr.message);
        }
      }

      const sessionId = context.sessionId || "unbound";
      const turnResponse = await this.gatewayService.processTurn(sessionId, {
        transcript,
        languageCode: context.language,
      });

      // Requirement 8: Logging for detected intent
      console.log("🧠 [ExotelStreamGateway] Detected intent", {
        streamSid: context.streamSid,
        intent: turnResponse?.detectedIntent,
        turnCount: context.turnCount,
      });

      // Prevent infinite fallback loop on repeated UNKNOWN
      if (turnResponse?.detectedIntent === "UNKNOWN") {
        context.consecutiveFallbacks = (context.consecutiveFallbacks || 0) + 1;
        console.log(`⚠️ [ExotelStreamGateway] Consecutive fallback count: ${context.consecutiveFallbacks}`);
      } else {
        context.consecutiveFallbacks = 0;
      }

      let responseText =
        turnResponse?.textResponse ||
        VoiceResponseFormatter.getDefaultFallbackPrompt(context.language);

      // If caller has encountered 3 consecutive UNKNOWNs, avoid infinite fallback loop and conclude gracefully
      if ((context.consecutiveFallbacks || 0) >= 3) {
        responseText = VoiceResponseFormatter.getEndCall(context.language);
        if (turnResponse) {
          turnResponse.shouldEndCall = true;
        }
      }

      console.log("🤖 [ExotelStreamGateway] Healthcare Assistant Response:", {
        streamSid: context.streamSid,
        intent: turnResponse?.detectedIntent,
        replyPreview: responseText.slice(0, 100) + (responseText.length > 100 ? "..." : ""),
      });

      // Requirement 8: Logging for prompt sent / response sent
      console.log("🗣️ [ExotelStreamGateway] Prompt sent (turn response)", {
        streamSid: context.streamSid,
        replyPreview: responseText.slice(0, 80),
        intent: turnResponse?.detectedIntent,
        turnCount: context.turnCount,
      });

      // Stream audio frames back to Exotel WebSocket
      await this.synthesizeAndStreamResponse(
        socket,
        context,
        responseText,
        `turn_${context.turnCount}`
      );

      // Check if intent dictated end-of-call
      if (turnResponse?.shouldEndCall) {
        setTimeout(() => {
          this.cleanupStreamContext(context);
          if (socket.readyState === WebSocket.OPEN) {
            socket.close(1000, "Call Ended by Assistant");
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error("⚠️ [ExotelStreamGateway] Error during speech turn loop:", err.message);
    } finally {
      context.isProcessingTurn = false;
    }
  }

  /**
   * Generates and streams the initial conversational Voicebot greeting
   * in the authoritative session language (en-IN, kn-IN, hi-IN) via Sarvam TTS.
   * Executes exactly once per Voicebot session upon start.
   */
  public async sendInitialGreeting(
    socket: WebSocket,
    context: StreamSessionContext
  ): Promise<void> {
    if (context.isStopped || !context.streamSid || context.initialGreetingSent) {
      return;
    }

    context.initialGreetingSent = true;
    context.isPlayingGreeting = true;

    try {
      const greetingText = VoiceResponseFormatter.getGreeting(context.language);

      // Requirement 8: Logging for prompt sent
      console.log("🗣️ [ExotelStreamGateway] Initial Voicebot greeting", {
        streamSid: context.streamSid,
        sessionId: context.sessionId,
        language: context.language,
        greetingPreview: greetingText.slice(0, 80) + (greetingText.length > 80 ? "..." : ""),
      });

      console.log("🗣️ [ExotelStreamGateway] Prompt sent (initial greeting)", {
        streamSid: context.streamSid,
        language: context.language,
      });

      await this.synthesizeAndStreamResponse(
        socket,
        context,
        greetingText,
        "initial_greeting"
      );
    } catch (err: any) {
      console.error("⚠️ [ExotelStreamGateway] Error generating initial Voicebot greeting:", err.message);
      this.onPlaybackFinished(socket, context, "greeting_error_fallback");
    }
  }

  /**
   * Synthesizes text to speech via Sarvam bulbul:v3 and streams 20ms frames to Exotel over WebSocket.
   * Sets isPlayingOutbound to suppress incoming echo during playback, dispatches mark event,
   * and arms a fallback duration timer.
   */
  public async synthesizeAndStreamResponse(
    socket: WebSocket,
    context: StreamSessionContext,
    text: string,
    markName: string
  ): Promise<void> {
    if (context.isStopped || !context.streamSid || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    context.isPlayingOutbound = true;
    context.currentMarkName = markName;

    // Clear any active timers while new response is synthesized and queued
    if (context.playbackFallbackTimer) {
      clearTimeout(context.playbackFallbackTimer);
      context.playbackFallbackTimer = null;
    }
    if (context.noSpeechTimer) {
      clearTimeout(context.noSpeechTimer);
      context.noSpeechTimer = null;
    }

    try {
      console.log("🔊 [ExotelStreamGateway] Sarvam TTS", {
        streamSid: context.streamSid,
        language: context.language,
        markName,
      });

      const ttsResult = await this.sarvamService.textToSpeech(text, context.language);
      const ttsAudioBase64 = ttsResult?.audios?.[0];

      if (!ttsAudioBase64 || socket.readyState !== WebSocket.OPEN) {
        // If TTS produced no audio frames (mock or unconfigured), immediately finish playback
        this.onPlaybackFinished(socket, context, "no_audio_frames");
        return;
      }

      const rawTtsBuffer = Buffer.from(ttsAudioBase64, "base64");
      const { pcmBuffer } = extractPcmFromWav(rawTtsBuffer);

      const outboundAudio = context.mediaFormat.encoding.includes("mulaw")
        ? linear16ToMulaw(pcmBuffer)
        : pcmBuffer;

      const chunkSize = context.mediaFormat.encoding.includes("mulaw")
        ? FRAME_CHUNK_SIZE_MULAW
        : FRAME_CHUNK_SIZE_PCM;

      const outboundFrames = chunkAudioBuffer(outboundAudio, chunkSize);

      // Requirement 8: Logging for response sent
      console.log("🔊 [ExotelStreamGateway] Streaming audio frames to Exotel", {
        streamSid: context.streamSid,
        frameCount: outboundFrames.length,
        chunkSize,
        markName,
        language: context.language,
      });

      for (const frame of outboundFrames) {
        if (socket.readyState !== WebSocket.OPEN || context.isStopped) break;
        const mediaMessage: ExotelStreamOutboundMediaMessage = {
          event: "media",
          streamSid: context.streamSid,
          media: {
            payload: frame.toString("base64"),
          },
        };
        socket.send(JSON.stringify(mediaMessage));
      }

      // Send Mark message to signal turn playback completion
      if (socket.readyState === WebSocket.OPEN) {
        const markMessage: ExotelStreamOutboundMarkMessage = {
          event: "mark",
          streamSid: context.streamSid,
          mark: {
            name: markName,
          },
        };
        socket.send(JSON.stringify(markMessage));
      }

      // Calculate physical playback duration (20ms per audio frame)
      const playbackDurationMs = outboundFrames.length * 20;

      // Set fallback timer: for real speech audio (>100ms) wait full duration to mute echo; for tiny mock frames (<=100ms) use 15ms
      const fallbackMs = playbackDurationMs > 100 ? playbackDurationMs : 15;
      const timer = setTimeout(() => {
        this.onPlaybackFinished(socket, context, `timer_fallback_${markName}`);
      }, fallbackMs);

      if (timer.unref) timer.unref();
      context.playbackFallbackTimer = timer;
    } catch (err: any) {
      console.error("⚠️ [ExotelStreamGateway] Error during response synthesis/streaming:", err.message);
      this.onPlaybackFinished(socket, context, "stream_error_fallback");
    }
  }

  /**
   * Graceful termination when maximum turn limit is exceeded
   */
  private async handleMaxTurnsReached(socket: WebSocket, context: StreamSessionContext): Promise<void> {
    const farewell = VoiceResponseFormatter.getMaxTurnsPrompt(context.language);
    try {
      await this.synthesizeAndStreamResponse(
        socket,
        context,
        farewell,
        "max_turns_farewell"
      );
    } catch {
      // Non-blocking
    } finally {
      setTimeout(() => {
        this.cleanupStreamContext(context);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "Max turns reached");
        }
      }, 2500);
    }
  }

  /**
   * Graceful termination when call duration limit (e.g. 300s) is exceeded
   */
  private handleCallDurationLimit(socket: WebSocket, context: StreamSessionContext): void {
    if (context.isStopped) return;
    console.log("⏰ [ExotelStreamGateway] Call duration limit reached, closing stream", {
      streamSid: context.streamSid,
      callSid: context.callSid,
    });
    this.cleanupStreamContext(context);
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "Call duration limit reached");
    }
  }

  /**
   * Handle Exotel 'stop' event
   */
  private async handleStopEvent(socket: WebSocket, context: StreamSessionContext): Promise<void> {
    console.log("⏹️ [ExotelStreamGateway] Exotel 'stop' event received", {
      streamSid: context.streamSid,
      callSid: context.callSid,
    });
    this.cleanupStreamContext(context);
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "Exotel Stop");
    }
  }

  /**
   * Resource cleanup on stream completion or disconnect
   */
  public cleanupStreamContext(context: StreamSessionContext): void {
    context.isStopped = true;
    if (context.durationTimer) {
      clearTimeout(context.durationTimer);
      context.durationTimer = null;
    }
    if (context.playbackFallbackTimer) {
      clearTimeout(context.playbackFallbackTimer);
      context.playbackFallbackTimer = null;
    }
    if (context.noSpeechTimer) {
      clearTimeout(context.noSpeechTimer);
      context.noSpeechTimer = null;
    }
    context.audioBufferChunks = [];

    if (context.streamSid) {
      this.activeStreams.delete(context.streamSid);
    }

    if (context.session && context.sessionId) {
      context.session.status = "COMPLETED";
      context.session.endedAt = new Date().toISOString();
      this.sessionRepository.updateSession(context.sessionId, context.session).catch(() => {});
    }
  }

  /**
   * Query active stream by streamSid (for telemetry or testing)
   */
  public getActiveStream(streamSid: string): StreamSessionContext | undefined {
    return this.activeStreams.get(streamSid);
  }

  /**
   * Active stream count
   */
  public getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}
