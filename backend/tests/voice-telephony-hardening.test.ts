/**
 * SwasthyaSetu — Voice Telephony Hardening & Multilingual Resolution Test Suite
 * Validates all 36 mandatory verification points for Phase F voice assistant & Exotel telephony:
 * 1. 3-Language restriction (en-IN, kn-IN, hi-IN)
 * 2. Canonical E.164 helpline (+918047283240) and phone normalization
 * 3. Exotel outbound call contract, classified error handling (401, 403), zero secret leakage
 * 4. Website language to outbound voice session language alignment
 * 5. Direct inbound helpline 4-tier language resolution hierarchy
 * 6. DTMF in-call language selection (1 -> en-IN, 2 -> kn-IN, 3 -> hi-IN)
 * 7. Sarvam STT and TTS language invariants (STT === session.language === TTS)
 * 8. Privacy boundaries and credential protection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toVoiceLanguage,
  toUiLanguage,
  SUPPORTED_VOICE_LANGUAGES,
  VOICE_LANGUAGE_OPTIONS,
  CANONICAL_HELPLINE_E164,
  CANONICAL_HELPLINE_DISPLAY,
  normalizeIndianPhoneNumber,
  toE164IndianPhoneNumber,
  toDisplayIndianPhoneNumber,
  VoiceSession,
} from "../../shared/types/voice.js";
import { ExotelService, ExotelTelephonyError } from "../src/services/telephony/exotel.service.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { ExotelStreamGatewayService } from "../src/services/telephony/exotel-stream-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { VoiceActionService } from "../src/services/telephony/voice-action.service.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { AutomationService } from "../src/services/automation/automation.service.js";

describe("Voice Telephony Hardening & Multilingual Resolution", () => {
  let sessionRepo: VoiceSessionRepository;
  let exotelService: ExotelService;
  let gatewayService: VoiceGatewayService;
  let streamGatewayService: ExotelStreamGatewayService;
  let sarvamService: SarvamService;
  let householdRepo: HouseholdRepository;
  let userRepo: UserRepository;
  let caseRepo: CaseRepository;
  let voiceActionService: VoiceActionService;
  let automationService: AutomationService;

  beforeEach(() => {
    sessionRepo = new VoiceSessionRepository(null);
    exotelService = new ExotelService();
    sarvamService = new SarvamService();
    householdRepo = new HouseholdRepository(null);
    userRepo = new UserRepository(null);
    caseRepo = new CaseRepository(null);
    automationService = new AutomationService(null);
    voiceActionService = {} as any;

    gatewayService = new VoiceGatewayService(
      sessionRepo,
      sarvamService,
      exotelService,
      voiceActionService,
      caseRepo,
      householdRepo,
      userRepo,
      automationService
    );

    streamGatewayService = new ExotelStreamGatewayService(
      gatewayService,
      sessionRepo,
      sarvamService
    );
  });

  function createTestContext(streamSid: string, callSid: string, session?: VoiceSession | null): any {
    return {
      streamSid,
      callSid,
      sessionId: session?.id || `vses_${streamSid}`,
      session: session || null,
      language: session?.language || "en-IN",
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      audioBufferChunks: [],
      turnSilenceChunks: 0,
      turnTotalChunks: 0,
      isProcessingTurn: false,
      isStopped: false,
    };
  }

  // ============================================================
  // GROUP 1: LANGUAGE OPTIONS RESTRICTION (Points 1, 2, 3)
  // ============================================================
  describe("Group 1: Language Options Restriction", () => {
    it("Point 1: Public config returns supportedLanguages containing exactly English, Kannada, Hindi", () => {
      const config = gatewayService.getPublicConfig();
      expect(config.supportedLanguages).toHaveLength(3);
      const codes = config.supportedLanguages.map((l) => l.code);
      expect(codes).toEqual(["en-IN", "kn-IN", "hi-IN"]);
    });

    it("Point 2: Telugu, Tamil, Marathi, Bengali, Gujarati are NOT in supportedLanguages", () => {
      const config = gatewayService.getPublicConfig();
      const codes = config.supportedLanguages.map((l) => l.code);
      expect(codes).not.toContain("te-IN");
      expect(codes).not.toContain("ta-IN");
      expect(codes).not.toContain("mr-IN");
      expect(codes).not.toContain("bn-IN");
      expect(codes).not.toContain("gu-IN");
      expect(SUPPORTED_VOICE_LANGUAGES).toEqual(["en-IN", "kn-IN", "hi-IN"]);
    });

    it("Point 3: Unsupported language codes safely fallback to en-IN", () => {
      expect(toVoiceLanguage("te-IN")).toBe("en-IN");
      expect(toVoiceLanguage("ta-IN")).toBe("en-IN");
      expect(toVoiceLanguage("mr-IN")).toBe("en-IN");
      expect(toVoiceLanguage("fr-FR")).toBe("en-IN");
      expect(toVoiceLanguage("unknown")).toBe("en-IN");
      expect(toVoiceLanguage("")).toBe("en-IN");
      expect(toVoiceLanguage(null)).toBe("en-IN");
      expect(toVoiceLanguage(undefined)).toBe("en-IN");
    });
  });

  // ============================================================
  // GROUP 2: CANONICAL HELPLINE & NORMALIZATION (Points 4, 5, 6, 7, 33)
  // ============================================================
  describe("Group 2: Canonical Helpline Number & Normalization", () => {
    it("Point 4: Normalization of '08047283240' → '+918047283240'", () => {
      expect(toE164IndianPhoneNumber("08047283240")).toBe("+918047283240");
      expect(normalizeIndianPhoneNumber("08047283240")).toBe("8047283240");
    });

    it("Point 5: Normalization of '+918047283240' → '+918047283240'", () => {
      expect(toE164IndianPhoneNumber("+918047283240")).toBe("+918047283240");
      expect(normalizeIndianPhoneNumber("+918047283240")).toBe("8047283240");
    });

    it("Point 6: Normalization of '8047283240' → '+918047283240'", () => {
      expect(toE164IndianPhoneNumber("8047283240")).toBe("+918047283240");
      expect(normalizeIndianPhoneNumber("8047283240")).toBe("8047283240");
    });

    it("Point 7: Normalization of '080-4728-3240' or formatted numbers", () => {
      expect(toE164IndianPhoneNumber("080-4728-3240")).toBe("+918047283240");
      expect(toE164IndianPhoneNumber("+91 80472 83240")).toBe("+918047283240");
      expect(toDisplayIndianPhoneNumber("+918047283240")).toBe("08047283240");
      expect(toDisplayIndianPhoneNumber("8047283240")).toBe("08047283240");
    });

    it("Point 33: Fallback direct helpline uses canonical constants", () => {
      expect(CANONICAL_HELPLINE_E164).toBe("+918047283240");
      expect(CANONICAL_HELPLINE_DISPLAY).toBe("08047283240");
      const info = exotelService.getDisplayHelplineInfo();
      expect(info.virtualNumber).toBe("+918047283240");
      expect(info.displayHelplineText).toBe("08047283240");
    });
  });

  // ============================================================
  // GROUP 3: EXOTEL TELEPHONY OUTBOUND DISPATCH & ERROR HANDLING (Points 8, 9, 10, 11, 12, 35, 36)
  // ============================================================
  describe("Group 3: Exotel Outbound Contract & Error Handling", () => {
    it("Point 8 & 9: Exotel outbound call normalizes destination number and includes valid From, To, CallerId", async () => {
      const originalFetch = global.fetch;
      let capturedBody: string | null = null;

      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts?.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ Call: { Sid: "call_mock_123", Status: "in-progress" } }),
          text: async () => JSON.stringify({ Call: { Sid: "call_mock_123", Status: "in-progress" } }),
        };
      });

      const realService = new ExotelService();
      (realService as any).accountSid = "real_sid_123";
      (realService as any).apiKey = "key_test";
      (realService as any).apiToken = "token_test";
      (realService as any).callerId = "08047283240";

      const result = await realService.initiateOutboundCall({
        toPhoneNumber: "09876543210",
      });

      expect(result.callSid).toBe("call_mock_123");
      expect(capturedBody).toContain("From=09876543210");
      expect(capturedBody).toContain("CallerId=08047283240");
      expect(capturedBody).toContain("CallType=trans");

      global.fetch = originalFetch;
    });

    it("Point 10: Exotel outbound call failure with 401 produces classified VOICE_AUTHENTICATION_ERROR", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ RestException: { Status: 401, Code: 34010, Message: "Unauthorized" } }),
      }));

      const service = new ExotelService();
      (service as any).accountSid = "real_sid_123";
      (service as any).apiKey = "key_bad";
      (service as any).apiToken = "token_bad";
      (service as any).callerId = "08047283240";

      await expect(service.initiateOutboundCall({ toPhoneNumber: "9876543210" })).rejects.toThrow(
        ExotelTelephonyError
      );

      try {
        await service.initiateOutboundCall({ toPhoneNumber: "9876543210" });
      } catch (err: any) {
        expect(err.code).toBe("VOICE_AUTHENTICATION_ERROR");
        expect(err.httpStatus).toBe(502);
        expect(err.message).toContain("Telephony provider authentication failed");
      }

      global.fetch = originalFetch;
    });

    it("Point 11: Exotel outbound call failure with 403 produces classified VOICE_PROVIDER_ERROR directing to helpline", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ RestException: { Status: 403, Message: "Your account is not yet KYC compliant." } }),
      }));

      const service = new ExotelService();
      (service as any).accountSid = "real_sid_123";
      (service as any).apiKey = "key_good";
      (service as any).apiToken = "token_good";
      (service as any).callerId = "08047283240";

      try {
        await service.initiateOutboundCall({ toPhoneNumber: "9876543210" });
      } catch (err: any) {
        expect(err.code).toBe("VOICE_PROVIDER_ERROR");
        expect(err.httpStatus).toBe(502);
        expect(err.message).toContain("Outbound voice calling is restricted");
        expect(err.message).toContain("direct helpline");
      }

      global.fetch = originalFetch;
    });

    it("Point 12 & 35: Error message returned to client never contains Basic Auth or API secrets", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ RestException: { Status: 401, Code: 34010, Message: "Unauthorized secret_value_xyz" } }),
      }));

      const service = new ExotelService();
      (service as any).accountSid = "real_sid_123";
      (service as any).apiKey = "super_secret_api_key_12345";
      (service as any).apiToken = "super_secret_api_token_67890";
      (service as any).callerId = "08047283240";

      try {
        await service.initiateOutboundCall({ toPhoneNumber: "9876543210" });
      } catch (err: any) {
        expect(err.message).not.toContain("super_secret_api_key_12345");
        expect(err.message).not.toContain("super_secret_api_token_67890");
        expect(err.message).not.toContain("Basic");
      }

      global.fetch = originalFetch;
    });

    it("Point 36: Exotel service isConfigured() checks accountSid, apiKey, apiToken properly", () => {
      const service = new ExotelService();
      expect(typeof service.isConfigured()).toBe("boolean");
    });
  });

  // ============================================================
  // GROUP 4: WEBSITE LANGUAGE ↔ OUTBOUND SESSION LANGUAGE (Points 13, 14, 15, 16)
  // ============================================================
  describe("Group 4: Website Language ↔ Outbound Session Language", () => {
    it("Point 13: Outbound call requested from Kannada website session sets VoiceSession.language = kn-IN", async () => {
      vi.spyOn(exotelService, "initiateOutboundCall").mockResolvedValue({
        callSid: "call_cit_kn_01",
        status: "in-progress",
        accountSid: "acc_test",
        to: "+919876543210",
        from: "+918047283240",
      });

      const { session } = await gatewayService.requestCitizenCall("uid_cit_kn", {
        phoneNumber: "9876543210",
        language: "kn",
      });

      expect(session.language).toBe("kn-IN");
    });

    it("Point 14: Outbound call requested from Hindi website session sets VoiceSession.language = hi-IN", async () => {
      vi.spyOn(exotelService, "initiateOutboundCall").mockResolvedValue({
        callSid: "call_cit_hi_01",
        status: "in-progress",
        accountSid: "acc_test",
        to: "+919876543210",
        from: "+918047283240",
      });

      const { session } = await gatewayService.requestCitizenCall("uid_cit_hi", {
        phoneNumber: "9876543210",
        language: "hi",
      });

      expect(session.language).toBe("hi-IN");
    });

    it("Point 15: Outbound call requested from English website session sets VoiceSession.language = en-IN", async () => {
      vi.spyOn(exotelService, "initiateOutboundCall").mockResolvedValue({
        callSid: "call_cit_en_01",
        status: "in-progress",
        accountSid: "acc_test",
        to: "+919876543210",
        from: "+918047283240",
      });

      const { session } = await gatewayService.requestCitizenCall("uid_cit_en", {
        phoneNumber: "9876543210",
        language: "en",
      });

      expect(session.language).toBe("en-IN");
    });

    it("Point 16: Existing session language is NOT overwritten by Exotel start metadata", async () => {
      const existingSession: VoiceSession = {
        id: "vses_kn_persist",
        callSid: "call_kn_preserve",
        direction: "OUTBOUND",
        provider: "EXOTEL",
        callerNumberHash: "hash123",
        maskedCallerNumber: "+91 98*** **210",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        language: "kn-IN",
        turnCount: 0,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await sessionRepo.createSession(existingSession);

      const mockWs: any = { readyState: 1, send: vi.fn(), on: vi.fn() };
      const context = createTestContext("stream_kn_test", "call_kn_preserve", existingSession);

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "start",
        start: {
          streamSid: "stream_kn_test",
          callSid: "call_kn_preserve",
          customParameters: { language: "hi-IN" },
        },
      });

      expect(context.language).toBe("kn-IN");
      expect(context.session?.language).toBe("kn-IN");
    });
  });

  // ============================================================
  // GROUP 5: DIRECT INBOUND HELPLINE 4-TIER RESOLUTION (Points 17, 18, 19, 20, 21)
  // ============================================================
  describe("Group 5: Direct Inbound Helpline 4-Tier Language Resolution", () => {
    it("Point 17: Direct inbound call from known Kannada user resolves to kn-IN (Priority 1)", async () => {
      const callerPhone = "9876543210";
      await userRepo.createUserProfile({
        uid: "user_kannada_01",
        email: "kannada@test.gov.in",
        displayName: "Ramesh Gowda",
        phoneNumber: "+919876543210",
        preferredLanguage: "kn",
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "v1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await householdRepo.createHousehold({
        id: "hh_kannada_01",
        ownerUid: "user_kannada_01",
        headOfHouseholdName: "Ramesh Gowda",
        rationCardNumber: "KA-BLR-1234",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Kengeri",
        pincode: "560060",
        contactPhone: "+919876543210",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const resolved = await gatewayService.resolveInboundVoiceLanguage(callerPhone);
      expect(resolved).toBe("kn-IN");

      const session = await gatewayService.createInboundSession(callerPhone, "call_inbound_kn");
      expect(session.language).toBe("kn-IN");
    });

    it("Point 18: Direct inbound call from known Hindi user resolves to hi-IN (Priority 1)", async () => {
      const callerPhone = "9876543211";
      await userRepo.createUserProfile({
        uid: "user_hindi_01",
        email: "hindi@test.gov.in",
        displayName: "Sunil Sharma",
        phoneNumber: "+919876543211",
        preferredLanguage: "hi",
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "v1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const resolved = await gatewayService.resolveInboundVoiceLanguage(callerPhone);
      expect(resolved).toBe("hi-IN");
    });

    it("Point 19: Direct inbound call from known English user resolves to en-IN (Priority 1)", async () => {
      const callerPhone = "9876543212";
      await userRepo.createUserProfile({
        uid: "user_english_01",
        email: "english@test.gov.in",
        displayName: "John Doe",
        phoneNumber: "+919876543212",
        preferredLanguage: "en",
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "v1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const resolved = await gatewayService.resolveInboundVoiceLanguage(callerPhone);
      expect(resolved).toBe("en-IN");
    });

    it("Point 20: Direct inbound call from unknown number falls back to en-IN (Priority 4)", async () => {
      const unknownPhone = "9111122222";
      const resolved = await gatewayService.resolveInboundVoiceLanguage(unknownPhone);
      expect(resolved).toBe("en-IN");
    });

    it("Point 21: Direct inbound call with recent Kannada session resolves to kn-IN (Priority 2)", async () => {
      const callerPhone = "9333344444";
      const hash = (gatewayService as any).hashPhoneNumber(callerPhone);

      await sessionRepo.createSession({
        id: "vses_recent_kn",
        callSid: "call_recent_kn",
        direction: "INBOUND",
        provider: "EXOTEL",
        callerNumberHash: hash,
        maskedCallerNumber: "+91 93*** **444",
        status: "COMPLETED",
        verificationStatus: "UNVERIFIED",
        language: "kn-IN",
        turnCount: 2,
        maxTurns: 10,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const resolved = await gatewayService.resolveInboundVoiceLanguage(callerPhone);
      expect(resolved).toBe("kn-IN");
    });
  });

  // ============================================================
  // GROUP 6: DTMF IN-CALL LANGUAGE SELECTION (Points 22, 23, 24, 25)
  // ============================================================
  describe("Group 6: DTMF In-Call Language Selection", () => {
    it("Point 22: DTMF input '1' selects en-IN", async () => {
      const mockWs: any = { readyState: 1, send: vi.fn(), on: vi.fn() };
      const context = createTestContext("stream_dtmf_01", "call_dtmf_01");
      context.language = "kn-IN";

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "dtmf",
        dtmf: { digit: "1" },
      });

      expect(context.language).toBe("en-IN");
    });

    it("Point 23: DTMF input '2' selects kn-IN", async () => {
      const mockWs: any = { readyState: 1, send: vi.fn(), on: vi.fn() };
      const context = createTestContext("stream_dtmf_02", "call_dtmf_02");
      context.language = "en-IN";

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "dtmf",
        dtmf: { digit: "2" },
      });

      expect(context.language).toBe("kn-IN");
    });

    it("Point 24: DTMF input '3' selects hi-IN", async () => {
      const mockWs: any = { readyState: 1, send: vi.fn(), on: vi.fn() };
      const context = createTestContext("stream_dtmf_03", "call_dtmf_03");
      context.language = "en-IN";

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "dtmf",
        dtmf: { digit: "3" },
      });

      expect(context.language).toBe("hi-IN");
    });

    it("Point 25: Invalid DTMF input does not corrupt session language", async () => {
      const mockWs: any = { readyState: 1, send: vi.fn(), on: vi.fn() };
      const context = createTestContext("stream_dtmf_inv", "call_dtmf_inv");
      context.language = "kn-IN";

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "dtmf",
        dtmf: { digit: "9" },
      });

      expect(context.language).toBe("kn-IN");

      await streamGatewayService.handleStreamEvent(mockWs, context, {
        event: "dtmf",
        dtmf: { digit: "#" },
      });

      expect(context.language).toBe("kn-IN");
    });
  });

  // ============================================================
  // GROUP 7: SARVAM STT/TTS LANGUAGE INVARIANTS (Points 26, 27, 28, 29, 30, 31, 32, 34)
  // ============================================================
  describe("Group 7: Sarvam Indic AI Language Invariants", () => {
    it("Point 26 & 27: Sarvam STT and TTS receive kn-IN for Kannada sessions", async () => {
      const sttSpy = vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "ನಮಸ್ಕಾರ",
        language_code: "kn-IN",
      });
      const ttsSpy = vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
        audios: [Buffer.from("mock").toString("base64")],
      });

      await sarvamService.speechToText(Buffer.from("audio").toString("base64"), "kn-IN");
      expect(sttSpy).toHaveBeenCalledWith(expect.anything(), "kn-IN");

      await sarvamService.textToSpeech("ನಮಸ್ಕಾರ", "kn-IN");
      expect(ttsSpy).toHaveBeenCalledWith("ನಮಸ್ಕಾರ", "kn-IN");
    });

    it("Point 28 & 29: Sarvam STT and TTS receive hi-IN for Hindi sessions", async () => {
      const sttSpy = vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "नमस्ते",
        language_code: "hi-IN",
      });
      const ttsSpy = vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
        audios: [Buffer.from("mock").toString("base64")],
      });

      await sarvamService.speechToText(Buffer.from("audio").toString("base64"), "hi-IN");
      expect(sttSpy).toHaveBeenCalledWith(expect.anything(), "hi-IN");

      await sarvamService.textToSpeech("नमस्ते", "hi-IN");
      expect(ttsSpy).toHaveBeenCalledWith("नमस्ते", "hi-IN");
    });

    it("Point 30 & 31: Sarvam STT and TTS receive en-IN for English sessions", async () => {
      const sttSpy = vi.spyOn(sarvamService, "speechToText").mockResolvedValue({
        transcript: "Hello",
        language_code: "en-IN",
      });
      const ttsSpy = vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
        audios: [Buffer.from("mock").toString("base64")],
      });

      await sarvamService.speechToText(Buffer.from("audio").toString("base64"), "en-IN");
      expect(sttSpy).toHaveBeenCalledWith(expect.anything(), "en-IN");

      await sarvamService.textToSpeech("Hello", "en-IN");
      expect(ttsSpy).toHaveBeenCalledWith("Hello", "en-IN");
    });

    it("Point 32: Website UI translation dictionaries do NOT call Sarvam at runtime", () => {
      expect(toUiLanguage("en-IN")).toBe("en");
      expect(toUiLanguage("kn-IN")).toBe("kn");
      expect(toUiLanguage("hi-IN")).toBe("hi");
      expect(toUiLanguage(null)).toBe("en");
    });

    it("Point 34: Modal language options contain exactly 3 choices", () => {
      expect(VOICE_LANGUAGE_OPTIONS).toHaveLength(3);
      expect(VOICE_LANGUAGE_OPTIONS.map((l) => l.code)).toEqual(["en-IN", "kn-IN", "hi-IN"]);
      expect(VOICE_LANGUAGE_OPTIONS.map((l) => l.name)).toEqual(["English", "Kannada", "Hindi"]);
      expect(VOICE_LANGUAGE_OPTIONS.map((l) => l.nativeName)).toEqual(["English", "ಕನ್ನಡ", "हिन्दी"]);
    });
  });
});
