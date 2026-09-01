import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import http from "node:http";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { ExotelStreamGatewayService } from "../src/services/telephony/exotel-stream-gateway.service.js";
import { linear16ToMulaw } from "../src/services/telephony/audio-codec.js";
import { toVoiceLanguage } from "../../shared/types/voice.js";
import { VoiceResponseFormatter } from "../src/services/telephony/voice-response-formatter.js";

describe("Exotel IVR → Language Selection → WebSocket Stream Transition", () => {
  let app: FastifyInstance;
  let serverPort: number;
  let sessionRepo: VoiceSessionRepository;
  let sarvamService: SarvamService;
  let gatewayService: VoiceGatewayService;
  let streamGatewayService: ExotelStreamGatewayService;

  beforeEach(async () => {
    app = buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    serverPort = (app.server.address() as any).port;

    sessionRepo = app.voiceSessionRepository;
    sarvamService = app.sarvamService;
    gatewayService = app.voiceGatewayService;

    // Spy on Sarvam STT and TTS to track language arguments
    vi.spyOn(sarvamService, "speechToText").mockImplementation(async (_audio, lang) => {
      if (lang === "kn-IN") {
        return { transcript: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಯೋಜನೆ ಬಗ್ಗೆ ಮಾಹಿತಿ ನೀಡಿ", confidence: 0.95, language_code: "kn-IN" };
      }
      if (lang === "hi-IN") {
        return { transcript: "मुझे आयुष्मान भारत योजना की जानकारी चाहिए", confidence: 0.95, language_code: "hi-IN" };
      }
      return { transcript: "Tell me about Ayushman Bharat scheme", confidence: 0.95, language_code: "en-IN" };
    });

    vi.spyOn(sarvamService, "textToSpeech").mockImplementation(async (_text, lang) => {
      // Return 160 bytes of dummy PCM audio base64 wrapped in mock WAV
      const dummyPcm = Buffer.alloc(320);
      const wavHeader = Buffer.alloc(44);
      const dummyWav = Buffer.concat([wavHeader, dummyPcm]);
      return {
        audios: [dummyWav.toString("base64")],
        actualLanguage: lang,
      };
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  // Helper to create valid speech audio chunks
  function createSpeechChunks(count = 15): Buffer[] {
    const chunks: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const pcm = Buffer.alloc(320);
      for (let j = 0; j < pcm.length; j += 2) {
        pcm.writeInt16LE(4000, j); // active voice energy RMS > 300
      }
      chunks.push(linear16ToMulaw(pcm));
    }
    return chunks;
  }

  function createSilenceChunks(count = 46): Buffer[] {
    const chunks: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      chunks.push(Buffer.alloc(160, 0xff)); // 0xff is silence in μ-law
    }
    return chunks;
  }

  // 1. HTTP Readiness Check
  it("GET /api/v1/voice/stream returns HTTP 200 readiness response (never 404)", async () => {
    const res = await new Promise<{ statusCode: number; body: string }>((resolve) => {
      http.get(`http://127.0.0.1:${serverPort}/api/v1/voice/stream`, (response) => {
        let body = "";
        response.on("data", (c) => (body += c));
        response.on("end", () => resolve({ statusCode: response.statusCode || 0, body }));
      });
    });

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe("ready");
    expect(parsed.protocol).toBe("websocket");
  });

  // 2. English Branch (IVR 1 -> en-IN)
  it("IVR 1 (en-IN): connects to stream with ?language=en-IN, remains alive, STT and TTS in en-IN", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=en-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Send connected and start events
    ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    ws.send(JSON.stringify({
      event: "start",
      sequenceNumber: "1",
      start: {
        streamSid: "stream_ivr_en_01",
        callSid: "call_ivr_en_01",
        accountSid: "exo_test",
        tracks: ["inbound"],
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: "stream_ivr_en_01",
    }));

    await new Promise((r) => setTimeout(r, 60));

    // WebSocket MUST remain open (no hangup)
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Verify session bound in en-IN
    const session = await sessionRepo.getSessionByCallSid("call_ivr_en_01");
    expect(session).toBeDefined();
    expect(session?.language).toBe("en-IN");

    // Send speech audio frames followed by silence boundary
    const speechChunks = createSpeechChunks(15);
    const silenceChunks = createSilenceChunks(46);

    for (const chunk of [...speechChunks, ...silenceChunks]) {
      ws.send(JSON.stringify({
        event: "media",
        streamSid: "stream_ivr_en_01",
        media: { payload: chunk.toString("base64") },
      }));
    }

    await new Promise((r) => setTimeout(r, 200));

    // Verify STT was invoked with en-IN
    expect(sarvamService.speechToText).toHaveBeenCalledWith(
      expect.any(String),
      "en-IN",
      "wav"
    );

    // Verify TTS was invoked with en-IN
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      expect.any(String),
      "en-IN"
    );

    // Call MUST still be alive
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 3. Kannada Branch (IVR 2 -> kn-IN)
  it("IVR 2 (kn-IN): connects to stream with ?language=kn-IN, remains alive, STT and TTS in kn-IN", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=kn-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    ws.send(JSON.stringify({
      event: "start",
      sequenceNumber: "1",
      start: {
        streamSid: "stream_ivr_kn_02",
        callSid: "call_ivr_kn_02",
        accountSid: "exo_test",
        tracks: ["inbound"],
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: "stream_ivr_kn_02",
    }));

    await new Promise((r) => setTimeout(r, 60));

    // Call MUST NOT hang up
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Verify session bound in kn-IN
    const session = await sessionRepo.getSessionByCallSid("call_ivr_kn_02");
    expect(session).toBeDefined();
    expect(session?.language).toBe("kn-IN");

    // Send speech audio frames followed by silence boundary
    const speechChunks = createSpeechChunks(15);
    const silenceChunks = createSilenceChunks(46);

    for (const chunk of [...speechChunks, ...silenceChunks]) {
      ws.send(JSON.stringify({
        event: "media",
        streamSid: "stream_ivr_kn_02",
        media: { payload: chunk.toString("base64") },
      }));
    }

    await new Promise((r) => setTimeout(r, 200));

    // Verify STT was invoked with kn-IN
    expect(sarvamService.speechToText).toHaveBeenCalledWith(
      expect.any(String),
      "kn-IN",
      "wav"
    );

    // Verify TTS was invoked with kn-IN
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      expect.any(String),
      "kn-IN"
    );

    // Call MUST still be alive
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 4. Hindi Branch (IVR 3 -> hi-IN)
  it("IVR 3 (hi-IN): connects to stream with ?language=hi-IN, remains alive, STT and TTS in hi-IN", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=hi-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    ws.send(JSON.stringify({
      event: "start",
      sequenceNumber: "1",
      start: {
        streamSid: "stream_ivr_hi_03",
        callSid: "call_ivr_hi_03",
        accountSid: "exo_test",
        tracks: ["inbound"],
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: "stream_ivr_hi_03",
    }));

    await new Promise((r) => setTimeout(r, 60));

    // Call MUST NOT hang up
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Verify session bound in hi-IN
    const session = await sessionRepo.getSessionByCallSid("call_ivr_hi_03");
    expect(session).toBeDefined();
    expect(session?.language).toBe("hi-IN");

    // Send speech audio frames followed by silence boundary
    const speechChunks = createSpeechChunks(15);
    const silenceChunks = createSilenceChunks(46);

    for (const chunk of [...speechChunks, ...silenceChunks]) {
      ws.send(JSON.stringify({
        event: "media",
        streamSid: "stream_ivr_hi_03",
        media: { payload: chunk.toString("base64") },
      }));
    }

    await new Promise((r) => setTimeout(r, 200));

    // Verify STT was invoked with hi-IN
    expect(sarvamService.speechToText).toHaveBeenCalledWith(
      expect.any(String),
      "hi-IN",
      "wav"
    );

    // Verify TTS was invoked with hi-IN
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
      expect.any(String),
      "hi-IN"
    );

    // Call MUST still be alive
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 5. In-Call DTMF Language Switching (Live IVR Keypresses)
  it("In-Call DTMF: digit 2 switches to kn-IN, digit 3 switches to hi-IN, digit 1 switches to en-IN", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=en-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    ws.send(JSON.stringify({
      event: "start",
      start: { streamSid: "stream_dtmf_01", callSid: "call_dtmf_01" },
      streamSid: "stream_dtmf_01",
    }));
    await new Promise((r) => setTimeout(r, 50));

    let session = await sessionRepo.getSessionByCallSid("call_dtmf_01");
    expect(session?.language).toBe("en-IN");

    // Press DTMF '2' for Kannada
    ws.send(JSON.stringify({ event: "dtmf", streamSid: "stream_dtmf_01", dtmf: { digit: "2" } }));
    await new Promise((r) => setTimeout(r, 50));

    session = await sessionRepo.getSessionByCallSid("call_dtmf_01");
    expect(session?.language).toBe("kn-IN");

    // Press DTMF '3' for Hindi
    ws.send(JSON.stringify({ event: "dtmf", streamSid: "stream_dtmf_01", dtmf: { digit: "3" } }));
    await new Promise((r) => setTimeout(r, 50));

    session = await sessionRepo.getSessionByCallSid("call_dtmf_01");
    expect(session?.language).toBe("hi-IN");

    // Press DTMF '1' for English
    ws.send(JSON.stringify({ event: "dtmf", streamSid: "stream_dtmf_01", dtmf: { digit: "1" } }));
    await new Promise((r) => setTimeout(r, 50));

    session = await sessionRepo.getSessionByCallSid("call_dtmf_01");
    expect(session?.language).toBe("en-IN");

    // Invalid DTMF digit (e.g. '4', '9', '#') MUST NOT alter language
    ws.send(JSON.stringify({ event: "dtmf", streamSid: "stream_dtmf_01", dtmf: { digit: "4" } }));
    await new Promise((r) => setTimeout(r, 50));

    session = await sessionRepo.getSessionByCallSid("call_dtmf_01");
    expect(session?.language).toBe("en-IN");

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 6. Invalid Language Query Parameter Falls Back to en-IN
  it("Invalid language query param (?language=te-IN) safely falls back to en-IN without disconnect", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=te-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    ws.send(JSON.stringify({
      event: "start",
      start: { streamSid: "stream_invalid_lang", callSid: "call_invalid_lang" },
      streamSid: "stream_invalid_lang",
    }));
    await new Promise((r) => setTimeout(r, 50));

    expect(ws.readyState).toBe(WebSocket.OPEN);

    const session = await sessionRepo.getSessionByCallSid("call_invalid_lang");
    expect(session?.language).toBe("en-IN");

    ws.close();
  });

  // 7. Session Precedence: Outbound Website Language Preserved Against Exotel Metadata
  it("Session Precedence: pre-existing outbound website session in kn-IN is NOT overwritten by Exotel start metadata", async () => {
    // Citizen requested call from website in Kannada
    await sessionRepo.createSession({
      id: "vses_site_outbound_kn",
      callSid: "call_precedence_test",
      direction: "OUTBOUND",
      provider: "EXOTEL",
      callerNumberHash: "hash123",
      maskedCallerNumber: "+91 98*** **210",
      status: "ACTIVE",
      verificationStatus: "UNVERIFIED",
      language: "kn-IN",
      turnCount: 0,
      maxTurns: 10,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Exotel connects without language query but sends start metadata saying en-IN
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    ws.send(JSON.stringify({
      event: "start",
      start: {
        streamSid: "stream_precedence_test",
        callSid: "call_precedence_test",
        customParameters: { language: "en-IN" },
      },
      streamSid: "stream_precedence_test",
    }));
    await new Promise((r) => setTimeout(r, 60));

    // Session language MUST REMAIN kn-IN
    const session = await sessionRepo.getSessionByCallSid("call_precedence_test");
    expect(session?.language).toBe("kn-IN");

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 8. Session Precedence: Stream URL Query Parameter Overrides Generic Exotel Metadata
  it("Session Precedence: stream URL query ?language=kn-IN takes precedence over generic Exotel start metadata", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=kn-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    ws.send(JSON.stringify({
      event: "start",
      start: {
        streamSid: "stream_url_over_meta",
        callSid: "call_url_over_meta",
        customParameters: { language: "en-IN" }, // Generic Exotel default
      },
      streamSid: "stream_url_over_meta",
    }));
    await new Promise((r) => setTimeout(r, 60));

    // Session language MUST BE kn-IN from the URL query
    const session = await sessionRepo.getSessionByCallSid("call_url_over_meta");
    expect(session?.language).toBe("kn-IN");

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 9. Path-Based Routing Support (/api/v1/voice/stream/:language)
  it("Path parameter routing (/api/v1/voice/stream/kn-IN) correctly extracts kn-IN", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream/kn-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    ws.send(JSON.stringify({
      event: "start",
      start: {
        streamSid: "stream_path_kn",
        callSid: "call_path_kn",
      },
      streamSid: "stream_path_kn",
    }));
    await new Promise((r) => setTimeout(r, 60));

    const session = await sessionRepo.getSessionByCallSid("call_path_kn");
    expect(session?.language).toBe("kn-IN");

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 10. Normalization of Varied Language Formats
  it("Normalizes underscore, uppercase, and language name variations (e.g. kn_IN, kannada, Hindi)", () => {
    expect(toVoiceLanguage("kn-IN")).toBe("kn-IN");
    expect(toVoiceLanguage("kn_IN")).toBe("kn-IN");
    expect(toVoiceLanguage("kn")).toBe("kn-IN");
    expect(toVoiceLanguage("kannada")).toBe("kn-IN");
    expect(toVoiceLanguage("KANNADA")).toBe("kn-IN");

    expect(toVoiceLanguage("hi-IN")).toBe("hi-IN");
    expect(toVoiceLanguage("hi_IN")).toBe("hi-IN");
    expect(toVoiceLanguage("hi")).toBe("hi-IN");
    expect(toVoiceLanguage("hindi")).toBe("hi-IN");
    expect(toVoiceLanguage("HINDI")).toBe("hi-IN");

    expect(toVoiceLanguage("en-IN")).toBe("en-IN");
    expect(toVoiceLanguage("en_IN")).toBe("en-IN");
    expect(toVoiceLanguage("en")).toBe("en-IN");
    expect(toVoiceLanguage("english")).toBe("en-IN");

    expect(toVoiceLanguage("te-IN")).toBe("en-IN");
    expect(toVoiceLanguage("ta-IN")).toBe("en-IN");
    expect(toVoiceLanguage("mr-IN")).toBe("en-IN");
    expect(toVoiceLanguage("unknown")).toBe("en-IN");
    expect(toVoiceLanguage(null)).toBe("en-IN");
    expect(toVoiceLanguage(undefined)).toBe("en-IN");
  });

  // 11. Spoken Initial Greeting in Kannada (IVR 2 -> kn-IN)
  it("Initial Greeting: plays localized Kannada greeting on connect and streams audio frames once", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=kn-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    const receivedMessages: any[] = [];
    ws.on("message", (data) => {
      try {
        receivedMessages.push(JSON.parse(data.toString()));
      } catch {
        // non-json
      }
    });

    ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    ws.send(JSON.stringify({
      event: "start",
      start: {
        streamSid: "stream_greeting_kn",
        callSid: "call_greeting_kn",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: "stream_greeting_kn",
    }));

    await new Promise((r) => setTimeout(r, 100));

    // Verify initial greeting was requested from Sarvam TTS with Kannada text & kn-IN code
    const expectedKnGreeting = VoiceResponseFormatter.getGreeting("kn-IN");
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(expectedKnGreeting, "kn-IN");

    // Verify media frames and mark message were received on the client socket
    const mediaMsgs = receivedMessages.filter((m) => m.event === "media");
    const markMsgs = receivedMessages.filter((m) => m.event === "mark");
    expect(mediaMsgs.length).toBeGreaterThan(0);
    expect(markMsgs.some((m) => m.mark?.name === "initial_greeting")).toBe(true);

    const callCountAfterStart = (sarvamService.textToSpeech as any).mock.calls.length;

    // Send a silent audio chunk to ensure greeting does NOT re-trigger on media chunks
    ws.send(JSON.stringify({
      event: "media",
      streamSid: "stream_greeting_kn",
      media: { payload: Buffer.alloc(160, 0xff).toString("base64") },
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Greeting must happen exactly once
    expect((sarvamService.textToSpeech as any).mock.calls.length).toBe(callCountAfterStart);

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 12. Spoken Initial Greeting in Hindi (IVR 3 -> hi-IN)
  it("Initial Greeting: plays localized Hindi greeting on connect and streams audio frames", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/api/v1/voice/stream?language=hi-IN`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    const receivedMessages: any[] = [];
    ws.on("message", (data) => {
      try {
        receivedMessages.push(JSON.parse(data.toString()));
      } catch {
        // non-json
      }
    });

    ws.send(JSON.stringify({
      event: "start",
      start: {
        streamSid: "stream_greeting_hi",
        callSid: "call_greeting_hi",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: "stream_greeting_hi",
    }));

    await new Promise((r) => setTimeout(r, 100));

    // Verify initial greeting was requested from Sarvam TTS with Hindi text & hi-IN code
    const expectedHiGreeting = VoiceResponseFormatter.getGreeting("hi-IN");
    expect(sarvamService.textToSpeech).toHaveBeenCalledWith(expectedHiGreeting, "hi-IN");

    const markMsgs = receivedMessages.filter((m) => m.event === "mark");
    expect(markMsgs.some((m) => m.mark?.name === "initial_greeting")).toBe(true);

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  // 13. Assistant UNKNOWN Intent Localized Response
  it("Localized Fallback: UNKNOWN intent returns natural localized response in caller language", async () => {
    // 1. Kannada session
    const knSession = await gatewayService.createInboundSession(
      "+919876543210",
      "call_kn_test_13",
      "kn-IN"
    );
    const knTurn = await gatewayService.processTurn(knSession.id, {
      transcript: "ಅಸ್ಪಷ್ಟ ಶಬ್ದಗಳು ಮತ್ತು ಅರ್ಥವಾಗದ ಮಾತು",
      languageCode: "kn-IN",
    });
    expect(knTurn.detectedIntent).toBe("UNKNOWN");
    expect(knTurn.textResponse).toBe(VoiceResponseFormatter.getDefaultFallbackPrompt("kn-IN"));
    expect(knTurn.textResponse).toContain("ಕ್ಷಮಿಸಿ");

    // 2. Hindi session
    const hiSession = await gatewayService.createInboundSession(
      "+919876543211",
      "call_hi_test_13",
      "hi-IN"
    );
    const hiTurn = await gatewayService.processTurn(hiSession.id, {
      transcript: "अजीब बात जो समझ नहीं आती",
      languageCode: "hi-IN",
    });
    expect(hiTurn.detectedIntent).toBe("UNKNOWN");
    expect(hiTurn.textResponse).toBe(VoiceResponseFormatter.getDefaultFallbackPrompt("hi-IN"));
    expect(hiTurn.textResponse).toContain("क्षमा करें");

    // 3. English session
    const enSession = await gatewayService.createInboundSession(
      "+919876543212",
      "call_en_test_13",
      "en-IN"
    );
    const enTurn = await gatewayService.processTurn(enSession.id, {
      transcript: "gibberish completely unrecognized word string",
      languageCode: "en-IN",
    });
    expect(enTurn.detectedIntent).toBe("UNKNOWN");
    expect(enTurn.textResponse).toBe(VoiceResponseFormatter.getDefaultFallbackPrompt("en-IN"));
    expect(enTurn.textResponse).toContain("I'm sorry");
  });
});
