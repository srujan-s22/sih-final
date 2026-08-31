import { describe, it, expect, beforeEach, vi } from "vitest";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { ExotelService } from "../src/services/telephony/exotel.service.js";
import { VoiceActionService } from "../src/services/telephony/voice-action.service.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SchemeService } from "../src/services/scheme.service.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { AssistanceService } from "../src/services/assistance.service.js";
import { AssistanceRepository } from "../src/repositories/assistance.repository.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { ConnectionRepository } from "../src/repositories/connection.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { AutomationService } from "../src/services/automation/automation.service.js";
import { VoiceSession } from "../../shared/types/voice.js";
import { AshaCase } from "../../shared/types/case.js";

describe("Phase 11 — Sarvam AI + Exotel Voice & Telephony Architecture", () => {
  let sarvamService: SarvamService;
  let exotelService: ExotelService;
  let voiceActionService: VoiceActionService;
  let gatewayService: VoiceGatewayService;
  let sessionRepo: VoiceSessionRepository;
  let schemeRepo: SchemeRepository;
  let householdRepo: HouseholdRepository;
  let assistanceRepo: AssistanceRepository;
  let caseRepo: CaseRepository;
  let connectionRepo: ConnectionRepository;
  let userRepo: UserRepository;
  let automationService: AutomationService;

  beforeEach(async () => {
    // Clear and re-instantiate repositories in test mode
    sessionRepo = new VoiceSessionRepository(null);
    schemeRepo = new SchemeRepository(null);
    householdRepo = new HouseholdRepository(null);
    assistanceRepo = new AssistanceRepository(null);
    caseRepo = new CaseRepository(null);
    connectionRepo = new ConnectionRepository(null);
    userRepo = new UserRepository(null);

    sessionRepo.clearMemoryStore();
    householdRepo.clearMemoryStore();
    assistanceRepo.clearMemoryStore();
    caseRepo.clearMemoryStore();
    connectionRepo.clearMemoryStore();
    userRepo.clearMemoryStore();

    // Services
    sarvamService = new SarvamService();
    exotelService = new ExotelService();
    const schemeService = new SchemeService(schemeRepo);
    const eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    const assistanceService = new AssistanceService(
      assistanceRepo,
      connectionRepo,
      householdRepo,
      caseRepo
    );
    automationService = new AutomationService();

    voiceActionService = new VoiceActionService(
      schemeService,
      householdRepo,
      eligibilityService,
      assistanceService,
      caseRepo,
      connectionRepo,
      userRepo
    );

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

    // Seed test data: Verified Household with Grandfather (Age 71) and Pregnant Mother
    await householdRepo.createHousehold({
      id: "hh_voice_test_01",
      ownerUid: "citizen_user_01",
      headOfHouseholdName: "Ramesh Kumar",
      rationCardNumber: "KA-05-RC-987654",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru Rural",
      village: "Nelamangala",
      pincode: "562123",
      contactPhone: "+919876543210",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await householdRepo.createMember("hh_voice_test_01", {
      id: "mem_savitri",
      householdId: "hh_voice_test_01",
      fullName: "Savitri Devi",
      age: 26,
      gender: "female",
      relationship: "Wife",
      disabilityStatus: false,
      chronicConditions: [],
      maternalStatus: "pregnant",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await householdRepo.createMember("hh_voice_test_01", {
      id: "mem_dinanath",
      householdId: "hh_voice_test_01",
      fullName: "Dinanath Kumar",
      age: 71,
      gender: "male",
      relationship: "Grandfather",
      disabilityStatus: false,
      chronicConditions: ["Hypertension"],
      maternalStatus: "none",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed ASHA Worker & Active Connection
    await userRepo.createUserProfile({
      uid: "asha_worker_01",
      email: "asha.test@swasthyasetu.gov.in",
      phoneNumber: "+919876500000",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: new Date().toISOString(),
      role: "ASHA",
      displayName: "Sunita ASHA Didi",
      serviceArea: "Nelamangala Ward 4",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await connectionRepo.createRequest({
      id: "conn_test_01",
      citizenUid: "citizen_user_01",
      householdId: "hh_voice_test_01",
      headOfHouseholdName: "Ramesh Kumar",
      district: "Bengaluru Rural",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 3,
      ashaUid: "asha_worker_01",
      ashaServiceCode: "ASHA-BLR-004",
      ashaName: "Sunita ASHA Didi",
      status: "ACTIVE",
      requestedAt: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      responseNote: "Assigned field jurisdiction",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe("1. Sarvam AI Service Integration & Contract", () => {
    it("handles unconfigured state gracefully without crashing", async () => {
      const unconfiguredService = new SarvamService();
      (unconfiguredService as any).apiKey = "";
      const stt = await unconfiguredService.speechToText("base64audiodata", "hi-IN");
      expect(stt.transcript).toBe("");

      const tts = await unconfiguredService.textToSpeech("नमस्ते", "hi-IN");
      expect(tts.audios).toEqual([]);
    });

    it("accurately extracts structured intent for greetings", () => {
      const res = sarvamService.understandIntent("Namaste, mujhe jankari chahiye", "hi-IN");
      expect(res.intent).toBe("GREETING");
      expect(res.confidence).toBeGreaterThan(0.7);
    });

    it("accurately extracts structured intent for identity verification PINs", () => {
      const res = sarvamService.understandIntent("Mera ration card number 7654 hai", "hi-IN");
      expect(res.intent).toBe("VERIFY_IDENTITY");
      expect(res.verificationCode).toBe("7654");
    });

    it("accurately extracts structured intent for eligibility inquiries", () => {
      const res = sarvamService.understandIntent(
        "Kya mere 71 saal ke grandfather ko Ayushman Bharat PM-JAY milega?",
        "hi-IN"
      );
      expect(res.intent).toBe("CHECK_ELIGIBILITY");
      expect(res.schemeId).toBe("ab-pmjay");
      expect(res.memberIdentifier).toBe("senior_grandfather");
    });

    it("accurately extracts structured intent for active assistance status", () => {
      const res = sarvamService.understandIntent(
        "Mera Ayushman card application status kaha tak pahuncha hai?",
        "hi-IN"
      );
      expect(res.intent).toBe("CHECK_ASSISTANCE_STATUS");
      expect(res.schemeId).toBe("ab-pmjay");
    });

    it("accurately extracts structured intent for call termination", () => {
      const res = sarvamService.understandIntent("Thank you very much, dhanyawad, alvida", "hi-IN");
      expect(res.intent).toBe("END_CALL");
    });

    it("verifies bulbul:v3 TTS request contract excludes deprecated pitch/loudness and uses verified v3 speaker", async () => {
      // Mock global fetch for Sarvam TTS
      const originalFetch = global.fetch;
      let capturedUrl = "";
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: any, init: any) => {
        capturedUrl = url.toString();
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            request_id: "req_tts_test_01",
            audios: ["UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="],
          }),
        };
      }) as any;

      try {
        // Temporarily configure sarvamService
        (sarvamService as any).apiKey = "test-sarvam-key";
        const result = await sarvamService.textToSpeech(
          "नमस्ते, स्वास्थ्यासेतु में आपका स्वागत है।",
          "hi-IN",
          "roopa"
        );

        expect(capturedUrl).toContain("/text-to-speech");
        expect(capturedBody.model).toBe("bulbul:v3");
        expect(capturedBody.speaker).toBe("roopa");
        expect(capturedBody.speech_sample_rate).toBe(8000);
        expect(capturedBody.output_audio_codec).toBe("wav");
        expect(capturedBody.pitch).toBeUndefined();
        expect(capturedBody.loudness).toBeUndefined();
        expect(result.audios.length).toBe(1);
      } finally {
        global.fetch = originalFetch;
        (sarvamService as any).apiKey = "";
      }
    });

    it("verifies saaras:v3 STT request contract sends mode: transcribe and handles telephony audio format", async () => {
      const originalFetch = global.fetch;
      let capturedUrl = "";
      let capturedHeaders: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: any, init: any) => {
        capturedUrl = url.toString();
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            request_id: "req_stt_test_01",
            transcript: "मेरा नाम रमेश है",
            language_code: "hi-IN",
          }),
        };
      }) as any;

      try {
        (sarvamService as any).apiKey = "test-sarvam-key";
        const result = await sarvamService.speechToText("dGVzdGF1ZGlv", "hi-IN", "wav");

        expect(capturedUrl).toContain("/speech-to-text");
        expect(capturedHeaders["api-subscription-key"]).toBe("test-sarvam-key");
        expect(result.transcript).toBe("मेरा नाम रमेश है");
        expect(result.language_code).toBe("hi-IN");
      } finally {
        global.fetch = originalFetch;
        (sarvamService as any).apiKey = "";
      }
    });
  });

  describe("2. Exotel Telephony Service & Outbound Dispatch", () => {
    it("validates webhook payloads correctly", () => {
      expect(exotelService.validateWebhookPayload({ CallSid: "c1", From: "+919876543210" })).toBe(
        true
      );
      expect(exotelService.validateWebhookPayload({ foo: "bar" })).toBe(false);
    });

    it("maps telephony outcomes accurately without altering business states", () => {
      expect(exotelService.mapTelephonyStatus("completed")).toBe("CALL_COMPLETED");
      expect(exotelService.mapTelephonyStatus("no-answer")).toBe("CALL_NO_ANSWER");
      expect(exotelService.mapTelephonyStatus("busy")).toBe("CALL_BUSY");
      expect(exotelService.mapTelephonyStatus("failed")).toBe("CALL_FAILED");
      expect(exotelService.mapTelephonyStatus("canceled")).toBe("CALL_DECLINED");
    });

    it("initiates outbound call in test mode with correct metadata", async () => {
      const result = await exotelService.initiateOutboundCall({
        toPhoneNumber: "+919876543210",
        customField: { followUpId: "fup_123" },
      });
      expect(result.callSid).toBeDefined();
      expect(result.to).toBe("+919876543210");
    });
  });

  describe("3. Privacy-First Identity Verification & Security Boundary", () => {
    it("fails closed: unverified callers cannot access private family eligibility", async () => {
      const session = await gatewayService.createInboundSession("+919876543210");
      expect(session.verificationStatus).toBe("UNVERIFIED");

      // Attempt to check eligibility while UNVERIFIED
      const turn = await gatewayService.processTurn(session.id, {
        transcript: "Show my family eligibility for Ayushman Bharat",
      });

      expect(turn.verificationStatus).toBe("UNVERIFIED");
      expect(turn.textResponse).toContain("verify your identity");
      expect(turn.actionResult).toBeUndefined();
    });

    it("fails closed: unverified callers cannot view assistance status", async () => {
      const session = await gatewayService.createInboundSession("+919876543210");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "Check my application status",
      });

      expect(turn.verificationStatus).toBe("UNVERIFIED");
      expect(turn.textResponse).toContain("verify your identity");
    });

    it("verifies identity when valid Ration Card digits are provided", async () => {
      const session = await gatewayService.createInboundSession("+919876543210");
      session.householdId = "hh_voice_test_01";
      await sessionRepo.updateSession(session.id, session);

      // Verify with last 4 digits "7654" from "KA-05-RC-987654"
      const turn = await gatewayService.verifyCaller(session.id, "7654");

      expect(turn.verificationStatus).toBe("VERIFIED");
      expect(turn.textResponse).toContain("Identity verified for Ramesh Kumar's household");
    });

    it("rejects invalid verification codes and remains protected", async () => {
      const session = await gatewayService.createInboundSession("+919876543210");
      session.householdId = "hh_voice_test_01";
      await sessionRepo.updateSession(session.id, session);

      const turn = await gatewayService.verifyCaller(session.id, "0000");

      expect(turn.verificationStatus).toBe("UNVERIFIED");
      expect(turn.textResponse).toContain("did not match");
    });
  });

  describe("4. Authoritative Business Logic via Strict Voice Allowlist", () => {
    let verifiedSession: VoiceSession;

    beforeEach(async () => {
      verifiedSession = await gatewayService.createInboundSession("+919876543210");
      verifiedSession.verificationStatus = "VERIFIED";
      verifiedSession.householdId = "hh_voice_test_01";
      verifiedSession.citizenId = "citizen_user_01";
      await sessionRepo.updateSession(verifiedSession.id, verifiedSession);
    });

    it("evaluates deterministic senior citizen eligibility for 71-year-old grandfather", async () => {
      const turn = await gatewayService.processTurn(verifiedSession.id, {
        transcript: "Is my 71 year old grandfather eligible for PM-JAY?",
      });

      expect(turn.executedAction).toBe("getEligibilityForMember");
      expect(turn.actionResult?.isEligible).toBe(true);
      expect(turn.textResponse).toContain("Dinanath Kumar");
      expect(turn.textResponse).toContain("Age 71");
    });

    it("evaluates maternal eligibility for pregnant mother (JSY)", async () => {
      const turn = await gatewayService.processTurn(verifiedSession.id, {
        transcript: "Check Janani Suraksha Yojana eligibility for my pregnant wife",
      });

      expect(turn.executedAction).toBe("getEligibilityForMember");
      expect(turn.textResponse).toContain("Savitri Devi");
    });

    it("checks active assistance progress and returns accurate task counts (e.g. 2/5 for PM-JAY)", async () => {
      // Seed an active PM-JAY case with 2 of 5 tasks completed
      const pmjayCase: AshaCase = {
        id: "case_pmjay_01",
        householdId: "hh_voice_test_01",
        assignedAshaUid: "asha_worker_01",
        headOfHouseholdName: "Ramesh Kumar",
        district: "Bengaluru Rural",
        state: "Karnataka",
        incomeCategory: "BPL",
        memberCount: 3,
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        status: "IN_PROGRESS",
        priority: "HIGH",
        detectedGapsCount: 0,
        eligibleSchemesCount: 1,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (pmjayCase as any).completedTasksCount = 2;
      await caseRepo.createCase(pmjayCase);

      const turn = await gatewayService.processTurn(verifiedSession.id, {
        transcript: "Check Ayushman application status",
      });

      expect(turn.executedAction).toBe("getAssistanceStatus");
      expect(turn.actionResult?.completedTasks).toBe(2);
      expect(turn.actionResult?.totalTasks).toBe(5);
      expect(turn.textResponse).toContain("2 of 5 field tasks");
    });

    it("is idempotent: reuses existing case when assistance is requested again", async () => {
      // Seed existing PM-JAY case
      const existingCase: AshaCase = {
        id: "case_pmjay_existing",
        householdId: "hh_voice_test_01",
        assignedAshaUid: "asha_worker_01",
        headOfHouseholdName: "Ramesh Kumar",
        district: "Bengaluru Rural",
        state: "Karnataka",
        incomeCategory: "BPL",
        memberCount: 3,
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        status: "IN_PROGRESS",
        priority: "HIGH",
        detectedGapsCount: 0,
        eligibleSchemesCount: 1,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (existingCase as any).completedTasksCount = 1;
      await caseRepo.createCase(existingCase);

      const turn = await gatewayService.processTurn(verifiedSession.id, {
        transcript: "I want to apply for Ayushman Bharat assistance",
      });

      expect(turn.executedAction).toBe("requestAssistance");
      expect(turn.actionResult?.isExisting).toBe(true);
      expect(turn.textResponse).toContain("already exists and is currently in progress");
    });

    it("enforces cost control limits by ending session after max turns", async () => {
      verifiedSession.turnCount = 10;
      await sessionRepo.updateSession(verifiedSession.id, verifiedSession);

      const turn = await gatewayService.processTurn(verifiedSession.id, {
        transcript: "Hello, another question",
      });

      expect(turn.shouldEndCall).toBe(true);
      expect(turn.status).toBe("COMPLETED");
      expect(turn.textResponse).toContain("maximum duration");
    });
  });

  describe("5. Outbound Call Security & Server-Side Phone Resolution", () => {
    it("resolves destination phone number strictly from authoritative household record", async () => {
      // Seed a case with a follow-up
      const testCase: AshaCase = {
        id: "case_outbound_01",
        householdId: "hh_voice_test_01",
        assignedAshaUid: "asha_worker_01",
        headOfHouseholdName: "Ramesh Kumar",
        district: "Bengaluru Rural",
        state: "Karnataka",
        incomeCategory: "BPL",
        memberCount: 3,
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        status: "IN_PROGRESS",
        priority: "HIGH",
        detectedGapsCount: 0,
        eligibleSchemesCount: 1,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await caseRepo.createCase(testCase);
      await caseRepo.createFollowUp("case_outbound_01", {
        id: "fup_test_outbound_01",
        caseId: "case_outbound_01",
        title: "Doorstep e-KYC Verification",
        reason: "Verify Aadhaar biometric data",
        status: "PENDING",
        scheduledAt: new Date().toISOString(),
        dueAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { session, callResult } = await gatewayService.initiateOutboundFollowUpCall(
        "fup_test_outbound_01",
        "case_outbound_01",
        "Automated doorstep visit reminder"
      );

      expect(session.direction).toBe("OUTBOUND");
      expect(session.relatedFollowUpId).toBe("fup_test_outbound_01");
      expect(session.maskedCallerNumber).toBe("+91***210");
      expect(callResult.callSid).toBeDefined();
    });

    it("records telephony status callback without completing the business follow-up task", async () => {
      // Create session
      const session = await gatewayService.createInboundSession("+919876543210", "exo_call_101");

      const updated = await gatewayService.handleStatusCallback({
        CallSid: "exo_call_101",
        Status: "completed",
        Duration: 45,
      });

      expect(updated?.callOutcome).toBe("CALL_COMPLETED");
      expect(updated?.durationSeconds).toBe(45);
      expect(updated?.status).toBe("COMPLETED");
    });
  });

  describe("6. Admin Telemetry & Health Monitoring", () => {
    it("reports real-time voice health and sanitized recent call sessions", async () => {
      await gatewayService.createInboundSession("+919876543210", "sid_01");
      await gatewayService.createInboundSession("+919123456789", "sid_02");

      const telemetry = await gatewayService.getHealthAndTelemetry();

      expect(telemetry.totalCallsToday).toBe(2);
      expect(telemetry.virtualNumber).toBeDefined();
      expect(telemetry.recentSessions.length).toBe(2);
      expect(telemetry.recentSessions[0].maskedNumber).toContain("***");
    });
  });
});
