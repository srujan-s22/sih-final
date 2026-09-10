/**
 * Multilingual Voice Intent & Scheme Retrieval Test Suite
 * Validates semantic intent parity across English (en-IN), Hindi (hi-IN), and Kannada (kn-IN)
 * Covers:
 * 1. English maternal scheme queries
 * 2. Hindi equivalent queries
 * 3. Kannada equivalent queries
 * 4. Unified underlying semantic intent resolution (CHECK_ELIGIBILITY with JSY & PMMVY)
 * 5. Localized response generation matching session language
 * 6. Non-flapping language propagation (hi-IN and kn-IN stay persistent)
 * 7. Mixed-language Indian code-switching (Hinglish / Kanglish)
 * 8. Senior citizen / elderly queries in Indic languages
 * 9. Defense-in-depth against generic ab-pmjay defaulting for maternal queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { multilingualNLU } from "../src/services/telephony/multilingual-nlu.js";
import { VoiceGatewayService } from "../src/services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../src/repositories/voice-session.repository.js";
import { SarvamService } from "../src/services/telephony/sarvam.service.js";
import { VoiceActionService } from "../src/services/telephony/voice-action.service.js";
import { voiceKnowledgeService } from "../src/services/telephony/voice-knowledge.service.js";
import { VoiceSession, SupportedVoiceLanguage } from "../../shared/types/voice.js";

function mockSession(id: string, language: SupportedVoiceLanguage): VoiceSession {
  const now = new Date().toISOString();
  return {
    id,
    callSid: `call_${id}`,
    direction: "INBOUND",
    provider: "TEST_MOCK",
    callerNumberHash: "hash_test",
    maskedCallerNumber: "+91 98*** **210",
    status: "ACTIVE",
    verificationStatus: "UNVERIFIED",
    language,
    turnCount: 0,
    maxTurns: 10,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("Multilingual Voice Intent & Grounded Scheme Retrieval Parity", () => {
  let sessionRepo: VoiceSessionRepository;
  let mockSarvamService: SarvamService;
  let mockActionService: VoiceActionService;
  let gatewayService: VoiceGatewayService;

  beforeEach(() => {
    sessionRepo = new VoiceSessionRepository(null);
    mockSarvamService = new SarvamService();
    // Stub Sarvam TTS network fetch to avoid external credit exhaustion in unit tests
    vi.spyOn(mockSarvamService, "textToSpeech").mockResolvedValue({
      audios: [Buffer.from("mock_audio_pcm").toString("base64")],
    });

    mockActionService = new VoiceActionService(
      {
        getSchemeById: async (id: string) => ({
          id,
          name: id === "jsy" ? "Janani Suraksha Yojana" : id === "pmmvy" ? "Pradhan Mantri Matru Vandana Yojana" : "Ayushman Bharat PM-JAY",
          shortName: id.toUpperCase(),
          description: `Description of ${id}`,
        }),
      } as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any
    );

    gatewayService = new VoiceGatewayService(
      sessionRepo,
      mockSarvamService,
      null as any,
      mockActionService,
      null as any,
      null as any,
      null as any,
      { emitDomainEvent: vi.fn() } as any
    );
  });

  // =========================================================================
  // 1. INTENT & ENTITY PARITY ACROSS ALL THREE LANGUAGES
  // =========================================================================
  describe("1. Semantic Intent Understanding Parity (Maternal Schemes)", () => {
    const englishQueries = [
      "I want information about schemes for pregnant women",
      "Tell me about schemes for pregnant women.",
      "What government schemes are available for expecting mothers?",
      "Are there any benefits for pregnant women?",
      "I need information about maternity schemes.",
    ];

    const hindiQueries = [
      "गर्भवती महिलाओं के लिए योजनाओं के बारे में जानकारी चाहिए",
      "मुझे गर्भवती महिलाओं के लिए कौन-कौन सी योजनाएं हैं बताइए",
      "गर्भवती महिलाओं के लिए योजनाएं बताइए।",
      "गर्भवती माताओं के लिए सरकारी लाभ क्या हैं?",
    ];

    const kannadaQueries = [
      "ಗರ್ಭಿಣಿಯರಿಗಾಗಿ ಇರುವ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು",
      "ಗರ್ಭಿಣಿ ಮಹಿಳೆಯರಿಗೆ ಯಾವ ಯೋಜನೆಗಳಿವೆ ಎಂದು ತಿಳಿಸಿ",
      "ಗರ್ಭಿಣಿಯರಿಗೆ ಯಾವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳಿವೆ?",
      "ಗರ್ಭಿಣಿ ಮಹಿಳೆಯರಿಗೆ ಸಿಗುವ ಸೌಲಭ್ಯಗಳ ಬಗ್ಗೆ ತಿಳಿಸಿ.",
      "ಗರ್ಭಿಣಿಯರಿಗಾಗಿ ಸರ್ಕಾರದ ಯೋಜನೆಗಳ ಮಾಹಿತಿ ಬೇಕು.",
    ];

    it("resolves English queries to CHECK_ELIGIBILITY with pregnancyStatus and JSY schemeId", () => {
      for (const query of englishQueries) {
        const result = multilingualNLU.parseTranscript(query, "en-IN");
        expect(result.intent).toBe("CHECK_ELIGIBILITY");
        expect(result.entities.pregnancyStatus).toBe(true);
        expect(result.schemeId).toBe("jsy");
        expect(result.language).toBe("en-IN");
      }
    });

    it("resolves Hindi queries to CHECK_ELIGIBILITY with pregnancyStatus and JSY schemeId", () => {
      for (const query of hindiQueries) {
        const result = multilingualNLU.parseTranscript(query, "hi-IN");
        expect(result.intent).toBe("CHECK_ELIGIBILITY");
        expect(result.entities.pregnancyStatus).toBe(true);
        expect(result.schemeId).toBe("jsy");
        expect(result.language).toBe("hi-IN");
      }
    });

    it("resolves Kannada queries to CHECK_ELIGIBILITY with pregnancyStatus and JSY schemeId", () => {
      for (const query of kannadaQueries) {
        const result = multilingualNLU.parseTranscript(query, "kn-IN");
        expect(result.intent).toBe("CHECK_ELIGIBILITY");
        expect(result.entities.pregnancyStatus).toBe(true);
        expect(result.schemeId).toBe("jsy");
        expect(result.language).toBe("kn-IN");
      }
    });

    it("asserts Hindi, Kannada, and English queries map to the exact same underlying intent structure", () => {
      const enRes = multilingualNLU.parseTranscript("I want information about schemes for pregnant women", "en-IN");
      const hiRes = multilingualNLU.parseTranscript("गर्भवती महिलाओं के लिए योजनाओं के बारे में जानकारी चाहिए", "hi-IN");
      const knRes = multilingualNLU.parseTranscript("ಗರ್ಭಿಣಿಯರಿಗಾಗಿ ಇರುವ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು", "kn-IN");

      expect(enRes.intent).toBe(hiRes.intent);
      expect(hiRes.intent).toBe(knRes.intent);
      expect(enRes.schemeId).toBe(hiRes.schemeId);
      expect(hiRes.schemeId).toBe(knRes.schemeId);
      expect(enRes.entities.pregnancyStatus).toBe(hiRes.entities.pregnancyStatus);
      expect(hiRes.entities.pregnancyStatus).toBe(knRes.entities.pregnancyStatus);
    });
  });

  // =========================================================================
  // 2. GROUNDED RESPONSE GENERATION & LANGUAGE MATCHING
  // =========================================================================
  describe("2. Grounded Response Generation & Session Language Parity", () => {
    it("returns accurate English response explaining JSY and PMMVY for English callers", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_en_maternal", "en-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "I want information about schemes for pregnant women",
        languageCode: "en-IN",
      });

      expect(res.language).toBe("en-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("Pregnant women qualify");
      expect(res.textResponse).toContain("JSY");
      expect(res.textResponse).toContain("PMMVY");
      expect(res.textResponse).toContain("ration card");
      expect(res.textResponse).not.toContain("ab-pmjay");
    });

    it("returns accurate Hindi response explaining JSY and PMMVY for Hindi callers without English fallback", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_hi_maternal", "hi-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "गर्भवती महिलाओं के लिए योजनाओं के बारे में जानकारी चाहिए",
        languageCode: "hi-IN",
      });

      expect(res.language).toBe("hi-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("गर्भवती महिलाओं");
      expect(res.textResponse).toContain("जननी सुरक्षा योजना");
      expect(res.textResponse).toContain("मातृ वंदना योजना");
      expect(res.textResponse).toContain("राशन कार्ड");
      expect(res.textResponse).not.toContain("ab-pmjay");
      expect(res.textResponse).not.toContain("आयुष्मान भारत");
    });

    it("returns accurate Kannada response explaining JSY and PMMVY for Kannada callers without English fallback", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_kn_maternal", "kn-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "ಗರ್ಭಿಣಿಯರಿಗಾಗಿ ಇರುವ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು",
        languageCode: "kn-IN",
      });

      expect(res.language).toBe("kn-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("ಗರ್ಭಿಣಿಯರಿಗೆ");
      expect(res.textResponse).toContain("ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ");
      expect(res.textResponse).toContain("ಮಾತೃ ವಂದನಾ ಯೋಜನೆ");
      expect(res.textResponse).toContain("ಪಡಿತರ ಚೀಟಿ");
      expect(res.textResponse).not.toContain("ab-pmjay");
      expect(res.textResponse).not.toContain("ಆಯುಷ್ಮಾನ್");
    });
  });

  // =========================================================================
  // 3. PERSISTENT LANGUAGE PROPAGATION (NO FLAPPING)
  // =========================================================================
  describe("3. Language Persistence Invariant", () => {
    it("ensures hi-IN never silently becomes en-IN across turns", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_hi_persist", "hi-IN"));

      const res1 = await gatewayService.processTurn(session.id, {
        transcript: "नमस्ते",
        languageCode: "hi-IN",
      });
      expect(res1.language).toBe("hi-IN");

      const res2 = await gatewayService.processTurn(session.id, {
        transcript: "गर्भवती महिलाओं के लिए कौन-कौन सी योजनाएं हैं बताइए",
        languageCode: "hi-IN",
      });
      expect(res2.language).toBe("hi-IN");
      expect(res2.textResponse).toContain("जननी सुरक्षा योजना");
    });

    it("ensures kn-IN never silently becomes en-IN across turns", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_kn_persist", "kn-IN"));

      const res1 = await gatewayService.processTurn(session.id, {
        transcript: "ನಮಸ್ಕಾರ",
        languageCode: "kn-IN",
      });
      expect(res1.language).toBe("kn-IN");

      const res2 = await gatewayService.processTurn(session.id, {
        transcript: "ಗರ್ಭಿಣಿ ಮಹಿಳೆಯರಿಗೆ ಯಾವ ಯೋಜನೆಗಳಿವೆ ಎಂದು ತಿಳಿಸಿ",
        languageCode: "kn-IN",
      });
      expect(res2.language).toBe("kn-IN");
      expect(res2.textResponse).toContain("ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ");
    });
  });

  // =========================================================================
  // 4. MIXED-LANGUAGE INDIAN CODE-SWITCHING (HINGLISH & KANGLISH)
  // =========================================================================
  describe("4. Code-Switching (Hinglish & Kanglish) Robustness", () => {
    it("handles Hinglish 'pregnant women ke liye schemes kya hain?' seamlessly", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_hinglish_test", "hi-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "pregnant women ke liye schemes kya hain?",
        languageCode: "hi-IN",
      });

      expect(res.language).toBe("hi-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("जननी सुरक्षा योजना");
    });

    it("handles Kanglish 'ಗರ್ಭಿಣಿಯರಿಗೆ schemes ಯಾವುವು?' seamlessly", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_kanglish_test", "kn-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "ಗರ್ಭಿಣಿಯರಿಗೆ schemes ಯಾವುವು?",
        languageCode: "kn-IN",
      });

      expect(res.language).toBe("kn-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ");
    });
  });

  // =========================================================================
  // 5. SENIOR CITIZEN QUERIES IN INDIC LANGUAGES
  // =========================================================================
  describe("5. Senior Citizen / Elderly Queries", () => {
    it("handles Hindi elderly query without hardcoded digits and routes to PM-JAY Senior pathway", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_hi_senior", "hi-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "बुजुर्गों के लिए क्या योजनाएं हैं?",
        languageCode: "hi-IN",
      });

      expect(res.language).toBe("hi-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("आयुष्मान भारत PM-JAY");
      expect(res.textResponse).toContain("5 लाख");
    });

    it("handles Kannada elderly query without hardcoded digits and routes to PM-JAY Senior pathway", async () => {
      const session = await sessionRepo.createSession(mockSession("vses_kn_senior", "kn-IN"));

      const res = await gatewayService.processTurn(session.id, {
        transcript: "ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಯಾವ ಯೋಜನೆಗಳಿವೆ?",
        languageCode: "kn-IN",
      });

      expect(res.language).toBe("kn-IN");
      expect(res.detectedIntent).toBe("CHECK_ELIGIBILITY");
      expect(res.textResponse).toContain("ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY");
      expect(res.textResponse).toContain("5 ಲಕ್ಷ");
    });
  });

  // =========================================================================
  // 6. DEFENSE-IN-DEPTH: CHECK_SCHEMES DOES NOT DEFAULT TO AB-PMJAY FOR MATERNAL
  // =========================================================================
  describe("6. Defense-in-Depth for CHECK_SCHEMES Intent", () => {
    it("ensures voiceKnowledgeService correctly matches maternal care with Indic entities", () => {
      const matchKn = voiceKnowledgeService.queryKnowledge({
        transcript: "ಗರ್ಭಿಣಿಯರಿಗೆ ಯೋಜನೆ ಮಾಹಿತಿ",
        language: "kn-IN",
        intent: "CHECK_SCHEMES",
        entities: { pregnancyStatus: true, gender: "FEMALE" },
      });

      expect(matchKn.found).toBe(true);
      expect(matchKn.text).toContain("ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ");

      const matchHi = voiceKnowledgeService.queryKnowledge({
        transcript: "गर्भवती महिलाओं की योजना",
        language: "hi-IN",
        intent: "CHECK_SCHEMES",
        entities: { pregnancyStatus: true, gender: "FEMALE" },
      });

      expect(matchHi.found).toBe(true);
      expect(matchHi.text).toContain("जननी सुरक्षा योजना");
    });
  });
});
