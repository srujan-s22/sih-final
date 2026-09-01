/**
 * Multilingual Natural Language Understanding (NLU) & Entity Normalizer
 * For SwasthyaSetu Voice Telephony (English, Kannada, Hindi, Hinglish, Kanglish)
 *
 * Provides:
 * 1. Spoken number normalization (English words, Kannada words, Hindi words -> integers)
 * 2. Structured entity extraction (age, gender, relation, pregnancy, disability, schemes, codes)
 * 3. Semantic intent classification (domain intents mapped across natural multilingual paraphrases)
 * 4. Conversational multi-turn context retention & clarification prompting
 */

import {
  VoiceIntentType,
  ExtractedVoiceEntities,
  SupportedVoiceLanguage,
  toVoiceLanguage,
} from "../../../../shared/types/voice.js";

export interface SemanticParseResult {
  intent: VoiceIntentType;
  confidence: number;
  entities: ExtractedVoiceEntities;
  schemeId?: string;
  topic?: string;
  clarificationPrompt?: string;
  rawTranscript: string;
  language: string;
}

// Spoken numbers dictionary (English, Kannada, Hindi)
const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  "seventy one": 71, "seventy-one": 71, "seventy two": 72, "seventy-two": 72, "seventy five": 75, "seventy-five": 75,
  "sixty five": 65, "sixty-five": 65, "sixty eight": 68, "sixty-eight": 68, "sixty nine": 69, "sixty-nine": 69,

  // Hindi
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19,
  "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90, "सौ": 100,
  "इकहत्तर": 71, "बहत्तर": 72, "तिहत्तर": 73, "चौहत्तर": 74, "पचहत्तर": 75,
  // Hinglish phonetic
  ikhattar: 71, bahattar: 72, sattar: 70, pachhattar: 75, saatth: 60, paanch: 5,

  // Kannada
  "ಸೊನ್ನೆ": 0, "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5, "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
  "ಹನ್ನೊಂದು": 11, "ಹನ್ನೆರಡು": 12, "ಹದಿಮೂರು": 13, "ಹದಿನಾಲ್ಕು": 14, "ಹದಿನೈದು": 15, "ಹದಿನಾರು": 16, "ಹದಿನೇಳು": 17, "ಹದಿನೆಂಟು": 18, "ಹತ್ತೊಂಬತ್ತು": 19,
  "ಇಪ್ಪತ್ತು": 20, "ಮೂವತ್ತು": 30, "ನಲವತ್ತು": 40, "ಐವತ್ತು": 50, "ಅರವತ್ತು": 60, "ಎಪ್ಪತ್ತು": 70, "ಎಂಭತ್ತು": 80, "ತೊಂಬತ್ತು": 90, "ನೂರು": 100,
  "ಎಪ್ಪತ್ತೊಂದು": 71, "ಎಪ್ಪತ್ತೆರಡು": 72, "ಎಪ್ಪತ್ತೂರು": 73, "ಎಪ್ಪತ್ನಾಲ್ಕು": 74, "ಎಪ್ಪತ್ತೈದು": 75,
  // Kanglish phonetic
  eppattondu: 71, eppatteradu: 72, eppattu: 70, eppattaidu: 75, aravattu: 60, aravattondu: 61,
};

