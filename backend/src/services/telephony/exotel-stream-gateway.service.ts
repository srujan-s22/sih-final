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
const SILENCE_ENERGY_THRESHOLD = 300; // RMS threshold for voice activity on 16-bit PCM
const SILENCE_CHUNKS_THRESHOLD = 45; // ~900ms of consecutive silence after speech (20ms frames)
const MIN_SPEECH_CHUNKS = 12; // Minimum ~240ms of accumulated speech before triggering STT
const MAX_TURN_CHUNKS = 350; // Maximum ~7 seconds of accumulated audio per speech turn
export const FRAME_CHUNK_SIZE_MULAW = 160; // 20ms of 8kHz 8-bit μ-law audio
export const FRAME_CHUNK_SIZE_PCM = 320; // 20ms of 8kHz 16-bit linear PCM audio

export interface StreamSessionContext {
  streamSid: string | null;
  callSid: string | null;
  sessionId: string | null;
  session: VoiceSession | null;
  mediaFormat: ExotelStreamMediaFormat;
  language: string;
  turnCount: number;
  maxTurns: number;
  startTime: number;
  durationTimer: NodeJS.Timeout | null;
  audioBufferChunks: Buffer[];
  turnSilenceChunks: number;
  turnTotalChunks: number;
  isProcessingTurn: boolean;
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

    console.log("🔗 [ExotelStreamGateway] WebSocket Client Connection Established", {
      remoteAddress,
      host: hostHeader,
      url: req.url,
      timestamp: new Date().toISOString(),
    });

