import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { ExotelStreamGatewayService } from "../src/services/telephony/exotel-stream-gateway.service.js";
import {
  mulawToLinear16,
  linear16ToMulaw,
  linear16ToMulawSample,
  mulawToWav,
  pcmToWav,
  extractPcmFromWav,
  calculatePcmRms,
  chunkAudioBuffer,
} from "../src/services/telephony/audio-codec.js";
import {
  ExotelStreamStartEvent,
  ExotelStreamMediaEvent,
  ExotelStreamStopEvent,
  ExotelStreamMarkEvent,
} from "../../shared/types/voice.js";

describe("Phase 11 — Real-Time Exotel WebSocket Voice Streaming", () => {
  let app: FastifyInstance;
  let serverPort: number;
  let wsUrl: string;

  beforeEach(async () => {
    app = buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as { port: number };
    serverPort = address.port;
    wsUrl = `ws://127.0.0.1:${serverPort}/api/v1/voice/stream`;
  });

  afterEach(async () => {
    await app.close();
  });

  describe("1. Audio Codec & Transcoding Utilities", () => {
    it("converts 16-bit linear PCM to μ-law and back within ITU-T G.711 tolerance", () => {
      const sample = 15000;
      const mulaw = linear16ToMulawSample(sample);
      expect(mulaw).toBeGreaterThanOrEqual(0);
      expect(mulaw).toBeLessThanOrEqual(255);

      const pcmBuffer = Buffer.alloc(4);
      pcmBuffer.writeInt16LE(10000, 0);
      pcmBuffer.writeInt16LE(-10000, 2);

      const encodedMulaw = linear16ToMulaw(pcmBuffer);
      expect(encodedMulaw.length).toBe(2);

      const decodedPcm = mulawToLinear16(encodedMulaw);
      expect(decodedPcm.length).toBe(4);

      // Quantization noise check (within 3% of original magnitude)
      const reconstructed1 = decodedPcm.readInt16LE(0);
      const reconstructed2 = decodedPcm.readInt16LE(2);
      expect(Math.abs(reconstructed1 - 10000)).toBeLessThan(500);
      expect(Math.abs(reconstructed2 - -10000)).toBeLessThan(500);
    });

    it("synthesizes valid standard 44-byte WAV header with 8kHz PCM", () => {
      const pcmData = Buffer.alloc(1600, 0); // 100ms of 8kHz 16-bit mono PCM
      const wav = pcmToWav(pcmData, 8000);

      expect(wav.length).toBe(1644);
      expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
      expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
      expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
      expect(wav.readUInt32LE(24)).toBe(8000); // Sample rate
      expect(wav.readUInt16LE(34)).toBe(16); // Bits per sample
      expect(wav.toString("ascii", 36, 40)).toBe("data");
      expect(wav.readUInt32LE(40)).toBe(1600); // Data length
    });

    it("extracts raw PCM samples from a WAV buffer accurately", () => {
      const pcmOriginal = Buffer.alloc(320);
      pcmOriginal.writeInt16LE(4500, 0);
      pcmOriginal.writeInt16LE(9000, 2);

      const wav = pcmToWav(pcmOriginal, 8000);
      const { pcmBuffer, sampleRate } = extractPcmFromWav(wav);

      expect(sampleRate).toBe(8000);
      expect(pcmBuffer.length).toBe(320);
      expect(pcmBuffer.readInt16LE(0)).toBe(4500);
      expect(pcmBuffer.readInt16LE(2)).toBe(9000);
    });

    it("calculates RMS audio energy accurately for silence vs voice detection", () => {
      const silentBuffer = Buffer.alloc(320, 0); // All 0s
      expect(calculatePcmRms(silentBuffer)).toBe(0);

      const speechBuffer = Buffer.alloc(320);
      for (let i = 0; i < 160; i++) {
        speechBuffer.writeInt16LE(5000, i * 2);
      }
      expect(calculatePcmRms(speechBuffer)).toBe(5000);
    });

    it("chunks audio buffer into uniform frame sizes", () => {
      const audioBuffer = Buffer.alloc(800);
      const chunks = chunkAudioBuffer(audioBuffer, 160);
      expect(chunks.length).toBe(5);
      expect(chunks[0].length).toBe(160);
    });
  });

  describe("2. WebSocket Route & Exotel Stream Protocol Handling", () => {
    it("successfully establishes WebSocket connection at /api/v1/voice/stream", async () => {
      const client = new WebSocket(wsUrl);

      const openPromise = new Promise<void>((resolve, reject) => {
        client.on("open", () => resolve());
        client.on("error", reject);
      });

      await expect(openPromise).resolves.toBeUndefined();
      client.close();
    });

    it("handles Exotel connected handshake event without errors", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      client.send(
        JSON.stringify({
          event: "connected",
          protocol: "Call",
          version: "1.0.0",
        })
      );

      // Verify connection remains open and healthy
      await new Promise((r) => setTimeout(r, 50));
      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it("handles Exotel start event, extracts callSid & streamSid, and binds session", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      const startEvent: ExotelStreamStartEvent = {
        event: "start",
        sequenceNumber: "1",
        streamSid: "stream_test_01",
        start: {
          streamSid: "stream_test_01",
          callSid: "call_test_01",
          tracks: ["inbound"],
          mediaFormat: {
            encoding: "audio/x-mulaw",
            sampleRate: 8000,
            channels: 1,
          },
          customParameters: {
            language: "kn-IN",
            callerPhone: "+919876543210",
          },
        },
      };

      client.send(JSON.stringify(startEvent));
      await new Promise((r) => setTimeout(r, 60));

      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it("accepts Exotel start event with snake_case and null customParameters", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      const startEventWithVariations = {
        event: "start",
        sequence_number: 1,
        stream_sid: "stream_exotel_snake_01",
        start: {
          stream_sid: "stream_exotel_snake_01",
          call_sid: "call_exotel_snake_01",
          mediaFormat: {
            encoding: "audio/x-mulaw",
            sampleRate: 8000,
            channels: 1,
          },
          customParameters: null,
        },
      };

      client.send(JSON.stringify(startEventWithVariations));
      await new Promise((r) => setTimeout(r, 60));

      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it("safely handles malformed JSON without crashing the server", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      client.send("THIS_IS_NOT_VALID_JSON{:::broken");
      await new Promise((r) => setTimeout(r, 50));

      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it("safely handles unknown or invalid events without crashing", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      client.send(JSON.stringify({ event: "unknown_event_type", foo: "bar" }));
      await new Promise((r) => setTimeout(r, 50));

      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it("handles Exotel mark and stop events and closes connection cleanly", async () => {
      const client = new WebSocket(wsUrl);
      await new Promise<void>((resolve) => client.on("open", () => resolve()));

      const markEvent: ExotelStreamMarkEvent = {
        event: "mark",
        streamSid: "stream_test_01",
        mark: { name: "greeting_done" },
      };
      client.send(JSON.stringify(markEvent));

      const stopEvent: ExotelStreamStopEvent = {
        event: "stop",
        streamSid: "stream_test_01",
        stop: { callSid: "call_test_01" },
      };
      client.send(JSON.stringify(stopEvent));

      const closePromise = new Promise<number>((resolve) => {
        client.on("close", (code) => resolve(code));
      });

      const closeCode = await closePromise;
      expect(closeCode).toBe(1000);
    });

    it("ensures existing REST voice routes remain operational alongside WebSocket endpoint", async () => {
      const configRes = await app.inject({
        method: "GET",
        url: "/api/v1/voice/config",
      });

      expect(configRes.statusCode).toBe(200);
      const configBody = JSON.parse(configRes.body);
      expect(configBody.success).toBe(true);
      expect(configBody.data.virtualNumber).toBeDefined();

      const inboundWebhookRes = await app.inject({
        method: "POST",
        url: "/api/v1/voice/webhooks/exotel/inbound",
        payload: {
          CallSid: "call_test_rest_01",
          From: "+919876543210",
          To: "08047283240",
        },
      });

      expect(inboundWebhookRes.statusCode).toBe(200);
    });
  });

  describe("3. Real-Time Speech Turn Ingestion, STT, Business Logic, and TTS Streaming", () => {
    it("accumulates speech frames, detects silence boundary, invokes STT/AI/TTS, and streams media frames back", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        {
          executeAction: vi.fn(),
        } as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      // Mock STT
      vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "What are the eligibility benefits for Ayushman Bharat PM-JAY?",
        language_code: "en-IN",
      });

      // Mock Gateway processTurn
      vi.spyOn(gatewayService, "processTurn").mockResolvedValue({
        sessionId: "vses_mock_01",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        textResponse: "Ayushman Bharat PM-JAY provides up to 5 lakh rupees of cashless secondary and tertiary hospitalization coverage per family per year.",
        detectedIntent: "CHECK_SCHEMES",
        shouldEndCall: false,
        language: "en-IN",
      });

      // Mock TTS returning standard 8kHz PCM in WAV
      const syntheticPcm = Buffer.alloc(1600, 100);
      const syntheticWav = pcmToWav(syntheticPcm, 8000);
      vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
        audios: [syntheticWav.toString("base64")],
      });

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const receivedMessages: any[] = [];
      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn((msg: string) => {
          receivedMessages.push(JSON.parse(msg));
        }),
        on: vi.fn(),
        close: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_live_99",
        callSid: "call_live_99",
        sessionId: "vses_live_99",
        session: { id: "vses_live_99", language: "en-IN" },
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "en-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      // 1. Send speech frames (energy > threshold)
      const speechChunk = Buffer.alloc(160, 200); // Loud mulaw chunk
      for (let i = 0; i < 20; i++) {
        await streamGateway.handleStreamEvent(mockSocket, context, {
          event: "media",
          streamSid: "stream_live_99",
          media: { payload: speechChunk.toString("base64") },
        });
      }

      expect(context.audioBufferChunks.length).toBe(20);

      // 2. Send silence frames (trigger turn detection boundary at >= 45 silence chunks)
      const silenceChunk = Buffer.alloc(160, 255); // Silent mulaw chunk (255 is ~0 in mulaw)
      for (let i = 0; i < 46; i++) {
        await streamGateway.handleStreamEvent(mockSocket, context, {
          event: "media",
          streamSid: "stream_live_99",
          media: { payload: silenceChunk.toString("base64") },
        });
      }

      // Verify STT was invoked with assembled audio
      expect(sarvamService.speechToText).toHaveBeenCalledTimes(1);

      // Verify VoiceGateway was invoked with recognized transcript
      expect(gatewayService.processTurn).toHaveBeenCalledWith("vses_live_99", {
        transcript: "What are the eligibility benefits for Ayushman Bharat PM-JAY?",
        languageCode: "en-IN",
      });

      // Verify Sarvam TTS was invoked with AI response
      expect(sarvamService.textToSpeech).toHaveBeenCalledTimes(1);

      // Verify outbound media chunks and mark were sent over WebSocket
      expect(mockSocket.send).toHaveBeenCalled();
      const mediaMessages = receivedMessages.filter((m) => m.event === "media");
      expect(mediaMessages.length).toBeGreaterThan(0);
      expect(mediaMessages[0].streamSid).toBe("stream_live_99");
      expect(mediaMessages[0].media.payload).toBeDefined();

      const markMessages = receivedMessages.filter((m) => m.event === "mark");
      expect(markMessages.length).toBe(1);
      expect(markMessages[0].mark.name).toBe("turn_1");
    });

    it("enforces maximum turn cost control limit and terminates cleanly", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({ audios: [] });

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_max_turn",
        callSid: "call_max_turn",
        sessionId: "vses_max_turn",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "hi-IN",
        turnCount: 10, // Already at max turns
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [Buffer.alloc(320, 100)],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      await streamGateway.processSpeechTurn(mockSocket, context);

      // Verify farewell TTS attempted in session language (hi-IN)
      expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
        expect.stringMatching(/अधिकतम|maximum/),
        "hi-IN"
      );
    });

    it("resumes listening seamlessly when STT produces empty/blank transcript", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      // Return empty transcript (background noise / cough)
      vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "",
        language_code: "hi-IN",
      });

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_empty_test",
        callSid: "call_empty_test",
        sessionId: "vses_empty_test",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [Buffer.alloc(320, 100)],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      await streamGateway.processSpeechTurn(mockSocket, context);

      // Context is reset and ready for next turn
      expect(context.isProcessingTurn).toBe(false);
    });

    it("handles provider STT failure without crashing and resumes listening", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      vi.spyOn(sarvamService, "speechToText").mockRejectedValue(new Error("Sarvam STT Network Failure"));

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_stt_err",
        callSid: "call_stt_err",
        sessionId: "vses_stt_err",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [Buffer.alloc(320, 100)],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      await streamGateway.processSpeechTurn(mockSocket, context);

      // Gracefully catches error, resets flag, ready for next turn
      expect(context.isProcessingTurn).toBe(false);
    });

    it("handles provider TTS failure without crashing", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "Hello assistant",
        language_code: "hi-IN",
      });

      vi.spyOn(gatewayService, "processTurn").mockResolvedValue({
        sessionId: "vses_tts_err",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        textResponse: "Namaste! How can I help?",
        detectedIntent: "GREETING",
        shouldEndCall: false,
        language: "hi-IN",
      });

      vi.spyOn(sarvamService, "textToSpeech").mockRejectedValue(new Error("Sarvam TTS Unavailable"));

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_tts_err",
        callSid: "call_tts_err",
        sessionId: "vses_tts_err",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [Buffer.alloc(320, 100)],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      await streamGateway.processSpeechTurn(mockSocket, context);

      // Stream continues without crashing
      expect(context.isProcessingTurn).toBe(false);
    });

    it("triggers speech turn when maximum continuous speech chunks are accumulated", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const processSpy = vi
        .spyOn(streamGateway, "processSpeechTurn")
        .mockImplementation(async () => {
          context.audioBufferChunks = [];
          context.turnTotalChunks = 0;
          context.isProcessingTurn = false;
        });

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_max_chunks",
        callSid: "call_max_chunks",
        sessionId: "vses_max_chunks",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: null,
        audioBufferChunks: [],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      const loudChunk = Buffer.alloc(160, 200).toString("base64");

      // Send 350 loud chunks
      for (let i = 0; i < 350; i++) {
        await streamGateway.handleStreamEvent(mockSocket, context, {
          event: "media",
          streamSid: "stream_max_chunks",
          media: { payload: loudChunk },
        });
      }

      // Max turn boundary triggered
      expect(processSpy).toHaveBeenCalledTimes(1);
    });

    it("safely handles invalid base64 media payload without crashing", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const streamGateway = new ExotelStreamGatewayService(
        null as any,
        sessionRepo,
        null as any
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      const context: any = {
        streamSid: "stream_b64_err",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        audioBufferChunks: [],
        turnSilenceChunks: 0,
        turnTotalChunks: 0,
        isProcessingTurn: false,
        isStopped: false,
      };

      await streamGateway.handleStreamEvent(mockSocket, context, {
        event: "media",
        streamSid: "stream_b64_err",
        media: { payload: "" },
      });

      expect(context.audioBufferChunks.length).toBe(0);
    });

    it("preserves authoritative session language (en-IN) even if Exotel start event sends hi-IN", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      await sessionRepo.createSession({
        id: "vses_en_test",
        callSid: "call_en_enforce",
        direction: "OUTBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash123",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        language: "en-IN",
        turnCount: 0,
        maxTurns: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const sarvamService = new SarvamService();
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      let capturedSttLang = "";
      vi.spyOn(sarvamService, "speechToText").mockImplementation(async (_audio, lang) => {
        capturedSttLang = lang || "";
        return {
          transcript: "I want information about health schemes",
          language_code: lang || "en-IN",
        };
      });

      let capturedTurnLang = "";
      vi.spyOn(gatewayService, "processTurn").mockImplementation(async (_sessionId, req) => {
        capturedTurnLang = req.languageCode || "";
        return {
          sessionId: "vses_en_test",
          status: "ACTIVE",
          verificationStatus: "UNVERIFIED",
          textResponse: "SwasthyaSetu covers Ayushman Bharat PM-JAY and Janani Suraksha Yojana.",
          detectedIntent: "CHECK_SCHEMES",
          shouldEndCall: false,
          language: "en-IN",
        };
      });

      let capturedTtsLang = "";
      vi.spyOn(sarvamService, "textToSpeech").mockImplementation(async (_text, lang) => {
        capturedTtsLang = lang || "";
        return { audios: [] };
      });

      const streamGateway = new ExotelStreamGatewayService(
        gatewayService,
        sessionRepo,
        sarvamService
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      // 1. Exotel start event with language="hi-IN"
      await streamGateway.handleStreamEvent(mockSocket, {} as any, {
        event: "start",
        streamSid: "stream_en_enforce",
        start: {
          streamSid: "stream_en_enforce",
          callSid: "call_en_enforce",
          customParameters: { language: "hi-IN" },
        },
      } as any);

      const context = streamGateway.getActiveStream("stream_en_enforce");
      expect(context).toBeDefined();
      expect(context?.language).toBe("en-IN"); // Preserved en-IN over Exotel hi-IN!

      // 2. Accumulate speech and trigger turn
      context!.audioBufferChunks = [Buffer.alloc(320, 100)];
      await streamGateway.processSpeechTurn(mockSocket, context!);

      // 3. Verify STT, Assistant, and TTS all used en-IN
      expect(capturedSttLang).toBe("en-IN");
      expect(capturedTurnLang).toBe("en-IN");
      expect(capturedTtsLang).toBe("en-IN");
    });

    it("cleans up active stream mappings and timers on socket disconnect", () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const streamGateway = new ExotelStreamGatewayService(
        null as any,
        sessionRepo,
        null as any
      );

      const timer = setTimeout(() => {}, 10000);
      const context: any = {
        streamSid: "stream_cleanup_test",
        callSid: "call_cleanup_test",
        sessionId: "vses_cleanup_test",
        session: { id: "vses_cleanup_test", status: "ACTIVE" },
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        language: "en-IN",
        turnCount: 0,
        maxTurns: 10,
        startTime: Date.now(),
        durationTimer: timer,
        audioBufferChunks: [Buffer.alloc(100)],
        isProcessingTurn: false,
        isStopped: false,
      };

      (streamGateway as any).activeStreams.set("stream_cleanup_test", context);
      expect(streamGateway.getActiveStreamCount()).toBe(1);

      streamGateway.cleanupStreamContext(context);

      expect(context.isStopped).toBe(true);
      expect(context.durationTimer).toBeNull();
      expect(context.audioBufferChunks.length).toBe(0);
      expect(streamGateway.getActiveStream("stream_cleanup_test")).toBeUndefined();
      expect(streamGateway.getActiveStreamCount()).toBe(0);
    });
  });
});