export class MultilingualNLU {
  /**
   * Normalizes spoken numbers into integer values
   */
  public normalizeNumber(text: string): number | undefined {
    const clean = text.trim().toLowerCase();

    // 1. Direct digit match
    const digitMatch = clean.match(/\b\d{1,3}\b/);
    if (digitMatch) {
      const parsed = parseInt(digitMatch[0], 10);
      if (!isNaN(parsed)) return parsed;
    }

    // 2. Dictionary lookup for multi-word or single-word numbers (longest phrases first)
    const sortedEntries = Object.entries(NUMBER_WORDS).sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [phrase, value] of sortedEntries) {
      if (clean.includes(phrase.toLowerCase())) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Extracts domain entities from transcript
   */
  public extractEntities(transcript: string): ExtractedVoiceEntities {
    const raw = transcript.trim();
    const clean = raw.toLowerCase();
    const entities: ExtractedVoiceEntities = {};

    // 1. Age extraction
    // Match patterns like "71 years", "71 saal", "71 varsha", "71", "age 71", "seventy one"
    const ageNum = this.normalizeNumber(clean);
    if (ageNum !== undefined && ageNum >= 0 && ageNum <= 125) {
      entities.age = ageNum;
    }

    // 2. Relationship extraction
    if (
      clean.includes("grandfather") || clean.includes("grandpa") ||
      clean.includes("dada") || clean.includes("dadu") || clean.includes("nana") ||
      clean.includes("thatha") || clean.includes("ajja") ||
      clean.includes("ತಾತ") || clean.includes("ಅಜ್ಜ") ||
      clean.includes("दादा") || clean.includes("नाना")
    ) {
      entities.relation = "grandfather";
      entities.gender = "MALE";
    } else if (
      clean.includes("grandmother") || clean.includes("grandma") ||
      clean.includes("dadi") || clean.includes("nani") ||
      clean.includes("ajji") ||
      clean.includes("ಅಜ್ಜಿ") || clean.includes("दादी") || clean.includes("नानी")
    ) {
      entities.relation = "grandmother";
      entities.gender = "FEMALE";
    } else if (
      clean.includes("father") || clean.includes("papa") || clean.includes("pitaji") ||
      clean.includes("thande") || clean.includes("appa") ||
      clean.includes("ತಂದೆ") || clean.includes("ಅಪ್ಪ") ||
      clean.includes("पिता") || clean.includes("पिताजी")
    ) {
      entities.relation = "father";
      entities.gender = "MALE";
    } else if (
      clean.includes("mother") || clean.includes("mom") || clean.includes("mataji") ||
      clean.includes("thayi") || clean.includes("amma") ||
      clean.includes("ತಾಯಿ") || clean.includes("ಅಮ್ಮ") ||
      clean.includes("माता") || clean.includes("माताजी") || clean.includes("माँ")
    ) {
      entities.relation = "mother";
      entities.gender = "FEMALE";
    } else if (
      clean.includes("wife") || clean.includes("patni") || clean.includes("pathni") ||
      clean.includes("hendathi") || clean.includes("ಹೆಂಡತಿ") || clean.includes("ಪತ್ನಿ") || clean.includes("पत्नी")
    ) {
      entities.relation = "wife";
      entities.gender = "FEMALE";
    } else if (
      clean.includes("husband") || clean.includes("pati") || clean.includes("ganda") ||
      clean.includes("ಗಂಡ") || clean.includes("ಪತಿ") || clean.includes("पति")
    ) {
      entities.relation = "husband";
      entities.gender = "MALE";
    } else if (
      clean.includes("son") || clean.includes("beta") || clean.includes("maga") ||
      clean.includes("ಮಗ") || clean.includes("बेटा")
    ) {
      entities.relation = "son";
      entities.gender = "MALE";
    } else if (
      clean.includes("daughter") || clean.includes("beti") || clean.includes("magalu") ||
      clean.includes("ಮಗಳು") || clean.includes("बेटी")
    ) {
      entities.relation = "daughter";
      entities.gender = "FEMALE";
    }

    // 3. Pregnancy Status
    if (
      clean.includes("pregnant") || clean.includes("pregnancy") ||
      clean.includes("garbhwati") || clean.includes("garbhvati") ||
      clean.includes("garbhini") || clean.includes("ಗರ್ಭಿಣಿ") ||
      clean.includes("ಗರ್ಭಧಾರಣೆ") || clean.includes("गर्भवती") || clean.includes("गर्भावस्था")
    ) {
      entities.pregnancyStatus = true;
      entities.gender = "FEMALE";
    }

    // 4. Nursing / Lactating Status
    if (
      clean.includes("nursing") || clean.includes("lactating") || clean.includes("breastfeeding") ||
      clean.includes("stanpaan") || clean.includes("dhaatri") ||
      clean.includes("halu kudisuva") || clean.includes("ಬಾಣಂತಿ") ||
      clean.includes("ಸ್ತನ್ಯಪಾನ") || clean.includes("स्तनपान") || clean.includes("धात्री")
    ) {
      entities.nursingStatus = true;
      entities.gender = "FEMALE";
    }

    // 5. Disability Status
    if (
      clean.includes("disability") || clean.includes("disabled") || clean.includes("handicap") ||
      clean.includes("divyang") || clean.includes("viklang") || clean.includes("vikalaang") ||
      clean.includes("angavikala") || clean.includes("ಅಂಗವಿಕಲ") || clean.includes("ಅಂಗವಿಕಲತೆ") ||
      clean.includes("दिव्यांग") || clean.includes("विकलांग")
    ) {
      entities.disabilityStatus = true;
    }

    // 6. Household Ration Category
    if (clean.includes("bpl") || clean.includes("below poverty") || clean.includes("garibi rekha") || clean.includes("ಬಿಪಿಎಲ್")) {
      entities.householdCategory = "BPL";
    } else if (clean.includes("aay") || clean.includes("antyodaya") || clean.includes("ಅಂತ್ಯೋದಯ") || clean.includes("अंत्योदय")) {
      entities.householdCategory = "AAY";
    } else if (clean.includes("apl") || clean.includes("above poverty") || clean.includes("ಎಪಿಎಲ್")) {
      entities.householdCategory = "APL";
    }

    // 7. Scheme Identifier
    if (
      clean.includes("ayushman") || clean.includes("pmjay") || clean.includes("pm-jay") ||
      clean.includes("vay vandana") || clean.includes("ಆಯುಷ್ಮಾನ್") || clean.includes("आयुष्मान")
    ) {
      entities.schemeId = "ab-pmjay";
    } else if (
      clean.includes("janani") || clean.includes("jsy") ||
      clean.includes("ಜನನಿ") || clean.includes("ಜನನಿ ಸುರಕ್ಷಾ") || clean.includes("जननी")
    ) {
      entities.schemeId = "jsy";
    } else if (
      clean.includes("pmmvy") || clean.includes("matru vandana") ||
      clean.includes("ಮಾತೃ ವಂದನಾ") || clean.includes("मातृ वंदना")
    ) {
      entities.schemeId = "pmmvy";
    } else if (
      clean.includes("arogya karnataka") || clean.includes("state health") || clean.includes("ark") ||
      clean.includes("ಆರೋಗ್ಯ ಕರ್ನಾಟಕ")
    ) {
      entities.schemeId = "state-health-assurance";
    }

    // 8. 6-digit ASHA Service Code
    const serviceCodeMatch = raw.match(/\b\d{6}\b/);
    if (serviceCodeMatch && (clean.includes("service code") || clean.includes("code") || clean.includes("ಕೋಡ್") || clean.includes("कोड"))) {
      entities.serviceCode = serviceCodeMatch[0];
    }

    // 9. Ration card / Verification digits
    const digitsMatch = raw.match(/\b\d{4,12}\b/);
    if (digitsMatch) {
      entities.verificationCode = digitsMatch[0];
    }

    return entities;
  }

  /**
   * Main semantic parser: Classifies intent, extracts entities, and leverages multi-turn context
   */
  public parseTranscript(
    transcript: string,
    sessionLanguage?: string,
    conversationContext?: Record<string, any>
  ): SemanticParseResult {
    const raw = transcript.trim();
    const clean = raw.toLowerCase();
    const resolvedLanguage = toVoiceLanguage(sessionLanguage || "en-IN");
    const entities = this.extractEntities(raw);

    // Apply conversation context if entities are partially missing
    if (conversationContext) {
      const isDifferentRelative =
        Boolean(entities.relation &&
        conversationContext.lastMemberRelation &&
        entities.relation !== conversationContext.lastMemberRelation);

      if (!isDifferentRelative) {
        if (entities.age === undefined && conversationContext.lastMemberAge !== undefined) {
          entities.age = conversationContext.lastMemberAge;
        }
        if (!entities.relation && conversationContext.lastMemberRelation) {
          entities.relation = conversationContext.lastMemberRelation;
        }
        if (!entities.gender && conversationContext.lastMemberGender) {
          entities.gender = conversationContext.lastMemberGender;
        }
      }
      if (!entities.schemeId && conversationContext.lastSchemeId) {
        entities.schemeId = conversationContext.lastSchemeId;
      }
    }

    // 0. Emergency Medical Safety Check (Instant redirect)
    if (
      clean.includes("emergency") || clean.includes("ambulance") ||
      clean.includes("108") || clean.includes("102") ||
      clean.includes("chest pain") || clean.includes("heart attack") ||
      clean.includes("dil ka daura") || clean.includes("bleeding") ||
      clean.includes("khoon nikal") || clean.includes("unconscious") ||
      clean.includes("behosh") || clean.includes("accident") ||
      clean.includes("saans nahi aa rahi") ||
      clean.includes("ತುರ್ತು") || clean.includes("ಆಂಬ್ಯುಲೆನ್ಸ್") ||
      clean.includes("ಎದೆ ನೋವು") || clean.includes("ಹೃದಯಾಘಾತ") ||
      clean.includes("ರಕ್ತಸ್ರಾವ") || clean.includes("ಉಸಿರಾಟ") ||
      clean.includes("ಪ್ರಜ್ಞೆ") || clean.includes("ಅಪಘಾತ") ||
      clean.includes("आपातकालीन") || clean.includes("एम्बुलेंस") ||
      clean.includes("सीने में दर्द") || clean.includes("खून") ||
      clean.includes("बेहोश")
    ) {
      return {
        intent: "EMERGENCY",
        confidence: 0.99,
        entities,
        schemeId: entities.schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 1. Termination / End Call
    if (
      clean.includes("bye") || clean.includes("alvida") ||
      clean.includes("shukriya") || clean.includes("thank you") ||
      clean.includes("dhanyawad") || clean.includes("band karo") ||
      clean.includes("end call") || clean.includes("hang up") ||
      clean.includes("ಧನ್ಯವಾದ") || clean.includes("ಮುಕ್ತಾಯ") ||
      clean.includes("ಸಾಕು") || clean.includes("ಕಟ್ ಮಾಡಿ") ||
      clean.includes("धन्यवाद") || clean.includes("अलविदा") ||
      clean.includes("कॉल समाप्त")
    ) {
      return {
        intent: "END_CALL",
        confidence: 0.95,
        entities,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 2. Verification / Digits PIN
    if (
      (clean.includes("ration") || clean.includes("card number") || clean.includes("pin") ||
       clean.includes("verify") || clean.includes("रೇಷನ್") || clean.includes("ಪಡಿತರ") ||
       clean.includes("ಸತ್ಯಾಪನೆ") || clean.includes("राशन") || clean.includes("सत्यापन")) &&
      entities.verificationCode
    ) {
      return {
        intent: "VERIFY_IDENTITY",
        confidence: 0.92,
        entities,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 3. Website "How Do I..." or Portal Instructions
    if (
      clean.includes("how do i add") || clean.includes("how to add member") ||
      clean.includes("sadasya kaise jode") || clean.includes("hege serisuvudu") ||
      clean.includes("how to connect asha") || clean.includes("how do i connect") ||
      clean.includes("asha se kaise jude") || clean.includes("how to check eligibility") ||
      clean.includes("how to see next step") || clean.includes("where can i see") ||
      clean.includes("where are my health benefits") || clean.includes("ಸೇರಿಸುವುದು ಹೇಗೆ") ||
      clean.includes("ಸಂಪರ್ಕಿಸುವುದು ಹೇಗೆ") || clean.includes("ಅರ್ಹತೆ ಪರಿಶೀಲಿಸುವುದು ಹೇಗೆ") ||
      clean.includes("ಮುಂದಿನ ಹಂತ ಎಲ್ಲಿದೆ") || clean.includes("ಸದಸ್ಯರನ್ನು ಸೇರಿಸುವುದು") ||
      clean.includes("ತಂದೆಯನ್ನು ಸೇರಿಸುವುದು") || clean.includes("ಆಶಾ ಸಂಪರ್ಕ") ||
      clean.includes("कैसे जोड़ें") || clean.includes("सिटिजन पोर्टल") || clean.includes("अगला कदम")
    ) {
      return {
        intent: "HOW_TO_USE_WEBSITE",
        confidence: 0.9,
        entities,
        topic: clean.includes("connect asha") || clean.includes("asha se") || clean.includes("ಸಂಪರ್ಕ") || clean.includes("ಆಶಾ") ? "how_connect_asha" :
               clean.includes("add") || clean.includes("jode") || clean.includes("ಸೇರಿಸು") || clean.includes("जोड़") ? "how_add_member" :
               clean.includes("eligibility") || clean.includes("ಅರ್ಹತೆ") ? "how_check_eligibility" : "how_view_next_step",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 4. About SwasthyaSetu Platform
    if (
      clean.includes("what is swasthyasetu") || clean.includes("about swasthyasetu") ||
      clean.includes("swasthyasetu kya hai") || clean.includes("swasthyasetu andre enu") ||
      clean.includes("what does swasthyasetu do") || clean.includes("who is it for") ||
      clean.includes("is it free") || clean.includes("cost") || clean.includes("charges") ||
      clean.includes("paise lagte hain") || clean.includes("rural families") ||
      clean.includes("how does asha connection work") || clean.includes("platform") ||
      clean.includes("ಸ್ವಾಸ್ಥ್ಯಸೇತು") || clean.includes("ಸ್ವಾಸ್ಥ್ಯ ಸೇತು") || clean.includes("ಸ್ವಾಸ್ಥ್ಯಸೇತು ಎಂದರೇನು") ||
      clean.includes("swasthyasetu") || clean.includes("स्वास्थ्यसेतु") || clean.includes("स्वास्थ्य सेतु") ||
      clean.includes("स्वास्थ्यसेतु क्या है") || clean.includes("ಉಚಿತ") || clean.includes("ಉಚಿತವೇ") || clean.includes("मुफ्त")
    ) {
      return {
        intent: "ABOUT_SWASTHYASETU",
        confidence: 0.92,
        entities,
        topic: clean.includes("free") || clean.includes("cost") || clean.includes("paise") || clean.includes("ಉಚಿತ") || clean.includes("ಮುಫ಼್ತ್") || clean.includes("मुफ्त") || clean.includes("ಶುಲ್ಕ") ? "cost" :
               clean.includes("rural") || clean.includes("ಗ್ರಾಮೀಣ") || clean.includes("ग्रामीण") ? "rural_help" :
               clean.includes("who is it for") || clean.includes("ಯಾರಿಗೆ") || clean.includes("किसके लिए") ? "target_users" :
               clean.includes("asha connection") || clean.includes("ಆಶಾ ಸಂಪರ್ಕ") || clean.includes("आशा कनेक्शन") ? "asha_link" : "overview",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 5. Citizen Portal Overview / Concepts
    if (
      clean.includes("citizen dashboard") || clean.includes("my health benefits") ||
      clean.includes("ration category") || clean.includes("bpl") || clean.includes("aay") || clean.includes("apl") ||
      clean.includes("why may be eligible") || clean.includes("details needed") || clean.includes("why not eligible") ||
      clean.includes("what is my next step") || clean.includes("why is next step important")
    ) {
      return {
        intent: "CITIZEN_PORTAL_INFO",
        confidence: 0.88,
        entities,
        topic: clean.includes("ration") || clean.includes("bpl") || clean.includes("aay") ? "household_details" :
               clean.includes("status") || clean.includes("details needed") ? "scheme_status_meanings" :
               clean.includes("next step") ? "next_steps" : "dashboard",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 6. ASHA Portal / Caseload / Field Workflows
    if (
      clean.includes("asha portal") || clean.includes("needs attention") || clean.includes("caseload") ||
      clean.includes("assigned households") || clean.includes("case journey") || clean.includes("milestones") ||
      clean.includes("field tasks") || clean.includes("field priorities") || clean.includes("what is a case")
    ) {
      return {
        intent: "ASHA_PORTAL_INFO",
        confidence: 0.88,
        entities,
        topic: clean.includes("caseload") || clean.includes("assigned") ? "caseload" :
               clean.includes("journey") || clean.includes("milestones") || clean.includes("case") ? "case_journey" : "asha_dashboard",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 7. Admin Portal Concepts (Safe overview)
    if (
      clean.includes("admin portal") || clean.includes("what does admin do") ||
      clean.includes("scheme registry") || clean.includes("system monitoring")
    ) {
      return {
        intent: "ADMIN_PORTAL_INFO",
        confidence: 0.88,
        entities,
        topic: "admin_overview",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 8. Assistance Status & Case Progress
    if (
      clean.includes("status") || clean.includes("progress") || clean.includes("kaha tak") ||
      clean.includes("kab milega") || clean.includes("application status") || clean.includes("card status") ||
      clean.includes("ಸ್ಥಿತಿ") || clean.includes("ಪ್ರಗತಿ") || clean.includes("ಅರ್ಜಿ ಸ್ಥಿತಿ") ||
      clean.includes("स्थिति") || clean.includes("आवेदन स्थिति")
    ) {
      return {
        intent: "CHECK_ASSISTANCE_STATUS",
        confidence: 0.9,
        entities,
        schemeId: entities.schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 9. Follow-up Schedule / Doorstep Visits
    if (
      clean.includes("follow up") || clean.includes("followup") || clean.includes("visit") ||
      clean.includes("kab aayengi") || clean.includes("kab aayenge") || clean.includes("next visit") ||
      clean.includes("asha kab") || clean.includes("appointment") ||
      clean.includes("ಭೇಟಿ") || clean.includes("ಆಶಾ ಯಾವಾಗ ಬರುತ್ತಾರೆ") || clean.includes("ಮನೆಭೇಟಿ") ||
      clean.includes("दौरा") || clean.includes("आशा कब आएंगी")
    ) {
      return {
        intent: "CHECK_FOLLOW_UP",
        confidence: 0.88,
        entities,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 10. Request Assistance / Apply / Help with Scheme
    if (
      clean.includes("apply") || clean.includes("enroll") || clean.includes("banwana hai") ||
      clean.includes("apply karna hai") || clean.includes("request assistance") ||
      clean.includes("help") || clean.includes("madad") || clean.includes("sahayata") ||
      clean.includes("sahaya") || clean.includes("sahaya beku") || clean.includes("madad chahiye") ||
      clean.includes("help chahiye") || /\bform\b/.test(clean) ||
      clean.includes("ಅರ್ಜಿ ಸಲ್ಲಿಸಬೇಕು") || clean.includes("ಮಾಡಿಸಿಕೊಡಿ") || clean.includes("ನೋಂದಣಿ") ||
      clean.includes("ಸಹಾಯ ಬೇಕು") || clean.includes("ಸಹಾಯ") ||
      clean.includes("आवेदन करना है") || clean.includes("बनवाना है") || clean.includes("पंजीकरण") ||
      clean.includes("मदद") || clean.includes("सहायता")
    ) {
      // If it's a general "what can i ask" or "how to use bot" query without scheme or application intent, let it fall through to VOICE_ASSISTANT_HELP
      const isPureBotHelp =
        (clean.includes("what can i ask") || clean.includes("how can you help") || clean.includes("kya puch")) &&
        !entities.schemeId && !clean.includes("apply") && !clean.includes("card");

      if (!isPureBotHelp) {
        return {
          intent: "REQUEST_ASSISTANCE",
          confidence: 0.88,
          entities,
          schemeId: entities.schemeId,
          rawTranscript: raw,
          language: resolvedLanguage,
        };
      }
    }

    // 11. Contact ASHA Worker
    if (
      clean.includes("asha worker") || clean.includes("asha didi") || clean.includes("meri asha") ||
      clean.includes("contact asha") || clean.includes("asha number") || clean.includes("phone number") ||
      clean.includes("ಆಶಾ ಕಾರ್ಯಕರ್ತೆ") || clean.includes("ನಮ್ಮ ಆಶಾ") || clean.includes("ಆಶಾ ನಂಬರ್") ||
      clean.includes("ಫೋನ್ ನಂಬರ್") || clean.includes("आशा दीदी") || clean.includes("मेरी आशा") ||
      clean.includes("आशा नंबर") || clean.includes("फोन नंबर")
    ) {
      return {
        intent: "CONTACT_ASHA",
        confidence: 0.88,
        entities,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 12. Eligibility Query (Personal or Relative)
    // Matches: "My grandfather is 71. What schemes can he get?", "71 saal ke dadaji ke liye kya milega?",
    // "ನನ್ನ 71 ವರ್ಷದ ತಾತನಿಗೆ ಏನು ಸಿಗುತ್ತದೆ?", "Can my elderly father get this scheme?"
    const hasEligibilityWords =
      clean.includes("eligible") || clean.includes("eligibility") || clean.includes("patra") ||
      clean.includes("patrata") || clean.includes("yogyata") || clean.includes("milega") ||
      clean.includes("qualify") || clean.includes("ಅರ್ಹತೆ") ||
      clean.includes("ಸಿಗುತ್ತಾ") || clean.includes("ಸಿಗುವುದು") || clean.includes("पात्रता") || clean.includes("मिलेगा क्या");

    if (hasEligibilityWords || entities.age !== undefined || entities.relation || clean.includes("senior") || clean.includes("pregnant")) {
      // Check if relative mentioned without age (prompt for clarification)
      if (entities.relation && entities.age === undefined && !entities.pregnancyStatus) {
        const clarification =
          resolvedLanguage === "kn-IN"
            ? `ಖಂಡಿತ, ನಿಮ್ಮ ${entities.relation === "father" ? "ತಂದೆಯವರ" : "ಕುಟುಂಬದ ಸದಸ್ಯರ"} ವಯಸ್ಸು ಎಷ್ಟು?`
            : resolvedLanguage === "hi-IN"
            ? `ज़रूर, आपके ${entities.relation === "father" ? "पिताजी" : "पारिवारिक सदस्य"} की उम्र कितनी है?`
            : `Sure, how old is your ${entities.relation}?`;

        return {
          intent: "CHECK_ELIGIBILITY",
          confidence: 0.85,
          entities,
          schemeId: entities.schemeId,
          clarificationPrompt: clarification,
          rawTranscript: raw,
          language: resolvedLanguage,
        };
      }

      return {
        intent: "CHECK_ELIGIBILITY",
        confidence: 0.9,
        entities,
        schemeId: entities.schemeId || (entities.pregnancyStatus ? "jsy" : "ab-pmjay"),
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 13. Specific Scheme Information ("What is PM-JAY?", "Tell me about JSY", "Benefits of PMMVY")
    if (
      (clean.includes("what is") || clean.includes("tell me about") || clean.includes("benefits") ||
       clean.includes("kya hai") || clean.includes("andre enu") || clean.includes("yojana") ||
       clean.includes("ಏನು") || clean.includes("ಎಂದರೇನು") || clean.includes("ತಿಳಿಸಿ") || clean.includes("ವಿವರ") ||
       clean.includes("क्या है") || clean.includes("बताएं") || clean.includes("जानकारी")) &&
      entities.schemeId
    ) {
      return {
        intent: "CHECK_SCHEMES",
        confidence: 0.9,
        entities,
        schemeId: entities.schemeId,
        topic: entities.schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 14. General Public Scheme List
    if (
      clean.includes("scheme") || clean.includes("yojana") || clean.includes("sarkari") ||
      clean.includes("benefits") || clean.includes("list") || clean.includes("ಯೋಜನೆ") ||
      clean.includes("ಸರ್ಕಾರಿ") || clean.includes("योजना") || clean.includes("सरकारी")
    ) {
      return {
        intent: "CHECK_SCHEMES",
        confidence: 0.82,
        entities,
        schemeId: entities.schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 15. General Help / What Can I Ask
    if (
      clean.includes("help") || clean.includes("what can i ask") || clean.includes("kya puch sakte") ||
      clean.includes("enu kelabahudu") || clean.includes("madad") || clean.includes("ಸಹಾಯ")
    ) {
      return {
        intent: "VOICE_ASSISTANT_HELP",
        confidence: 0.85,
        entities,
        topic: "how_to_interact",
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 16. Greeting
    if (
      clean.includes("namaste") || clean.includes("hello") || clean.includes("hi") ||
      clean.includes("pranam") || clean.includes("vanakkam") || clean.includes("namaskara") ||
      clean.includes("ನಮಸ್ಕಾರ") || clean.includes("ಹಲೋ") || clean.includes("नमस्ते") || clean.includes("प्रणाम")
    ) {
      return {
        intent: "GREETING",
        confidence: 0.9,
        entities,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 17. Unknown Fallback
    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      entities,
      rawTranscript: raw,
      language: resolvedLanguage,
    };
  }
}

export const multilingualNLU = new MultilingualNLU();
