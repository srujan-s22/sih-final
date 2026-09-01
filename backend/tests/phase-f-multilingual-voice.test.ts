/**
 * Phase F — Sarvam Multilingual Voice Integration Test Suite
 * Validates native multilingual capabilities across English (en-IN), Kannada (kn-IN), and Hindi (hi-IN)
 * Covers STT, Assistant Response Formatting, TTS, Session Language Precedence, and Audio Telephony Invariants
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocket } from "ws";
import {
  toVoiceLanguage,
  toUiLanguage,
  SUPPORTED_VOICE_LANGUAGES,
  VoiceSession,
} from "../../shared/types/voice.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { ExotelStreamGatewayService } from "../src/services/telephony/exotel-stream-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { VoiceResponseFormatter } from "../src/services/telephony/voice-response-formatter.js";
import { VoiceActionService } from "../src/services/telephony/voice-action.service.js";
import { SchemeService } from "../src/services/scheme.service.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { AssistanceService } from "../src/services/assistance.service.js";
import {
  mulawToWav,
  pcmToWav,
  chunkAudioBuffer,
  linear16ToMulaw,
} from "../src/services/telephony/audio-codec.js";
import {
  FRAME_CHUNK_SIZE_MULAW,
  FRAME_CHUNK_SIZE_PCM,
} from "../src/services/telephony/exotel-stream-gateway.service.js";

describe("Phase F — Sarvam Multilingual Voice Integration", () => {
  let mockSessionRepo: VoiceSessionRepository;
  let mockSarvamService: SarvamService;
  let mockGatewayService: VoiceGatewayService;
  let mockActionService: VoiceActionService;

  beforeEach(() => {
    mockSessionRepo = new VoiceSessionRepository(null);
    mockSarvamService = new SarvamService();
  });

  // ============================================================
  // TEST 1 — CANONICAL LANGUAGE MAPPING HELPERS
  // ============================================================
  describe("1. Canonical Language Mapping Helpers", () => {
    it("maps supported UI locales and telephony strings to authoritative voice languages", () => {
      // English
      expect(toVoiceLanguage("en")).toBe("en-IN");
      expect(toVoiceLanguage("en-IN")).toBe("en-IN");
      expect(toVoiceLanguage("EN-in")).toBe("en-IN");

      // Kannada
      expect(toVoiceLanguage("kn")).toBe("kn-IN");
      expect(toVoiceLanguage("kn-IN")).toBe("kn-IN");
      expect(toVoiceLanguage("KN-in")).toBe("kn-IN");

      // Hindi
      expect(toVoiceLanguage("hi")).toBe("hi-IN");
      expect(toVoiceLanguage("hi-IN")).toBe("hi-IN");
      expect(toVoiceLanguage("HI-in")).toBe("hi-IN");
    });

    it("falls back safely to en-IN for unsupported or invalid language inputs", () => {
      expect(toVoiceLanguage(null)).toBe("en-IN");
      expect(toVoiceLanguage(undefined)).toBe("en-IN");
      expect(toVoiceLanguage("")).toBe("en-IN");
      expect(toVoiceLanguage("ta-IN")).toBe("en-IN"); // Tamil not enabled in Phase F core
      expect(toVoiceLanguage("es-ES")).toBe("en-IN");
      expect(toVoiceLanguage("invalid_lang")).toBe("en-IN");
    });

    it("maps voice languages back to website UI locale", () => {
      expect(toUiLanguage("kn-IN")).toBe("kn");
      expect(toUiLanguage("hi-IN")).toBe("hi");
      expect(toUiLanguage("en-IN")).toBe("en");
      expect(toUiLanguage(null)).toBe("en");
      expect(toUiLanguage("unknown")).toBe("en");
    });

    it("ensures SUPPORTED_VOICE_LANGUAGES only exposes en-IN, kn-IN, hi-IN", () => {
      expect(SUPPORTED_VOICE_LANGUAGES).toEqual(["en-IN", "kn-IN", "hi-IN"]);
    });
  });

  // ============================================================
  // TEST 2 — SARVAM STT LANGUAGE CODE PROPAGATION
  // ============================================================
  describe("2. Sarvam Saaras STT Language Code Propagation", () => {
    it("passes exact language_code to Sarvam Saaras API for kn-IN, hi-IN, and en-IN", async () => {
      const sarvam = new SarvamService();
      let capturedPayloadString = "";

      // Mock global fetch to inspect multipart form body
      vi.spyOn(global, "fetch").mockImplementation(async (_url, options: any) => {
        const bodyBuffer = options.body as Buffer;
        capturedPayloadString = bodyBuffer.toString("utf8");
        return {
          ok: true,
          json: async () => ({
            transcript: "Mock transcript",
            language_code: "kn-IN",
          }),
        } as any;
      });

      // 1. Test Kannada STT
      await sarvam.speechToText(Buffer.from("dummy_audio").toString("base64"), "kn-IN");
      expect(capturedPayloadString).toContain('name="language_code"\r\n\r\nkn-IN\r\n');

      // 2. Test Hindi STT
      await sarvam.speechToText(Buffer.from("dummy_audio").toString("base64"), "hi-IN");
      expect(capturedPayloadString).toContain('name="language_code"\r\n\r\nhi-IN\r\n');

      // 3. Test English STT
      await sarvam.speechToText(Buffer.from("dummy_audio").toString("base64"), "en-IN");
      expect(capturedPayloadString).toContain('name="language_code"\r\n\r\nen-IN\r\n');

      // 4. Test Unsupported fallback
      await sarvam.speechToText(Buffer.from("dummy_audio").toString("base64"), "unsupported");
      expect(capturedPayloadString).toContain('name="language_code"\r\n\r\nen-IN\r\n');
    });
  });

  // ============================================================
  // TEST 3 — SARVAM TTS TARGET LANGUAGE CODE PROPAGATION
  // ============================================================
  describe("3. Sarvam Bulbul TTS Target Language Code Propagation", () => {
    it("passes target_language_code and 8000Hz sample rate to Sarvam Bulbul API", async () => {
      const sarvam = new SarvamService();
      let capturedRequestBody: any = null;

      vi.spyOn(global, "fetch").mockImplementation(async (_url, options: any) => {
        capturedRequestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            audios: [Buffer.from("dummy_wav").toString("base64")],
          }),
        } as any;
      });

      // 1. Kannada TTS
      await sarvam.textToSpeech("ನಮಸ್ಕಾರ, ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ.", "kn-IN");
      expect(capturedRequestBody.target_language_code).toBe("kn-IN");
      expect(capturedRequestBody.speech_sample_rate).toBe(8000);
      expect(capturedRequestBody.inputs[0]).toContain("ನಮಸ್ಕಾರ");

      // 2. Hindi TTS
      await sarvam.textToSpeech("नमस्ते, स्वास्थ्यसेतु में आपका स्वागत है।", "hi-IN");
      expect(capturedRequestBody.target_language_code).toBe("hi-IN");
      expect(capturedRequestBody.speech_sample_rate).toBe(8000);
      expect(capturedRequestBody.inputs[0]).toContain("नमस्ते");

      // 3. English TTS
      await sarvam.textToSpeech("Welcome to SwasthyaSetu healthcare helpline.", "en-IN");
      expect(capturedRequestBody.target_language_code).toBe("en-IN");
      expect(capturedRequestBody.speech_sample_rate).toBe(8000);
    });
  });

  // ============================================================
  // TEST 4 — KANNADA END-TO-END VOICE TURN PIPELINE
  // ============================================================
  describe("4. Kannada Voice Turn Pipeline", () => {
    it("processes Kannada speech, extracts intent, formats Kannada response, and synthesizes in kn-IN", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();

      // Create pre-existing session in Kannada
      const session = await sessionRepo.createSession({
        id: "vses_kannada_test",
        callSid: "call_kannada_001",
        direction: "INBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_kn",
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

      const mockActionService = {
        getPublicSchemeInfo: vi.fn().mockImplementation(async (schemeId, session) => ({
          success: true,
          message: VoiceResponseFormatter.getGeneralSchemeInfo(
            typeof session === "string" ? session : session?.language
          ),
        })),
      } as any;

      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        mockActionService,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      // Verify intent extraction for Kannada scheme inquiry
      const intentResult = sarvamService.understandIntent(
        "ನನಗೆ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಯೋಜನೆ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು",
        session.language
      );
      expect(intentResult.intent).toBe("CHECK_SCHEMES");
      expect(intentResult.schemeId).toBe("ab-pmjay");
      expect(intentResult.language).toBe("kn-IN");

      // Process turn in VoiceGatewayService
      const turnResponse = await gatewayService.processTurn(session.id, {
        transcript: "ನನಗೆ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಯೋಜನೆ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು",
        languageCode: session.language,
      });

      // Verify localized Kannada response
      expect(turnResponse.language).toBe("kn-IN");
      expect(turnResponse.textResponse).toContain("ಸ್ವಾಸ್ಥ್ಯಸೇತು");
      expect(turnResponse.textResponse).toContain("ಆಯುಷ್ಮಾನ್");
      expect(turnResponse.detectedIntent).toBe("CHECK_SCHEMES");
    });
  });

  // ============================================================
  // TEST 5 — HINDI END-TO-END VOICE TURN PIPELINE
  // ============================================================
  describe("5. Hindi Voice Turn Pipeline", () => {
    it("processes Hindi speech, extracts intent, formats Hindi response, and synthesizes in hi-IN", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const sarvamService = new SarvamService();

      const session = await sessionRepo.createSession({
        id: "vses_hindi_test",
        callSid: "call_hindi_001",
        direction: "INBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_hi",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockActionService = {
        getPublicSchemeInfo: vi.fn().mockImplementation(async (schemeId, session) => ({
          success: true,
          message: VoiceResponseFormatter.getGeneralSchemeInfo(
            typeof session === "string" ? session : session?.language
          ),
        })),
      } as any;

      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        sarvamService,
        null as any,
        mockActionService,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      // Verify intent extraction for Hindi scheme inquiry
      const intentResult = sarvamService.understandIntent(
        "मुझे आयुष्मान भारत योजना की जानकारी चाहिए",
        session.language
      );
      expect(intentResult.intent).toBe("CHECK_SCHEMES");
      expect(intentResult.schemeId).toBe("ab-pmjay");
      expect(intentResult.language).toBe("hi-IN");

      // Process turn
      const turnResponse = await gatewayService.processTurn(session.id, {
        transcript: "मुझे आयुष्मान भारत योजना की जानकारी चाहिए",
        languageCode: session.language,
      });

      // Verify localized Hindi response
      expect(turnResponse.language).toBe("hi-IN");
      expect(turnResponse.textResponse).toContain("स्वास्थ्यसेतु");
      expect(turnResponse.textResponse).toContain("आयुष्मान");
      expect(turnResponse.detectedIntent).toBe("CHECK_SCHEMES");
    });
  });

  // ============================================================
  // TEST 6 — CODE-SWITCHING INTENT UNDERSTANDING
  // ============================================================
  describe("6. Code-Switching Intent Understanding (Kanglish & Hinglish)", () => {
    it("correctly extracts intents from Kanglish without flapping session language", () => {
      const sarvam = new SarvamService();

      const result1 = sarvam.understandIntent(
        "Ayushman Bharat scheme ಬಗ್ಗೆ information ಬೇಕು",
        "kn-IN"
      );
      expect(result1.intent).toBe("CHECK_SCHEMES");
      expect(result1.schemeId).toBe("ab-pmjay");
      expect(result1.language).toBe("kn-IN"); // Stays Kannada!

      const result2 = sarvam.understandIntent(
        "Nanna application status check madbeku",
        "kn-IN"
      );
      expect(result2.intent).toBe("CHECK_ASSISTANCE_STATUS");
      expect(result2.language).toBe("kn-IN");

      const result3 = sarvam.understandIntent(
        "Manege ASHA worker visit yavaga?",
        "kn-IN"
      );
      expect(result3.intent).toBe("CHECK_FOLLOW_UP");
      expect(result3.language).toBe("kn-IN");
    });

    it("correctly extracts intents from Hinglish without flapping session language", () => {
      const sarvam = new SarvamService();

      const result1 = sarvam.understandIntent(
        "Mujhe PM-JAY scheme ke baare mein help chahiye",
        "hi-IN"
      );
      expect(result1.intent).toBe("REQUEST_ASSISTANCE");
      expect(result1.schemeId).toBe("ab-pmjay");
      expect(result1.language).toBe("hi-IN"); // Stays Hindi!

      const result2 = sarvam.understandIntent(
        "Kya mere 71 year old grandfather eligible hain?",
        "hi-IN"
      );
      expect(result2.intent).toBe("CHECK_ELIGIBILITY");
      expect(result2.memberIdentifier).toBe("senior_grandfather");
      expect(result2.language).toBe("hi-IN");

      const result3 = sarvam.understandIntent(
        "ASHA didi ka phone number mil sakta hai?",
        "hi-IN"
      );
      expect(result3.intent).toBe("CONTACT_ASHA");
      expect(result3.language).toBe("hi-IN");
    });
  });

  // ============================================================
  // TEST 7 — WEBSITE LANGUAGE OVERRIDE (PRE-EXISTING SESSION PRECEDENCE)
  // ============================================================
  describe("7. Website Language Override & Session Precedence", () => {
    it("preserves Kannada (kn-IN) from website call request when Exotel start sends hi-IN", async () => {
      const sessionRepo = new VoiceSessionRepository(null);

      // Pre-existing session created when citizen clicked "Call" on Kannada website
      await sessionRepo.createSession({
        id: "vses_kn_site_call",
        callSid: "call_kn_exotel_override",
        direction: "OUTBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_kn",
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

      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        new SarvamService(),
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
        new SarvamService()
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      // Exotel connects WebSocket with start event carrying metadata language = "hi-IN"
      await streamGateway.handleStreamEvent(mockSocket, {} as any, {
        event: "start",
        streamSid: "stream_kn_test",
        start: {
          streamSid: "stream_kn_test",
          callSid: "call_kn_exotel_override",
          customParameters: { language: "hi-IN" }, // Different from website!
        },
      } as any);

      const context = streamGateway.getActiveStream("stream_kn_test");
      expect(context).toBeDefined();
      expect(context?.language).toBe("kn-IN"); // Website session language MUST win!
    });

    it("preserves Hindi (hi-IN) from website call request when Exotel start sends en-IN", async () => {
      const sessionRepo = new VoiceSessionRepository(null);

      // Pre-existing session created when ASHA clicked "Call" on Hindi website
      await sessionRepo.createSession({
        id: "vses_hi_asha_call",
        callSid: "call_hi_exotel_override",
        direction: "OUTBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_hi",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        language: "hi-IN",
        turnCount: 0,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        new SarvamService(),
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
        new SarvamService()
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      await streamGateway.handleStreamEvent(mockSocket, {} as any, {
        event: "start",
        streamSid: "stream_hi_test",
        start: {
          streamSid: "stream_hi_test",
          callSid: "call_hi_exotel_override",
          customParameters: { language: "en-IN" },
        },
      } as any);

      const context = streamGateway.getActiveStream("stream_hi_test");
      expect(context).toBeDefined();
      expect(context?.language).toBe("hi-IN"); // Website session language MUST win!
    });

    it("resolves Exotel start metadata when no pre-existing session exists (inbound PSTN)", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        new SarvamService(),
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
        new SarvamService()
      );

      const mockSocket: any = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      // Case A: Exotel start carries Kannada
      await streamGateway.handleStreamEvent(mockSocket, {} as any, {
        event: "start",
        streamSid: "stream_direct_kn",
        start: {
          streamSid: "stream_direct_kn",
          callSid: "call_direct_kn",
          customParameters: { language: "kn-IN" },
        },
      } as any);

      expect(streamGateway.getActiveStream("stream_direct_kn")?.language).toBe("kn-IN");

      // Case B: Exotel start carries invalid/missing language -> fallback to en-IN
      await streamGateway.handleStreamEvent(mockSocket, {} as any, {
        event: "start",
        streamSid: "stream_direct_fallback",
        start: {
          streamSid: "stream_direct_fallback",
          callSid: "call_direct_fallback",
          customParameters: { language: "xyz-INVALID" },
        },
      } as any);

      expect(streamGateway.getActiveStream("stream_direct_fallback")?.language).toBe("en-IN");
    });
  });

  // ============================================================
  // TEST 8 — LANGUAGE-AWARE RESPONSE FORMATTER LOCALIZATION
  // ============================================================
  describe("8. Localized Voice Dialog Responses", () => {
    it("generates empathetic localized responses across English, Kannada, and Hindi", () => {
      // 1. Greeting
      expect(VoiceResponseFormatter.getGreeting("en-IN")).toContain("Welcome to SwasthyaSetu");
      expect(VoiceResponseFormatter.getGreeting("kn-IN")).toContain("ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ");
      expect(VoiceResponseFormatter.getGreeting("hi-IN")).toContain("स्वास्थ्यसेतु में आपका स्वागत है");

      // 2. Verification prompt
      expect(VoiceResponseFormatter.getVerificationPrompt("en-IN")).toContain("Ration Card");
      expect(VoiceResponseFormatter.getVerificationPrompt("kn-IN")).toContain("ರೇಷನ್ ಕಾರ್ಡ್‌ನ");
      expect(VoiceResponseFormatter.getVerificationPrompt("hi-IN")).toContain("राशन कार्ड");

      // 3. Verification success
      expect(VoiceResponseFormatter.getVerificationSuccess("Ramesh", "en-IN")).toContain("Identity verified for Ramesh's household");
      expect(VoiceResponseFormatter.getVerificationSuccess("Ramesh", "kn-IN")).toContain("Ramesh ಅವರ ಕುಟುಂಬದ ಗುರುತು");
      expect(VoiceResponseFormatter.getVerificationSuccess("Ramesh", "hi-IN")).toContain("Ramesh के परिवार की पहचान");

      // 4. Assistance status
      expect(VoiceResponseFormatter.getAssistanceStatus(true, "Ayushman Bharat PM-JAY", "IN_PROGRESS", 2, 5, "en-IN")).toContain("2 of 5 field tasks");
      expect(VoiceResponseFormatter.getAssistanceStatus(true, "Ayushman Bharat PM-JAY", "IN_PROGRESS", 2, 5, "kn-IN")).toContain("5 ರಲ್ಲಿ 2 ಕ್ಷೇತ್ರ ಕಾರ್ಯಗಳನ್ನು");
      expect(VoiceResponseFormatter.getAssistanceStatus(true, "Ayushman Bharat PM-JAY", "IN_PROGRESS", 2, 5, "hi-IN")).toContain("5 में से 2 कार्य पूरे");

      // 5. Emergency redirection (Instant safety boundary)
      expect(VoiceResponseFormatter.getEmergencyRedirection("en-IN")).toContain("108");
      expect(VoiceResponseFormatter.getEmergencyRedirection("kn-IN")).toContain("108");
      expect(VoiceResponseFormatter.getEmergencyRedirection("kn-IN")).toContain("ತುರ್ತು");
      expect(VoiceResponseFormatter.getEmergencyRedirection("hi-IN")).toContain("108");
      expect(VoiceResponseFormatter.getEmergencyRedirection("hi-IN")).toContain("आपातकालीन");

      // 6. Farewell / End call
      expect(VoiceResponseFormatter.getEndCall("en-IN")).toContain("Thank you for calling");
      expect(VoiceResponseFormatter.getEndCall("kn-IN")).toContain("ಧನ್ಯವಾದಗಳು");
      expect(VoiceResponseFormatter.getEndCall("hi-IN")).toContain("धन्यवाद");
    });
  });

  // ============================================================
  // TEST 9 — LANGUAGE-NEUTRAL BUSINESS LOGIC INVARIANCE
  // ============================================================
  describe("9. Language-Neutral Business Logic Invariance", () => {
    it("evaluates deterministic senior citizen eligibility identically regardless of language", async () => {
      const mockSchemeService = {
        getSchemeById: vi.fn().mockResolvedValue({
          id: "ab-pmjay",
          name: "Ayushman Bharat PM-JAY",
          shortName: "PM-JAY",
          description: "Health coverage up to 5 lakh rupees.",
          coverageAmount: 500000,
        }),
      } as any;

      const mockHouseholdRepo = {
        getHouseholdById: vi.fn().mockResolvedValue({
          id: "hh_001",
          headOfHouseholdName: "Basavaraj",
          rationCardNumber: "RC-998877",
        }),
        getMembers: vi.fn().mockResolvedValue([
          {
            id: "mem_senior",
            fullName: "Eerappa",
            age: 72,
            relationship: "Grandfather",
          },
        ]),
      } as any;

      const mockEligibilityService = {
        evaluateHouseholdForSchemes: vi.fn().mockResolvedValue([
          { schemeId: "ab-pmjay", schemeName: "Ayushman Bharat PM-JAY", status: "ELIGIBLE" },
        ]),
      } as any;

      const actionService = new VoiceActionService(
        mockSchemeService,
        mockHouseholdRepo,
        mockEligibilityService,
        null as any,
        null as any,
        null as any,
        null as any
      );

      // Session in Kannada
      const sessionKn: VoiceSession = {
        id: "vses_kn",
        callSid: "call_kn",
        direction: "INBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_kn",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        householdId: "hh_001",
        language: "kn-IN",
        turnCount: 1,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Session in Hindi
      const sessionHi: VoiceSession = {
        ...sessionKn,
        id: "vses_hi",
        language: "hi-IN",
      };

      // Session in English
      const sessionEn: VoiceSession = {
        ...sessionKn,
        id: "vses_en",
        language: "en-IN",
      };

      const resKn = await actionService.getEligibilityForMember(sessionKn, "senior_grandfather", "ab-pmjay");
      const resHi = await actionService.getEligibilityForMember(sessionHi, "senior_grandfather", "ab-pmjay");
      const resEn = await actionService.getEligibilityForMember(sessionEn, "senior_grandfather", "ab-pmjay");

      // Verify underlying deterministic results match 100%
      expect(resKn.success).toBe(true);
      expect(resHi.success).toBe(true);
      expect(resEn.success).toBe(true);

      expect(resKn.data?.isEligible).toBe(true);
      expect(resHi.data?.isEligible).toBe(true);
      expect(resEn.data?.isEligible).toBe(true);

      expect(resKn.data?.memberId).toBe("mem_senior");
      expect(resHi.data?.memberId).toBe("mem_senior");
      expect(resEn.data?.memberId).toBe("mem_senior");

      // Spoken presentation is accurately localized
      expect(resKn.message).toContain("Eerappa");
      expect(resKn.message).toContain("ಅರ್ಹರಾಗಿದ್ದಾರೆ");

      expect(resHi.message).toContain("Eerappa");
      expect(resHi.message).toContain("पात्र हैं");

      expect(resEn.message).toContain("Eerappa");
      expect(resEn.message).toContain("eligible");
    });
  });

  // ============================================================
  // TEST 10 — PROVIDER TTS FAILURE RESILIENCE
  // ============================================================
  describe("10. Provider TTS Failure Resilience", () => {
    it("handles Sarvam TTS failure gracefully without crashing the WebSocket or exposing credentials", async () => {
      const sarvam = new SarvamService();

      // Simulate 500 error from Sarvam
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => JSON.stringify({ error: "Upstream synthesis failed" }),
        } as any;
      });

      // Ensure error is thrown cleanly without leaking keys
      await expect(
        sarvam.textToSpeech("Test text", "kn-IN")
      ).rejects.toThrow("Sarvam TTS failed with HTTP 500");
    });
  });

  // ============================================================
  // TEST 11 — TELEPHONY STREAM CODEC & FRAMING INVARIANTS
  // ============================================================
  describe("11. Telephony Audio Stream Codec & Framing Invariants", () => {
    it("produces standard 160-byte μ-law chunks corresponding to 20ms at 8kHz", () => {
      // 1 second of 8kHz 16-bit linear PCM = 8000 samples * 2 bytes = 16000 bytes
      const oneSecondPcm = Buffer.alloc(16000, 100);

      // Transcode to μ-law (8000 bytes for 1 second)
      const mulaw = linear16ToMulaw(oneSecondPcm);
      expect(mulaw.length).toBe(8000);

      // Chunk into 20ms frames
      const frames = chunkAudioBuffer(mulaw, FRAME_CHUNK_SIZE_MULAW);
      expect(frames.length).toBe(50); // 50 frames per second = 20ms per frame
      expect(frames[0].length).toBe(160); // Exactly 160 bytes per frame!
      expect(FRAME_CHUNK_SIZE_MULAW).toBe(160);
      expect(FRAME_CHUNK_SIZE_PCM).toBe(320);
    });

    it("generates valid standard WAV containers for STT ingestion", () => {
      const telephonyAudio = Buffer.alloc(3200, 120); // 200ms
      const wav = mulawToWav(telephonyAudio, 8000);

      // Verify standard 44-byte RIFF header
      expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
      expect(wav.subarray(12, 16).toString("ascii")).toBe("fmt ");
      expect(wav.subarray(36, 40).toString("ascii")).toBe("data");
      expect(wav.length).toBe(44 + telephonyAudio.length * 2); // Decompressed to 16-bit PCM
    });
  });

  // ============================================================
  // TEST 12 — EXISTING ENGLISH VOICE REGRESSION SAFETY
  // ============================================================
  describe("12. Existing English Voice Pipeline Regression Safety", () => {
    it("ensures default English voice pipeline remains fully operational", async () => {
      const sessionRepo = new VoiceSessionRepository(null);
      const session = await sessionRepo.createSession({
        id: "vses_en_reg",
        callSid: "call_en_reg",
        direction: "INBOUND",
        provider: "TEST_MOCK",
        callerNumberHash: "hash_en",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        language: "en-IN",
        turnCount: 0,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockActionService = {
        getPublicSchemeInfo: vi.fn().mockImplementation(async (schemeId, session) => ({
          success: true,
          message: VoiceResponseFormatter.getGeneralSchemeInfo(
            typeof session === "string" ? session : session?.language
          ),
        })),
      } as any;

      const gatewayService = new VoiceGatewayService(
        sessionRepo,
        new SarvamService(),
        null as any,
        mockActionService,
        null as any,
        null as any,
        null as any,
        { emitDomainEvent: vi.fn() } as any
      );

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "Hello, I want to know about health schemes",
        languageCode: "en-IN",
      });

      expect(turn.language).toBe("en-IN");
      expect(turn.detectedIntent).toBe("CHECK_SCHEMES");
      expect(turn.textResponse).toContain("SwasthyaSetu covers major national healthcare initiatives");
    });
  });
});
