/**
 * SwasthyaSetu Voice Knowledge & Multilingual Semantic Understanding Test Suite
 * Comprehensive end-to-end tests for:
 * 1. Spoken number normalization (English, Kannada, Hindi, Hinglish, Kanglish)
 * 2. Structured entity extraction (age, gender, relation, pregnancy, disability, schemes, service codes)
 * 3. Centralized Knowledge Layer (About SwasthyaSetu, Website How-To, Citizen, ASHA, Admin portals)
 * 4. Supported Schemes (AB-PMJAY, JSY, PMMVY, State Health Assurances)
 * 5. Conversational multi-turn context retention & clarification prompting
 * 6. Telephony processTurn dispatch & language invariance (en-IN, kn-IN, hi-IN)
 * 7. Security, RBAC boundaries, and emergency safety guarantees
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { multilingualNLU } from "../src/services/telephony/multilingual-nlu.js";
import { voiceKnowledgeService } from "../src/services/telephony/voice-knowledge.service.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { ExotelService } from "../src/services/telephony/exotel.service.js";
import { VoiceActionService } from "../src/services/telephony/voice-action.service.js";
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
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household, Member } from "../../shared/types/household.js";
import { VoiceSession } from "../../shared/types/voice.js";

describe("Voice Knowledge Expansion & Multilingual Semantic Understanding", () => {
  let sarvamService: SarvamService;
  let gatewayService: VoiceGatewayService;
  let sessionRepo: VoiceSessionRepository;
  let householdRepo: HouseholdRepository;
  let schemeRepo: SchemeRepository;
  let caseRepo: CaseRepository;
  let connectionRepo: ConnectionRepository;
  let assistanceRepo: AssistanceRepository;
  let userRepo: UserRepository;
  let automationService: AutomationService;

  beforeEach(async () => {
    schemeRepo = new SchemeRepository(null);
    await seedSchemeRegistry(schemeRepo, true);

    householdRepo = new HouseholdRepository(null);
    sessionRepo = new VoiceSessionRepository(null);
    caseRepo = new CaseRepository(null);
    connectionRepo = new ConnectionRepository(null);
    assistanceRepo = new AssistanceRepository(null);
    userRepo = new UserRepository(null);
    automationService = new AutomationService(null, null);

    const schemeService = new SchemeService(schemeRepo);
    const eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    const assistanceService = new AssistanceService(
      assistanceRepo,
      connectionRepo,
      householdRepo,
      caseRepo
    );

    const voiceActionService = new VoiceActionService(
      schemeService,
      householdRepo,
      eligibilityService,
      assistanceService,
      caseRepo,
      connectionRepo,
      userRepo
    );

    sarvamService = new SarvamService();
    const exotelService = new ExotelService();

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

    // Mock Sarvam TTS for deterministic testing
    vi.spyOn(sarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.from("mock_audio").toString("base64")],
    });
  });

  // =========================================================================
  // 1. Spoken Number Normalization
  // =========================================================================
  describe("1. Spoken Number Normalization", () => {
    it("normalizes English spoken numbers to numeric values", () => {
      expect(multilingualNLU.normalizeNumber("71")).toBe(71);
      expect(multilingualNLU.normalizeNumber("seventy one")).toBe(71);
      expect(multilingualNLU.normalizeNumber("seventy-one")).toBe(71);
      expect(multilingualNLU.normalizeNumber("seventy")).toBe(70);
      expect(multilingualNLU.normalizeNumber("sixty five")).toBe(65);
    });

    it("normalizes Hindi spoken numbers and Hinglish to numeric values", () => {
      expect(multilingualNLU.normalizeNumber("71")).toBe(71);
      expect(multilingualNLU.normalizeNumber("इकहत्तर")).toBe(71);
      expect(multilingualNLU.normalizeNumber("सत्तर")).toBe(70);
      expect(multilingualNLU.normalizeNumber("ikhattar")).toBe(71);
      expect(multilingualNLU.normalizeNumber("sattar")).toBe(70);
    });

    it("normalizes Kannada spoken numbers and Kanglish to numeric values", () => {
      expect(multilingualNLU.normalizeNumber("71")).toBe(71);
      expect(multilingualNLU.normalizeNumber("ಎಪ್ಪತ್ತೊಂದು")).toBe(71);
      expect(multilingualNLU.normalizeNumber("ಎಪ್ಪತ್ತು")).toBe(70);
      expect(multilingualNLU.normalizeNumber("eppattondu")).toBe(71);
      expect(multilingualNLU.normalizeNumber("eppattu")).toBe(70);
    });
  });

  // =========================================================================
  // 2. Structured Entity Extraction
  // =========================================================================
  describe("2. Structured Entity Extraction", () => {
    it("extracts age, relation, and gender from English natural speech", () => {
      const entities = multilingualNLU.extractEntities("My grandfather is 71 years old");
      expect(entities.age).toBe(71);
      expect(entities.relation).toBe("grandfather");
      expect(entities.gender).toBe("MALE");
    });

    it("extracts age, relation, and gender from Hindi speech", () => {
      const entities = multilingualNLU.extractEntities("मेरे दादाजी इकहत्तर साल के हैं");
      expect(entities.age).toBe(71);
      expect(entities.relation).toBe("grandfather");
      expect(entities.gender).toBe("MALE");
    });

    it("extracts age, relation, and gender from Kannada speech", () => {
      const entities = multilingualNLU.extractEntities("ನನ್ನ ತಾತನಿಗೆ ಎಪ್ಪತ್ತೊಂದು ವರ್ಷ ವಯಸ್ಸು");
      expect(entities.age).toBe(71);
      expect(entities.relation).toBe("grandfather");
      expect(entities.gender).toBe("MALE");
    });

    it("extracts pregnancy and maternal care indicators in all three languages", () => {
      const en = multilingualNLU.extractEntities("Information for my pregnant wife");
      expect(en.pregnancyStatus).toBe(true);
      expect(en.relation).toBe("wife");
      expect(en.gender).toBe("FEMALE");

      const hi = multilingualNLU.extractEntities("मेरी गर्भवती पत्नी के लिए योजना");
      expect(hi.pregnancyStatus).toBe(true);
      expect(hi.gender).toBe("FEMALE");

      const kn = multilingualNLU.extractEntities("ನನ್ನ ಗರ್ಭಿಣಿ ಹೆಂಡತಿಗೆ ಏನು ಸಿಗುತ್ತದೆ");
      expect(kn.pregnancyStatus).toBe(true);
      expect(kn.gender).toBe("FEMALE");
    });

    it("extracts disability and household category entities", () => {
      const bpl = multilingualNLU.extractEntities("We have a BPL ration card and a disabled family member");
      expect(bpl.householdCategory).toBe("BPL");
      expect(bpl.disabilityStatus).toBe(true);

      const aay = multilingualNLU.extractEntities("Hamara Antyodaya ration card hai aur divyang sadasya hain");
      expect(aay.householdCategory).toBe("AAY");
      expect(aay.disabilityStatus).toBe(true);
    });

    it("extracts 6-digit ASHA service code", () => {
      const res = multilingualNLU.extractEntities("ASHA service code is 654321");
      expect(res.serviceCode).toBe("654321");
    });
  });

  // =========================================================================
  // 3. Centralized Knowledge Layer: About SwasthyaSetu
  // =========================================================================
  describe("3. Centralized Knowledge Layer: About SwasthyaSetu", () => {
    it("answers 'What is SwasthyaSetu?' in English, Kannada, and Hindi", () => {
      const en = voiceKnowledgeService.queryKnowledge({
        transcript: "What is SwasthyaSetu?",
        language: "en-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(en.found).toBe(true);
      expect(en.text).toContain("SwasthyaSetu is a digital public health bridge");

      const kn = voiceKnowledgeService.queryKnowledge({
        transcript: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಎಂದರೇನು?",
        language: "kn-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(kn.found).toBe(true);
      expect(kn.text).toContain("ಸ್ವಾಸ್ಥ್ಯಸೇತು ಗ್ರಾಮೀಣ ಕುಟುಂಬಗಳನ್ನು");

      const hi = voiceKnowledgeService.queryKnowledge({
        transcript: "स्वास्थ्यसेतु क्या है?",
        language: "hi-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(hi.found).toBe(true);
      expect(hi.text).toContain("स्वास्थ्यसेतु ग्रामीण परिवारों को");
    });

    it("answers cost and fee questions confirming 100% free public service", () => {
      const en = voiceKnowledgeService.queryKnowledge({
        transcript: "Is SwasthyaSetu free or does it cost money?",
        language: "en-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(en.found).toBe(true);
      expect(en.text).toContain("completely free of cost");

      const hi = voiceKnowledgeService.queryKnowledge({
        transcript: "Kya iske paise lagte hain?",
        language: "hi-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(hi.found).toBe(true);
      expect(hi.text).toContain("पूरी तरह से निःशुल्क है");

      const kn = voiceKnowledgeService.queryKnowledge({
        transcript: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಉಚಿತವೇ?",
        language: "kn-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(kn.found).toBe(true);
      expect(kn.text).toContain("ಸಂಪೂರ್ಣವಾಗಿ ಉಚಿತವಾಗಿದೆ");
    });

    it("explains how SwasthyaSetu helps rural families", () => {
      const res = voiceKnowledgeService.queryKnowledge({
        transcript: "How does this platform help rural families?",
        language: "en-IN",
        intent: "ABOUT_SWASTHYASETU",
      });
      expect(res.found).toBe(true);
      expect(res.text).toContain("removing paperwork confusion");
    });
  });

  // =========================================================================
  // 4. Website How-To Guides & Citizen Portal Knowledge
  // =========================================================================
  describe("4. Website How-To Guides & Citizen Portal", () => {
    it("explains how to add a family member step-by-step", () => {
      const en = voiceKnowledgeService.queryKnowledge({
        transcript: "How do I add my father on the website?",
        language: "en-IN",
        intent: "HOW_TO_USE_WEBSITE",
      });
      expect(en.found).toBe(true);
      expect(en.text).toContain("My Family");
      expect(en.text).toContain("Add Member");

      const kn = voiceKnowledgeService.queryKnowledge({
        transcript: "ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ತಂದೆಯನ್ನು ಸೇರಿಸುವುದು ಹೇಗೆ?",
        language: "kn-IN",
        intent: "HOW_TO_USE_WEBSITE",
      });
      expect(kn.found).toBe(true);
      expect(kn.text).toContain("ಮೈ ಫ್ಯಾಮಿಲಿ");
      expect(kn.text).toContain("ಆಡ್ ಮೆಂಬರ್");
    });

    it("explains how to connect with an ASHA worker using service code", () => {
      const en = voiceKnowledgeService.queryKnowledge({
        transcript: "How do I connect to my ASHA worker?",
        language: "en-IN",
        intent: "HOW_TO_USE_WEBSITE",
      });
      expect(en.found).toBe(true);
      expect(en.text).toContain("6-digit ASHA Service Code");

      const hi = voiceKnowledgeService.queryKnowledge({
        transcript: "आशा दीदी से कैसे जुड़ें?",
        language: "hi-IN",
        intent: "HOW_TO_USE_WEBSITE",
      });
      expect(hi.found).toBe(true);
      expect(hi.text).toContain("6 अंकों का सर्विस कोड");
    });

    it("explains citizen dashboard and Next Step meaning", () => {
      const nextStep = voiceKnowledgeService.queryKnowledge({
        transcript: "What is my next step?",
        language: "en-IN",
        intent: "CITIZEN_PORTAL_INFO",
      });
      expect(nextStep.found).toBe(true);
      expect(nextStep.text).toContain("immediate high-priority healthcare action");
    });
  });

  // =========================================================================
  // 5. ASHA Portal & Admin Portal Concepts (Safe Oversight)
  // =========================================================================
  describe("5. ASHA & Admin Portal Concepts", () => {
    it("explains ASHA case journeys and milestones", () => {
      const journey = voiceKnowledgeService.queryKnowledge({
        transcript: "What is a case journey in the ASHA portal?",
        language: "en-IN",
        intent: "ASHA_PORTAL_INFO",
      });
      expect(journey.found).toBe(true);
      expect(journey.text).toContain("milestones");
      expect(journey.text).toContain("e-KYC");
    });

    it("explains Admin Portal safely without leaking secrets or tokens", () => {
      const admin = voiceKnowledgeService.queryKnowledge({
        transcript: "What does the admin portal do?",
        language: "en-IN",
        intent: "ADMIN_PORTAL_INFO",
      });
      expect(admin.found).toBe(true);
      expect(admin.text).toContain("health system oversight");
      expect(admin.text).not.toContain("password");
      expect(admin.text).not.toContain("token");
      expect(admin.text).not.toContain("API");
    });
  });

  // =========================================================================
  // 6. Supported Healthcare Schemes Knowledge
  // =========================================================================
  describe("6. Supported Healthcare Schemes Knowledge", () => {
    it("explains Ayushman Bharat PM-JAY and universal 70+ Senior Citizen Vay Vandana card", () => {
      const en = voiceKnowledgeService.queryKnowledge({
        transcript: "What is Ayushman Bharat PM-JAY?",
        language: "en-IN",
        intent: "SPECIFIC_SCHEME_INFORMATION",
        schemeId: "ab-pmjay",
      });
      expect(en.found).toBe(true);
      expect(en.text).toContain("₹5 lakh");
      expect(en.text).toContain("Senior Citizen");
      expect(en.text).toContain("Ayushman Vay Vandana Card");

      const kn = voiceKnowledgeService.queryKnowledge({
        transcript: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಯೋಜನೆ ಎಂದರೇನು?",
        language: "kn-IN",
        intent: "SPECIFIC_SCHEME_INFORMATION",
        schemeId: "ab-pmjay",
      });
      expect(kn.found).toBe(true);
      expect(kn.text).toContain("5 ಲಕ್ಷ ರೂಪಾಯಿ");
      expect(kn.text).toContain("ವಯ ವಂದನಾ");
    });

    it("explains Janani Suraksha Yojana (JSY) maternal institutional delivery benefits", () => {
      const res = voiceKnowledgeService.queryKnowledge({
        transcript: "Tell me about Janani Suraksha Yojana",
        language: "en-IN",
        intent: "SPECIFIC_SCHEME_INFORMATION",
        schemeId: "jsy",
      });
      expect(res.found).toBe(true);
      expect(res.text).toContain("safe motherhood");
      expect(res.text).toContain("institutional delivery");
    });

    it("explains Pradhan Mantri Matru Vandana Yojana (PMMVY) cash benefit", () => {
      const res = voiceKnowledgeService.queryKnowledge({
        transcript: "What is PMMVY scheme?",
        language: "en-IN",
        intent: "SPECIFIC_SCHEME_INFORMATION",
        schemeId: "pmmvy",
      });
      expect(res.found).toBe(true);
      expect(res.text).toContain("₹5,000");
      expect(res.text).toContain("first living child");
    });

    it("explains State Health Assurance / Arogya Karnataka", () => {
      const res = voiceKnowledgeService.queryKnowledge({
        transcript: "Tell me about Arogya Karnataka state health assurance",
        language: "en-IN",
        intent: "SPECIFIC_SCHEME_INFORMATION",
        schemeId: "state-health-assurance",
      });
      expect(res.found).toBe(true);
      expect(res.text).toContain("state network hospitals");
    });
  });

  // =========================================================================
  // 7. Conversational Multi-Turn Context & Clarification Prompting
  // =========================================================================
  describe("7. Conversational Multi-Turn Context & Clarification", () => {
    it("prompts for relative's age when relative is mentioned without age", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_clarify_01", "en-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "Can my father get this scheme?",
        languageCode: "en-IN",
      });

      expect(turn.textResponse).toBe("Sure, how old is your father?");
    });

    it("prompts for father's age in Kannada when session is in Kannada", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_clarify_kn", "kn-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "ನನ್ನ ತಂದೆಗೆ ಈ ಯೋಜನೆ ಸಿಗುತ್ತಾ?",
        languageCode: "kn-IN",
      });

      expect(turn.textResponse).toContain("ನಿಮ್ಮ ತಂದೆಯವರ ವಯಸ್ಸು ಎಷ್ಟು?");
    });

    it("prompts for father's age in Hindi when session is in Hindi", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_clarify_hi", "hi-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "क्या मेरे पिताजी को यह योजना मिल सकती है?",
        languageCode: "hi-IN",
      });

      expect(turn.textResponse).toContain("आपके पिताजी की उम्र कितनी है?");
    });

    it("retains context across turns: 'My grandfather is 71' -> 'What about Ayushman?'", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_context_01", "en-IN");

      // Turn 1: Mentions grandfather and age
      const turn1 = await gatewayService.processTurn(session.id, {
        transcript: "My grandfather is 71 years old",
        languageCode: "en-IN",
      });
      // Verification prompt or general explanation
      expect(turn1.textResponse).toContain("Senior citizens aged 70 and above");

      // Verify conversationContext was saved to session
      const storedSession = await sessionRepo.getSessionById(session.id);
      expect(storedSession?.conversationContext?.lastMemberAge).toBe(71);
      expect(storedSession?.conversationContext?.lastMemberRelation).toBe("grandfather");

      // Turn 2: Follow-up asking about Ayushman
      const turn2 = await gatewayService.processTurn(session.id, {
        transcript: "What about Ayushman Bharat?",
        languageCode: "en-IN",
      });
      // Should recognize 71-year-old grandfather context for Ayushman
      expect(turn2.textResponse).toContain("universal Ayushman Bharat PM-JAY");
    });
  });

  // =========================================================================
  // 8. Grounded Boundaries: No Hallucinated Services
  // =========================================================================
  describe("8. Grounded Boundaries: No Hallucinated Capabilities", () => {
    it("clarifies that SwasthyaSetu does not provide online hospital bed booking or medicine delivery", () => {
      const bed = voiceKnowledgeService.queryKnowledge({
        transcript: "Can you book a hospital bed for me?",
        language: "en-IN",
        intent: "VOICE_ASSISTANT_HELP",
      });
      expect(bed.found).toBe(true);
      expect(bed.text).toContain("do not provide medicine ordering, hospital bed booking, or ambulance dispatch");
    });

    it("redirects emergency queries immediately to 108 / 102", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_emerg_01", "en-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "Please send an ambulance immediately, my chest is paining heavily",
        languageCode: "en-IN",
      });

      expect(turn.detectedIntent).toBe("EMERGENCY");
      expect(turn.executedAction).toBe("handleEmergencyRedirection");
      expect(turn.textResponse).toContain("108");
    });
  });

  // =========================================================================
  // 9. Full Telephony processTurn Pipeline & Language Invariant
  // =========================================================================
  describe("9. Telephony Pipeline & Language Invariance", () => {
    it("maintains Kannada throughout the conversational turn for website questions", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_kn_pipeline", "kn-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಎಂದರೇನು?",
        languageCode: "kn-IN",
      });

      expect(turn.language).toBe("kn-IN");
      expect(turn.textResponse).toContain("ಸ್ವಾಸ್ಥ್ಯಸೇತು ಗ್ರಾಮೀಣ ಕುಟುಂಬಗಳನ್ನು");
      expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
        expect.stringContaining("ಸ್ವಾಸ್ಥ್ಯಸೇತು"),
        "kn-IN"
      );
    });

    it("maintains Hindi throughout the conversational turn for scheme questions", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_hi_pipeline", "hi-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "आयुष्मान भारत योजना क्या है?",
        languageCode: "hi-IN",
      });

      expect(turn.language).toBe("hi-IN");
      expect(turn.textResponse).toContain("आयुष्मान भारत PM-JAY");
      expect(sarvamService.textToSpeech).toHaveBeenCalledWith(
        expect.stringContaining("आयुष्मान भारत"),
        "hi-IN"
      );
    });

    it("returns localized UNKNOWN response when speech cannot be interpreted", async () => {
      const session = await gatewayService.createInboundSession("+919876543210", "call_unkn_pipeline", "kn-IN");

      const turn = await gatewayService.processTurn(session.id, {
        transcript: "ಅಸ್ಪಷ್ಟ ಗೀಚು ಮಾತುಗಳು",
        languageCode: "kn-IN",
      });

      expect(turn.detectedIntent).toBe("UNKNOWN");
      expect(turn.language).toBe("kn-IN");
      expect(turn.textResponse).toContain("ಕ್ಷಮಿಸಿ, ಅದು ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ");
    });
  });
});