    const defaultLang = env.VOICE_LANGUAGE || "en-IN";
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
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      startTime: Date.now(),
      durationTimer: null,
      audioBufferChunks: [],
      turnSilenceChunks: 0,
      turnTotalChunks: 0,
      isProcessingTurn: false,
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
        code,
        reason: reason?.toString("utf-8") || "normal",
      });
      this.cleanupStreamContext(context);
    });

    socket.on("error", (err) => {
      console.error("⚠️ [ExotelStreamGateway] WebSocket client error:", err.message);
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

      case "mark":
        // Mark acknowledged
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

    // Authoritative Precedence:
    // 1. If an existing VoiceSession exists for callSid (e.g. initiated from website), KEEP session.language
    // 2. Otherwise, check Exotel start metadata (customParameters.language or startData.language)
    // 3. Fallback safely to "en-IN"
    let session = callSid ? await this.sessionRepository.getSessionByCallSid(callSid) : null;
    let resolvedLanguage: string = "en-IN";

    if (session && session.language) {
      resolvedLanguage = toVoiceLanguage(session.language);
    } else {
      const rawExotelLang =
        customParams?.language ||
        startData?.language ||
        event?.language;
      resolvedLanguage = toVoiceLanguage(rawExotelLang || env.VOICE_LANGUAGE || "en-IN");
    }

    context.language = resolvedLanguage;

    if (streamSid) {
      this.activeStreams.set(streamSid, context);
    }

    // Associate or create VoiceSession
    if (callSid) {
      if (!session) {
        // Inbound call direct into stream applet
        const callerPhone = customParams?.callerPhone || "+919876543210";
        session = await this.gatewayService.createInboundSession(callerPhone, callSid, resolvedLanguage);
      }
      context.session = session;
      context.sessionId = session.id;
      context.language = resolvedLanguage;
    }

    console.log("▶️ [ExotelStreamGateway] Exotel 'start' event bound", {
      streamSid: context.streamSid,
      callSid: context.callSid,
      sessionId: context.sessionId,
      language: context.language,
      encoding: context.mediaFormat.encoding,
      sampleRate: context.mediaFormat.sampleRate,
    });
  }

  /**
   * Handles Exotel 'media' event: accumulates chunks & performs turn detection
   */
  private async handleMediaEvent(
    socket: WebSocket,
    context: StreamSessionContext,
    event: any
  ): Promise<void> {
    if (context.isProcessingTurn || context.isStopped) {
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
      // Caller is speaking
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
    if (context.turnTotalChunks >= MAX_TURN_CHUNKS && context.audioBufferChunks.length >= MIN_SPEECH_CHUNKS) {
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
    const audioChunks = [...context.audioBufferChunks];
    context.audioBufferChunks = [];
    context.turnSilenceChunks = 0;
    context.turnTotalChunks = 0;

    try {
      // 1. Check max turn cost control
      context.turnCount += 1;
      if (context.turnCount > context.maxTurns) {
        console.log("🛑 [ExotelStreamGateway] Max turns reached, sending farewell", {
          streamSid: context.streamSid,
          turnCount: context.turnCount,
        });
        await this.handleMaxTurnsReached(socket, context);
        return;
      }

      // 2. Synthesize WAV from accumulated telephony chunks
      const fullTelephonyBuffer = Buffer.concat(audioChunks);
      const sampleRate = context.mediaFormat.sampleRate || 8000;
      const wavBuffer = context.mediaFormat.encoding.includes("mulaw")
        ? mulawToWav(fullTelephonyBuffer, sampleRate)
        : pcmToWav(fullTelephonyBuffer, sampleRate);

      const wavBase64 = wavBuffer.toString("base64");

      console.log("🗣️ [ExotelStreamGateway] Processing Speech Turn with Sarvam STT", {
        streamSid: context.streamSid,
        turnCount: context.turnCount,
        audioLengthBytes: fullTelephonyBuffer.length,
        language: context.language,
      });

      // 3. Speech-to-Text via Sarvam saaras:v3
      const sttResult = await this.sarvamService.speechToText(wavBase64, context.language, "wav");
      const transcript = sttResult?.transcript?.trim() || "";

      if (!transcript || transcript.length === 0) {
        console.log("🔇 [ExotelStreamGateway] STT returned empty transcript (background noise), resuming listening");
        context.isProcessingTurn = false;
        return;
      }

      console.log("📝 [ExotelStreamGateway] Sarvam STT Transcript:", {
        streamSid: context.streamSid,
        transcript,
      });

      // 4. Process Turn via VoiceGatewayService & deterministic VoiceActionService
      const sessionId = context.sessionId || "unbound";
      const turnResponse = await this.gatewayService.processTurn(sessionId, {
        transcript,
        languageCode: context.language,
      });

      const responseText =
        turnResponse?.textResponse ||
        "I am here to assist you with government health schemes. How can I help you?";

      console.log("🤖 [ExotelStreamGateway] Healthcare Assistant Response:", {
        streamSid: context.streamSid,
        intent: turnResponse?.detectedIntent,
        replyPreview: responseText.slice(0, 100) + (responseText.length > 100 ? "..." : ""),
      });

      // 5. Text-to-Speech Synthesis via Sarvam bulbul:v3
      const ttsResult = await this.sarvamService.textToSpeech(responseText, context.language);
      const ttsAudioBase64 = ttsResult?.audios?.[0];

      // 6. Stream audio frames back to Exotel WebSocket
      if (ttsAudioBase64 && socket.readyState === WebSocket.OPEN && context.streamSid) {
        const rawTtsBuffer = Buffer.from(ttsAudioBase64, "base64");
        const { pcmBuffer } = extractPcmFromWav(rawTtsBuffer);

        const outboundAudio = context.mediaFormat.encoding.includes("mulaw")
          ? linear16ToMulaw(pcmBuffer)
          : pcmBuffer;

        const chunkSize = context.mediaFormat.encoding.includes("mulaw")
          ? FRAME_CHUNK_SIZE_MULAW
          : FRAME_CHUNK_SIZE_PCM;

        const outboundFrames = chunkAudioBuffer(outboundAudio, chunkSize);

        console.log("🔊 [ExotelStreamGateway] Streaming audio frames to Exotel", {
          streamSid: context.streamSid,
          frameCount: outboundFrames.length,
          chunkSize,
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
              name: `turn_${context.turnCount}`,
            },
          };
          socket.send(JSON.stringify(markMessage));
        }
      }

      // 7. Check if intent dictated end-of-call
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
   * Graceful termination when maximum turn limit is exceeded
   */
  private async handleMaxTurnsReached(socket: WebSocket, context: StreamSessionContext): Promise<void> {
    const farewell = VoiceResponseFormatter.getMaxTurnsPrompt(context.language);
    try {
      const ttsResult = await this.sarvamService.textToSpeech(farewell, context.language);
      const ttsAudio = ttsResult?.audios?.[0];
      if (ttsAudio && socket.readyState === WebSocket.OPEN && context.streamSid) {
        const { pcmBuffer } = extractPcmFromWav(Buffer.from(ttsAudio, "base64"));
        const outbound = context.mediaFormat.encoding.includes("mulaw")
          ? linear16ToMulaw(pcmBuffer)
          : pcmBuffer;
        const frames = chunkAudioBuffer(outbound, FRAME_CHUNK_SIZE_MULAW);
        for (const frame of frames) {
          if (socket.readyState !== WebSocket.OPEN) break;
          socket.send(
            JSON.stringify({
              event: "media",
              streamSid: context.streamSid,
              media: { payload: frame.toString("base64") },
            })
          );
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setTimeout(() => {
        this.cleanupStreamContext(context);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "Max turns reached");
        }
      }, 2000);
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
