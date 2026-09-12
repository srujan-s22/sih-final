import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { ExotelStreamGatewayService, StreamSessionContext } from "../src/services/telephony/exotel-stream-gateway.service.js";
import { VoiceResponseFormatter } from "../src/services/telephony/voice-response-formatter.js";
import { linear16ToMulaw } from "../src/services/telephony/audio-codec.js";
import { SupportedVoiceLanguage } from "../../shared/types/voice.js";

describe("Voice Turn-Taking & Exotel Input Collection Flow", () => {
  let sessionRepo: VoiceSessionRepository;
  let sarvamService: SarvamService;
  let gatewayService: VoiceGatewayService;
  let streamGateway: ExotelStreamGatewayService;
  let mockSocket: any;
  let sentMessages: any[];

  function createSpeechChunk(sampleVal = 4000): Buffer {
    const pcm = Buffer.alloc(320);
    for (let i = 0; i < pcm.length; i += 2) {
      pcm.writeInt16LE(sampleVal, i);
    }
    return linear16ToMulaw(pcm);
  }

  function createSilenceChunk(): Buffer {
    return Buffer.alloc(160, 0xff); // 0xff is μ-law silence
  }

  async function initTestSession(
    lang: SupportedVoiceLanguage = "hi-IN",
    overrides?: Partial<StreamSessionContext>
  ): Promise<StreamSessionContext> {
    const sessionId = `vses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const callSid = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const streamSid = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const session = {
      id: sessionId,
      callSid,
      direction: "INBOUND" as const,
      provider: "EXOTEL" as const,
      callerNumberHash: "hash123",
      maskedCallerNumber: "+91 98*** **210",
      status: "ACTIVE" as const,
      verificationStatus: "UNVERIFIED" as const,
      language: lang,
      turnCount: 0,
      maxTurns: 10,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await sessionRepo.createSession(session);

    return {
      streamSid,
      callSid,
      sessionId,
      session,
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      language: lang,
      turnCount: 0,
      maxTurns: 10,
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
      ...overrides,
    };
  }

  beforeEach(() => {
    sessionRepo = new VoiceSessionRepository(null);
    sarvamService = new SarvamService();
    gatewayService = new VoiceGatewayService(
      sessionRepo,
      sarvamService,
      null as any,
      {
        getPublicSchemeInfo: vi.fn().mockResolvedValue({
          message: "Ayushman Bharat PM-JAY provides cashless hospital cover up to Rs. 5 lakh.",
          data: { schemeId: "ab-pmjay" },
        }),
      } as any,
      null as any,
      null as any,
      null as any,
      { emitDomainEvent: vi.fn() } as any
    );
    streamGateway = new ExotelStreamGatewayService(gatewayService, sessionRepo, sarvamService);

    sentMessages = [];
    mockSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn((data: string) => {
        try {
          sentMessages.push(JSON.parse(data));
        } catch {
          sentMessages.push(data);
        }
      }),
      close: vi.fn(),
      on: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SCENARIO 1: CALLER RESPONDS NORMALLY
  // =========================================================================
  it("Scenario 1: Caller responds normally — waits, STT transcribes, NLU detects intent, assistant responds and waits again", async () => {
    const context = await initTestSession("hi-IN");

    // Mock Sarvam TTS to return dummy audio
    const dummyPcm = Buffer.alloc(320);
    const wavHeader = Buffer.alloc(44);
    const dummyWav = Buffer.concat([wavHeader, dummyPcm]);
    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [dummyWav.toString("base64")],
    });

    // 1. Send initial greeting
    await streamGateway.sendInitialGreeting(mockSocket, context);
    expect(context.isPlayingGreeting).toBe(true);
    expect(context.isPlayingOutbound).toBe(true);

    // Audio received while assistant is still speaking is discarded (echo suppression)
    const echoChunk = createSpeechChunk(1500);
    await streamGateway.handleStreamEvent(mockSocket, context, {
      event: "media",
      streamSid: context.streamSid,
      media: { payload: echoChunk.toString("base64") },
    });
    expect(context.audioBufferChunks.length).toBe(0);

    // 2. Playback mark arrives from Exotel -> Assistant enters WAITING for caller
    streamGateway.handleMarkEvent(mockSocket, context, {
      event: "mark",
      streamSid: context.streamSid,
      mark: { name: "initial_greeting" },
    });
    expect(context.isPlayingOutbound).toBe(false);
    expect(context.isWaitingForCaller).toBe(true);
    expect(context.noSpeechTimer).toBeDefined();

    // 3. Caller speaks an informative inquiry in Hindi
    vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
      transcript: "आयुष्मान भारत योजना के क्या लाभ हैं",
      language_code: "hi-IN",
    });

    // Send 15 speech chunks followed by 46 silence chunks (pause)
    const speechChunk = createSpeechChunk(4500);
    for (let i = 0; i < 15; i++) {
      await streamGateway.handleStreamEvent(mockSocket, context, {
        event: "media",
        streamSid: context.streamSid,
        media: { payload: speechChunk.toString("base64") },
      });
    }
    // Verify noSpeechTimer was cleared when caller started speaking
    expect(context.noSpeechTimer).toBeNull();

    const silenceChunk = createSilenceChunk();
    for (let i = 0; i < 46; i++) {
      await streamGateway.handleStreamEvent(mockSocket, context, {
        event: "media",
        streamSid: context.streamSid,
        media: { payload: silenceChunk.toString("base64") },
      });
    }

    // STT was invoked with assembled caller audio
    expect(sarvamService.speechToText).toHaveBeenCalledTimes(1);

    // Turn count incremented
    expect(context.turnCount).toBe(1);
    expect(context.timeoutCount).toBe(0);

    // Assistant response was sent and ended with mark turn_1
    const markMessages = sentMessages.filter((m) => m.event === "mark");
    const lastMark = markMessages[markMessages.length - 1];
    expect(lastMark.mark.name).toBe("turn_1");

    // Once Exotel acknowledges playback of turn_1, system enters WAITING state again
    streamGateway.handleMarkEvent(mockSocket, context, {
      event: "mark",
      streamSid: context.streamSid,
      mark: { name: "turn_1" },
    });
    expect(context.isWaitingForCaller).toBe(true);
    expect(context.isPlayingOutbound).toBe(false);
  });

  // =========================================================================
  // SCENARIO 2: CALLER IS SILENT
  // =========================================================================
  it("Scenario 2: Caller is silent — reprompts ONCE on first timeout, ends call on second timeout without infinite loop", async () => {
    const context = await initTestSession("en-IN", { isPlayingGreeting: true });

    // Mock Sarvam TTS
    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.alloc(364).toString("base64")],
    });

    // 1. Initial greeting finishes
    streamGateway.onPlaybackFinished(mockSocket, context, "initial_greeting");
    expect(context.isWaitingForCaller).toBe(true);
    expect(context.timeoutCount).toBe(0);

    // 2. First timeout fires (caller has said nothing for 7 seconds)
    await streamGateway.handleNoSpeechTimeout(mockSocket, context);

    // On first timeout: reprompts ONCE with short friendly message (NOT "Sorry I didn't understand")
    expect(context.timeoutCount).toBe(1);
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      VoiceResponseFormatter.getTimeoutReprompt("en-IN"),
      "en-IN"
    );
    expect(sarvamService.textToSpeech).not.toHaveBeenCalledWith(
      expect.stringContaining("I'm sorry, I didn't quite understand that"),
      expect.any(String)
    );

    // Finish reprompt playback
    streamGateway.onPlaybackFinished(mockSocket, context, "timeout_reprompt_0");
    expect(context.isWaitingForCaller).toBe(true);

    // 3. Second timeout fires (caller remains silent after reprompt)
    await streamGateway.handleNoSpeechTimeout(mockSocket, context);

    // Plays goodbye message
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      VoiceResponseFormatter.getTimeoutGoodbye("en-IN"),
      "en-IN"
    );

    // Call does NOT loop; cleanup and close are scheduled
    expect(context.timeoutCount).toBe(1);
  });

  // =========================================================================
  // SCENARIO 3: STT RETURNS EMPTY
  // =========================================================================
  it("Scenario 3: STT returns empty (breath/click) — does NOT trigger 'Sorry I didn't understand' fallback, resumes waiting", async () => {
    const context = await initTestSession("kn-IN");

    // Mock STT returning empty string
    vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
      transcript: "",
      language_code: "kn-IN",
    });

    const processTurnSpy = vi.spyOn(gatewayService, "processTurn");

    context.audioBufferChunks = [createSpeechChunk(4000), createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);

    // STT was called
    expect(sarvamService.speechToText).toHaveBeenCalledTimes(1);

    // NLU / processTurn was NOT called with empty string
    expect(processTurnSpy).not.toHaveBeenCalled();

    // Context resumed listening without playing fallback error
    expect(context.isProcessingTurn).toBe(false);
    expect(context.noSpeechTimer).toBeDefined();

    // Zero outbound media messages were sent (no spurious error reply)
    const mediaSent = sentMessages.filter((m) => m.event === "media");
    expect(mediaSent.length).toBe(0);
  });

  // =========================================================================
  // SCENARIO 4: STT RETURNS UNINTELLIGIBLE SPEECH
  // =========================================================================
  it("Scenario 4: STT returns unintelligible speech — plays fallback once, and WAITS for caller instead of looping", async () => {
    const context = await initTestSession("en-IN");

    // STT returns garbled speech words
    vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
      transcript: "xyz abc blabla unknown gibberish string",
      language_code: "en-IN",
    });

    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.alloc(364).toString("base64")],
    });

    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);

    // Detected intent is UNKNOWN
    expect(context.consecutiveFallbacks).toBe(1);

    // The response sent is the fallback prompt
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      VoiceResponseFormatter.getDefaultFallbackPrompt("en-IN"),
      "en-IN"
    );

    // Turn 1 mark was dispatched
    const markMessages = sentMessages.filter((m) => m.event === "mark");
    expect(markMessages.some((m) => m.mark.name === "turn_1")).toBe(true);

    // Crucial check: After sending fallback, system enters outbound playback and does NOT recursively process
    expect(context.isPlayingOutbound).toBe(true);
    expect(context.isProcessingTurn).toBe(false);

    // When playback ends, system WAITS for caller to try again
    streamGateway.onPlaybackFinished(mockSocket, context, "mark:turn_1");
    expect(context.isWaitingForCaller).toBe(true);
  });

  // =========================================================================
  // SCENARIO 5: MULTIPLE CONVERSATIONAL TURNS
  // =========================================================================
  it("Scenario 5: Multiple conversational turns — preserves call state, language, and turn continuity", async () => {
    const context = await initTestSession("kn-IN");

    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.alloc(364).toString("base64")],
    });

    // Turn 1: Caller asks about schemes in Kannada
    vi.spyOn(sarvamService, "speechToText").mockResolvedValueOnce({
      transcript: "ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ತಿಳಿಸಿ",
      language_code: "kn-IN",
    });

    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);

    expect(context.turnCount).toBe(1);
    expect(context.language).toBe("kn-IN");
    streamGateway.onPlaybackFinished(mockSocket, context, "mark:turn_1");

    // Turn 2: Caller asks for follow-up help in Kannada
    vi.spyOn(sarvamService, "speechToText").mockResolvedValueOnce({
      transcript: "ನನಗೆ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರ ಸಂಪರ್ಕ ಬೇಕು",
      language_code: "kn-IN",
    });

    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);

    expect(context.turnCount).toBe(2);
    expect(context.language).toBe("kn-IN");
    expect(context.session?.language).toBe("kn-IN");
    expect(context.consecutiveFallbacks).toBe(0);

    const markMessages = sentMessages.filter((m) => m.event === "mark");
    expect(markMessages.some((m) => m.mark.name === "turn_1")).toBe(true);
    expect(markMessages.some((m) => m.mark.name === "turn_2")).toBe(true);
  });

  // =========================================================================
  // SCENARIO 6: NO INFINITE FALLBACK LOOP
  // =========================================================================
  it("Scenario 6: No infinite fallback loop — safely concludes after 3 consecutive unrecognized turns", async () => {
    const context = await initTestSession("hi-IN");

    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.alloc(364).toString("base64")],
    });
    vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
      transcript: "अपरिचित शब्द जो समझ नहीं आए",
      language_code: "hi-IN",
    });

    // Turn 1: Unrecognized speech -> fallback 1
    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);
    expect(context.consecutiveFallbacks).toBe(1);
    streamGateway.onPlaybackFinished(mockSocket, context, "mark:turn_1");

    // Turn 2: Unrecognized speech -> fallback 2
    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);
    expect(context.consecutiveFallbacks).toBe(2);
    streamGateway.onPlaybackFinished(mockSocket, context, "mark:turn_2");

    // Turn 3: Unrecognized speech -> terminates cleanly with goodbye instead of looping
    context.audioBufferChunks = [createSpeechChunk(4000)];
    await streamGateway.processSpeechTurn(mockSocket, context);
    expect(context.consecutiveFallbacks).toBe(3);

    // Response sent was end call farewell in Hindi
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      VoiceResponseFormatter.getEndCall("hi-IN"),
      "hi-IN"
    );

    // Call does not loop forever
    expect(context.turnCount).toBe(3);
  });
});
