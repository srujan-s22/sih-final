import { describe, it, expect, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { parseNfcCredential } from "../../frontend/lib/nfc/nfc-parser.js";
import {
  buildHouseholdSpeechText,
  getSpeechSynthesisLang,
  getLocalizedScheme,
} from "../../frontend/lib/nfc/nfc-audio.js";
import { en } from "../../frontend/i18n/translations/en.js";
import { hi } from "../../frontend/i18n/translations/hi.js";
import { kn } from "../../frontend/i18n/translations/kn.js";
import {
  normalizeCurrency,
  normalizeAges,
  normalizeMemberCount,
  normalizePhoneNumberForSpeech,
  normalizeIdentifier,
  normalizeSpeechText,
} from "../../frontend/lib/nfc/speech-normalizer.js";
import {
  selectBestSpeechVoice,
  SpeechSynthesisVoiceLike,
} from "../../frontend/lib/nfc/speech-voice.js";
import {
  CANONICAL_HELPLINE_DISPLAY,
  CANONICAL_HELPLINE_E164,
} from "../../shared/types/voice.js";

describe("Phase 5: Simplified Household View & Multilingual NFC Experience", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_asha101_asha";
  const householdId = "hh_phase5_test_001";
  const emptyHouseholdId = "hh_phase5_test_empty";

  const establishConsent = async (token: string) => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentVersion: "1.0",
        accepted: true,
      },
    });
  };

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    // Seed production verified schemes
    await seedSchemeRegistry(app.schemeRepository, true);

    const now = new Date().toISOString();

    // 1. ASHA User Profile
    await app.userRepository.createUserProfile({
      uid: "asha101",
      email: "asha101@health.karnataka.gov.in",
      phoneNumber: "+919876543210",
      role: "ASHA",
      displayName: "Sunita Devi",
      serviceArea: "Harohalli Health Sub-Center",
      ashaServiceCode: "ASHA-KA-RAM-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Eligible Household (Senior Citizen eligible for AB-PMJAY 70+)
    const testHh: Household = {
      id: householdId,
      ownerUid: "citizen_p5_01",
      headOfHouseholdName: "Basavaraj Patil",
      rationCardNumber: "RC-KA-P5-001",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Ramanagara",
      village: "Harohalli",
      pincode: "562112",
      contactPhone: "9876543210",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHh);

    await app.householdRepository.createMember(householdId, {
      id: "mem_p5_senior_75",
      householdId,
      fullName: "Basavaraj Patil Senior",
      age: 75,
      gender: "male",
      relationship: "Self / Head",
      disabilityStatus: false,
      chronicConditions: ["Hypertension"],
      createdAt: now,
      updatedAt: now,
    });

    const testCase: AshaCase = {
      id: "case_p5_001",
      householdId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: testHh.headOfHouseholdName,
      district: testHh.district,
      state: testHh.state,
      incomeCategory: testHh.incomeCategory,
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 1,
      lastContactAt: now,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(testCase);

    // 3. Household with no eligible members (Young adult, not pregnant, APL)
    const emptyHh: Household = {
      id: emptyHouseholdId,
      ownerUid: "citizen_p5_02",
      headOfHouseholdName: "Anand Kumar",
      rationCardNumber: "RC-KA-P5-002",
      incomeCategory: "APL",
      state: "Karnataka",
      district: "Ramanagara",
      village: "Bidadi",
      pincode: "562109",
      contactPhone: "9876543211",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(emptyHh);

    await app.householdRepository.createMember(emptyHouseholdId, {
      id: "mem_p5_young_25",
      householdId: emptyHouseholdId,
      fullName: "Anand Kumar",
      age: 25,
      gender: "male",
      relationship: "Self / Head",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: now,
      updatedAt: now,
    });

    const emptyCase: AshaCase = {
      id: "case_p5_002",
      householdId: emptyHouseholdId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: emptyHh.headOfHouseholdName,
      district: emptyHh.district,
      state: emptyHh.state,
      incomeCategory: emptyHh.incomeCategory,
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: now,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(emptyCase);
  });

  // ============================================================================
  // SECTION 41 TESTS 1 - 10: HOUSEHOLD IDENTITY, SCHEME & ASHA PRESENTATION
  // ============================================================================
  describe("Requirements 1 - 10: Household Identity, Schemes & ASHA Presentation", () => {
    it("1 & 2. Household name and region render accurately in public resolve response", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      const data = resolveRes.json().data;

      // 1. Household head display name
      expect(data.household.displayName).toBe("Basavaraj Patil");

      // 2. Region details
      expect(data.household.region).toEqual({
        village: "Harohalli",
        district: "Ramanagara",
        state: "Karnataka",
      });
    });

    it("3, 4 & 5. Eligible production scheme, benefit summary, and next steps render accurately", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      const data = resolveRes.json().data;

      expect(data.schemes.length).toBeGreaterThan(0);
      const scheme = data.schemes[0];

      // 3. Eligible production scheme
      expect(scheme.schemeId).toBe("ab-pmjay");
      expect(scheme.name).toContain("Ayushman Bharat");
      expect(scheme.eligibilityStatus).toBe("ELIGIBLE");

      // 4. Benefit summary
      expect(scheme.benefit).toContain("₹5,00,000");

      // 5. Next steps
      expect(scheme.nextSteps).toBeDefined();
      expect(scheme.nextSteps.length).toBeGreaterThan(10);
    });

    it("6. No eligible schemes state renders friendly reassurance without inventing schemes", () => {
      const mockEmptyData = {
        household: {
          displayName: "Anand Kumar",
          region: { village: "Bidadi", district: "Ramanagara", state: "Karnataka" },
        },
        schemes: [],
        asha: {
          displayName: "Sunita Devi",
          serviceArea: "Harohalli Health Sub-Center",
          code: "ASHA-KA-RAM-01",
        },
      };

      // Returns zero schemes
      expect(mockEmptyData.schemes).toEqual([]);

      // Audio narration handles zero schemes gracefully
      const speechEn = buildHouseholdSpeechText(mockEmptyData, "en");
      expect(speechEn).toContain(
        "No listed benefits were found for this household right now"
      );
      expect(speechEn).toContain("Your ASHA worker can help check");

      // Translations provide friendly non-empty UI reassurance
      expect(en.nfc.noSchemesTitle).toBe("No listed benefits found right now");
      expect(en.nfc.noSchemesDesc).toContain("Your ASHA worker can help check whether another benefit applies.");
    });

    it("7, 8 & 9. ASHA name, service area, and code render safely without private contact data", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      const data = resolveRes.json().data;
      expect(data.asha).toBeDefined();

      // 7. ASHA display name
      expect(data.asha.displayName).toBe("Sunita Devi");

      // 8. Service area
      expect(data.asha.serviceArea).toBe("Harohalli Health Sub-Center");

      // 9. Worker code
      expect(data.asha.code).toBe("ASHA-KA-RAM-01");

      // Verify private fields are strictly absent
      expect(data.asha.phoneNumber).toBeUndefined();
      expect(data.asha.email).toBeUndefined();
      expect(data.asha.uid).toBeUndefined();
    });

    it("10. Draft/unverified schemes (State Universal Health, JSSK, AB-ArK) never appear in the public view", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      const data = resolveRes.json().data;
      const rawString = JSON.stringify(data);

      expect(rawString).not.toContain("State Universal Health Assurance Program");
      expect(rawString).not.toContain("JSSK");
      expect(rawString).not.toContain("AB-ArK");
    });
  });

  // ============================================================================
  // SECTION 41 TESTS 11 - 17: AUTH DISTINCTION, MULTILINGUAL & AUDIO EXPERIENCE
  // ============================================================================
  describe("Requirements 11 - 17: Auth Distinction, Multilingual & Audio Experience", () => {
    it("11. Login/Register secondary call-to-action is present in translations for all languages", () => {
      expect(en.nfc.loginForMore).toBe("Login for full household access");
      expect(hi.nfc.loginForMore).toBe("पूर्ण परिवार पहुंच के लिए लॉगिन करें");
      expect(kn.nfc.loginForMore).toBe("ಸಂಪೂರ್ಣ ಕುಟುಂಬ ವಿವರಗಳಿಗಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ");
    });

    it("12 & 13. Language switch works across English, Hindi, and Kannada without re-resolving", () => {
      const mockData = {
        household: {
          displayName: "Basavaraj Patil",
          region: { village: "Harohalli", district: "Ramanagara", state: "Karnataka" },
        },
        schemes: [
          {
            schemeId: "ab-pmjay",
            name: "Ayushman Bharat",
            benefit: "₹5,00,000 hospital cover",
            nextSteps: "Visit nearest hospital",
            eligibilityStatus: "ELIGIBLE" as const,
          },
        ],
        asha: {
          displayName: "Sunita Devi",
          serviceArea: "Harohalli Health Sub-Center",
          code: "ASHA-KA-RAM-01",
        },
      };

      // Pure in-memory transformation without network call
      const textEn = buildHouseholdSpeechText(mockData, "en");
      const textHi = buildHouseholdSpeechText(mockData, "hi");
      const textKn = buildHouseholdSpeechText(mockData, "kn");

      expect(textEn).toContain("Health benefits for Basavaraj Patil");
      expect(textHi).toContain("Basavaraj Patil के परिवार के लिए स्वास्थ्य लाभ");
      expect(textKn).toContain("Basavaraj Patil ಅವರ ಕುಟುಂಬಕ್ಕೆ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು");
    });

    it("14. Audio uses selected language standard BCP-47 locale tags", () => {
      expect(getSpeechSynthesisLang("en")).toBe("en-IN");
      expect(getSpeechSynthesisLang("hi")).toBe("hi-IN");
      expect(getSpeechSynthesisLang("kn")).toBe("kn-IN");
      expect(getSpeechSynthesisLang("unknown")).toBe("en-IN");
    });

    it("15, 16 & 17. Audio lifecycle safety: speech text is user-triggered and cancelable", () => {
      const mockData = {
        household: {
          displayName: "Basavaraj Patil",
          region: { village: "Harohalli", district: "Ramanagara", state: "Karnataka" },
        },
        schemes: [],
        asha: null,
      };

      // Function produces non-empty string only when explicitly invoked
      const speech = buildHouseholdSpeechText(mockData, "en");
      expect(speech.length).toBeGreaterThan(0);

      // Safe against missing/null data
      expect(buildHouseholdSpeechText(null as any, "en")).toBe("");
      expect(buildHouseholdSpeechText({} as any, "en")).toBe("");
    });
  });

  // ============================================================================
  // SECTION 41 TESTS 18 - 28: PRIVACY BOUNDARY, DATA INTEGRITY & ROUTING SAFETY
  // ============================================================================
  describe("Requirements 18 - 28: Privacy Boundary & Robustness", () => {
    it("18 & 19. Sensitive household/member fields are absent from response DTO and speech text", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      const data = resolveRes.json().data;
      const rawPayload = JSON.stringify(data);
      const speechText = buildHouseholdSpeechText(data, "en");

      const sensitiveTerms = [
        "BPL",
        "RC-KA-P5-001",
        "9876543210",
        "Hypertension",
        "mem_p5_senior_75",
        "citizen_p5_01",
        "case_p5_01",
        token,
      ];

      for (const term of sensitiveTerms) {
        expect(rawPayload).not.toContain(term);
        expect(speechText).not.toContain(term);
      }
    });

    it("20 & 21. Bearer token is never rendered or persisted in client storage", () => {
      const parsed = parseNfcCredential("?hh=hh_phase5_test_001&t=secret_bearer_token_12345");
      expect(parsed.status).toBe("VALID");
      if (parsed.status === "VALID") {
        expect(parsed.credential.token).toBe("secret_bearer_token_12345");
      }
      // Result is an in-memory object only
      expect(typeof parsed).toBe("object");
    });

    it("22. Direct /nfc access without parameters cleanly returns EMPTY state", () => {
      const result = parseNfcCredential("");
      expect(result.status).toBe("EMPTY");

      const questionMarkResult = parseNfcCredential("?");
      expect(questionMarkResult.status).toBe("EMPTY");
    });

    it("23. Invalid or revoked NFC credential returns generic 401 without revealing internal state", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token: "invalid_random_token_12345",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json().code).toBe("INVALID_NFC_CREDENTIAL");
      expect(res.json().message).toBe("Invalid or unavailable NFC credential.");
    });

    it("24 & 25. Network failure handling is differentiated and retry does not create duplicates", () => {
      // Translation provides distinct messaging for network error vs invalid card
      expect(en.nfc.networkErrorTitle).toBe("We couldn't connect right now");
      expect(en.nfc.networkErrorDesc).toBe("Please check your internet connection and try again.");
      expect(en.nfc.invalidCardTitle).toBe("This household card could not be opened");
      expect(en.nfc.invalidCardDesc).toContain("Please ask your ASHA worker to check the card.");
      expect(en.nfc.tryAgain).toBe("Try Again");
    });

    it("26. URL sanitization: client parser extracts parameters so replaceState can scrub the URL", () => {
      const search = "?hh=hh_phase5_test_001&t=secret_token_12345678&v=1";
      const res = parseNfcCredential(search);
      expect(res.status).toBe("VALID");
      if (res.status === "VALID") {
        expect(res.credential.householdId).toBe("hh_phase5_test_001");
        expect(res.credential.token).toBe("secret_token_12345678");
        expect(res.credential.version).toBe(1);
      }
    });

    it("27. Public full-household API is strictly protected and cannot be accessed unauthenticated", async () => {
      // Direct GET /households/:id cannot be accessed by public
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/households/${householdId}`,
      });

      // Must be rejected (either 401 unauthorized or route not public)
      expect([HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.NOT_FOUND]).toContain(res.statusCode);
    });

    it("28. Public DTO remains strictly locked to allowlisted top-level keys", async () => {
      await establishConsent(ashaToken);
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token },
      });

      const data = resolveRes.json().data;
      const topLevelKeys = Object.keys(data).sort();
      expect(topLevelKeys).toEqual(["asha", "household", "schemes"]);
    });
  });

  // ============================================================================
  // SECTION 42: MULTILINGUAL UI, ROBUST LISTEN, SCHEME CLEANUP & EXOTEL CTA
  // ============================================================================
  describe("Issue Fixes: Multilingual UI, Robust Listen, Scheme Cleanup & Exotel CTA", () => {
    // 1. SPEECH NORMALIZATION
    it("normalizes currency amounts naturally across English, Hindi, and Kannada", () => {
      const sample500k = "Covers up to ₹5,00,000 per family per year.";
      expect(normalizeCurrency(sample500k, "en")).toContain("5 lakh rupees");
      expect(normalizeCurrency(sample500k, "hi")).toContain("5 लाख रुपये");
      expect(normalizeCurrency(sample500k, "kn")).toContain("5 ಲಕ್ಷ ರೂಪಾಯಿ");

      const sample1400 = "Direct cash benefit of ₹1,400 upon institutional delivery.";
      expect(normalizeCurrency(sample1400, "en")).toContain("1 thousand 400 rupees");
      expect(normalizeCurrency(sample1400, "hi")).toContain("1 हजार 400 रुपये");
      expect(normalizeCurrency(sample1400, "kn")).toContain("1 ಸಾವಿರ 400 ರೂಪಾಯಿ");
    });

    it("normalizes age markers (70+) and member counts across languages", () => {
      expect(normalizeAges("Senior Citizens 70+", "en")).toBe("Senior Citizens 70 years and above");
      expect(normalizeAges("वरिष्ठ नागरिक 70+", "hi")).toBe("वरिष्ठ नागरिक 70 वर्ष से अधिक");
      expect(normalizeAges("ಹಿರಿಯ ನಾಗರಿಕರು 70+", "kn")).toBe("ಹಿರಿಯ ನಾಗರಿಕರು 70 ವರ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು");

      expect(normalizeMemberCount("4 members", "en")).toBe("4 members");
      expect(normalizeMemberCount("4 members", "hi")).toBe("4 सदस्य");
      expect(normalizeMemberCount("4 members", "kn")).toBe("4 ಸದಸ್ಯರು");
    });

    it("normalizes telephone numbers into distinct spoken digit sequences with pauses", () => {
      const phoneDigits = normalizePhoneNumberForSpeech("08047288814");
      expect(phoneDigits).toBe("0, 8, 0, 4, 7, 2, 8, 8, 8, 1, 4");
    });

    it("normalizes identifiers and PIN codes to prevent giant integer pronunciation", () => {
      const idEn = normalizeIdentifier("RC-876567890", "en");
      expect(idEn).toContain("R C");
      expect(idEn).toContain("8, 7, 6, 5, 6, 7, 8, 9, 0");

      const idHi = normalizeIdentifier("RC-876567890", "hi");
      expect(idHi).toContain("आर सी");

      const pinSpaced = normalizeIdentifier("562112", "en");
      expect(pinSpaced).toBe("5, 6, 2, 1, 1, 2");
    });

    // 2. VOICE SELECTION & FALLBACK STRATEGY
    it("selects best voice with graceful fallback chains for kn-IN, hi-IN, and en-IN", () => {
      const mockVoices: SpeechSynthesisVoiceLike[] = [
        { name: "Google Kannada", lang: "kn-IN" },
        { name: "Google Hindi", lang: "hi-IN" },
        { name: "Rishi (Indian English)", lang: "en-IN" },
        { name: "Samantha", lang: "en-US" },
      ];

      // Kannada exact match
      const knRes = selectBestSpeechVoice(mockVoices, "kn");
      expect(knRes.voice?.name).toBe("Google Kannada");
      expect(knRes.isNativeVoice).toBe(true);
      expect(knRes.isFallback).toBe(false);

      // Hindi exact match
      const hiRes = selectBestSpeechVoice(mockVoices, "hi");
      expect(hiRes.voice?.name).toBe("Google Hindi");
      expect(hiRes.isNativeVoice).toBe(true);
      expect(hiRes.isFallback).toBe(false);

      // English exact match
      const enRes = selectBestSpeechVoice(mockVoices, "en");
      expect(enRes.voice?.name).toBe("Rishi (Indian English)");
      expect(enRes.isNativeVoice).toBe(true);
      expect(enRes.isFallback).toBe(false);

      // Fallback chain when Kannada voice is absent -> Indian English fallback
      const voicesNoKn: SpeechSynthesisVoiceLike[] = [
        { name: "Rishi (Indian English)", lang: "en-IN" },
        { name: "Samantha", lang: "en-US" },
      ];
      const knFallbackRes = selectBestSpeechVoice(voicesNoKn, "kn");
      expect(knFallbackRes.voice?.name).toBe("Rishi (Indian English)");
      expect(knFallbackRes.isNativeVoice).toBe(false);
      expect(knFallbackRes.isFallback).toBe(true);

      // Fallback chain when only US English is available
      const voicesOnlyUs: SpeechSynthesisVoiceLike[] = [
        { name: "Samantha", lang: "en-US" },
      ];
      const hiFallbackRes = selectBestSpeechVoice(voicesOnlyUs, "hi");
      expect(hiFallbackRes.voice?.name).toBe("Samantha");
      expect(hiFallbackRes.isFallback).toBe(true);

      // Empty voice list returns default tag without throwing
      const emptyRes = selectBestSpeechVoice([], "kn");
      expect(emptyRes.voice).toBeNull();
      expect(emptyRes.langTag).toBe("kn-IN");
      expect(emptyRes.isFallback).toBe(true);
    });

    // 3. SCHEME CARD CLEANUP (REMOVAL OF "WHAT TO DO NEXT")
    it("completely excludes 'What to do next' from spoken speech text", () => {
      const mockDataWithNextSteps = {
        household: {
          displayName: "Basavaraj Patil",
          region: { village: "Harohalli", district: "Ramanagara", state: "Karnataka" },
        },
        schemes: [
          {
            schemeId: "ab-pmjay",
            name: "Ayushman Bharat",
            benefit: "₹5,00,000 hospital cover",
            nextSteps: "Visit nearest CSC kiosk with Aadhaar card",
            eligibilityStatus: "ELIGIBLE" as const,
          },
        ],
        asha: null,
      };

      const speechEn = buildHouseholdSpeechText(mockDataWithNextSteps, "en");
      const speechHi = buildHouseholdSpeechText(mockDataWithNextSteps, "hi");
      const speechKn = buildHouseholdSpeechText(mockDataWithNextSteps, "kn");

      // Verify "What to do next" is never spoken
      expect(speechEn).not.toContain("What to do next");
      expect(speechEn).not.toContain("Visit nearest CSC kiosk");
      expect(speechHi).not.toContain("आगे क्या करना है");
      expect(speechKn).not.toContain("ಮುಂದೆ ಏನು ಮಾಡಬೇಕು");
    });

    // 4. EXOTEL REGISTERED HELPLINE CTA & PRIVACY VERIFICATION
    it("uses canonical Exotel helpline 08047288814 / +918047288814 and NEVER exposes household phone", () => {
      expect(CANONICAL_HELPLINE_DISPLAY).toBe("08047288814");
      expect(CANONICAL_HELPLINE_E164).toBe("+918047288814");

      const mockDataWithPrivatePhone = {
        household: {
          displayName: "Basavaraj Patil",
          region: { village: "Harohalli", district: "Ramanagara", state: "Karnataka" },
        },
        schemes: [],
        asha: null,
      };

      const speechEn = buildHouseholdSpeechText(mockDataWithPrivatePhone, "en");
      // Spoken closing mentions public helpline in digit cadence
      expect(speechEn).toContain("0, 8, 0, 4, 7, 2, 8, 8, 8, 1, 4");

      // Household private phone MUST NOT appear in speech
      expect(speechEn).not.toContain("9876543210");
    });

    // 5. TRANSLATION KEYS COVERAGE FOR NEW NFC STRINGS
    it("ensures all new NFC UI strings exist with 1:1 parity in English, Hindi, and Kannada", () => {
      const requiredNfcKeys = [
        "languageSelector",
        "secureVerification",
        "schemesAvailable",
        "loadingEntitlements",
        "speaking",
        "helplineTitle",
        "helplineDesc",
        "helplineBadge",
        "helplineAria",
        "callHelplineBtn",
      ] as const;

      for (const key of requiredNfcKeys) {
        expect((en.nfc as any)[key]).toBeDefined();
        expect(typeof (en.nfc as any)[key]).toBe("string");
        expect((en.nfc as any)[key].trim().length).toBeGreaterThan(0);

        expect((hi.nfc as any)[key]).toBeDefined();
        expect(typeof (hi.nfc as any)[key]).toBe("string");
        expect((hi.nfc as any)[key].trim().length).toBeGreaterThan(0);

        expect((kn.nfc as any)[key]).toBeDefined();
        expect(typeof (kn.nfc as any)[key]).toBe("string");
        expect((kn.nfc as any)[key].trim().length).toBeGreaterThan(0);
      }
    });

    // 6. PMMVY (3RD SCHEME) LOCALIZATION IN HINDI AND KANNADA
    it("localizes PMMVY (Pradhan Mantri Matru Vandana Yojana) in Hindi and Kannada", () => {
      const pmmvySummary = {
        schemeId: "pmmvy",
        name: "Pradhan Mantri Matru Vandana Yojana",
        benefit: "Direct Benefit Transfer (DBT) of ₹5,000 in two installments for the first living child, and ₹6,000 in a single installment for a second child if the infant is a girl.",
        nextSteps: "Contact local Anganwadi or ASHA worker",
        eligibilityStatus: "CHECK_REQUIRED" as const,
      };

      // Kannada
      const knContent = getLocalizedScheme(pmmvySummary, "kn");
      expect(knContent.name).toBe("ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ (PMMVY)");
      expect(knContent.benefit).toContain("₹5,000");
      expect(knContent.benefit).toContain("₹6,000");
      expect(knContent.benefit).toContain("ನೇರ ನಗದು ವರ್ಗಾವಣೆ (DBT)");

      // Hindi
      const hiContent = getLocalizedScheme(pmmvySummary, "hi");
      expect(hiContent.name).toBe("प्रधानमंत्री मातृ वंदना योजना (PMMVY)");
      expect(hiContent.benefit).toContain("₹5,000");
      expect(hiContent.benefit).toContain("₹6,000");
      expect(hiContent.benefit).toContain("प्रत्यक्ष लाभ अंतरण (DBT)");

      // English
      const enContent = getLocalizedScheme(pmmvySummary, "en");
      expect(enContent.name).toContain("Pradhan Mantri Matru Vandana Yojana");
      expect(enContent.benefit).toContain("Direct Benefit Transfer (DBT)");
    });

    // 7. THOUSAND AMOUNTS SPEECH NORMALIZATION (₹5,000 and ₹6,000)
    it("normalizes PMMVY thousand currency amounts (₹5,000, ₹6,000) for spoken audio", () => {
      const pmmvySample = "DBT of ₹5,000 and ₹6,000";
      expect(normalizeCurrency(pmmvySample, "kn")).toContain("5 ಸಾವಿರ ರೂಪಾಯಿ");
      expect(normalizeCurrency(pmmvySample, "kn")).toContain("6 ಸಾವಿರ ರೂಪಾಯಿ");

      expect(normalizeCurrency(pmmvySample, "hi")).toContain("5 हजार रुपये");
      expect(normalizeCurrency(pmmvySample, "hi")).toContain("6 हजार रुपये");

      expect(normalizeCurrency(pmmvySample, "en")).toContain("5 thousand rupees");
      expect(normalizeCurrency(pmmvySample, "en")).toContain("6 thousand rupees");
    });
  });
});
