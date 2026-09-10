/**
 * ==============================================================================
 * SWASTHYASETU NFC ACCESSIBLE READ-ALOUD HELPER
 * ==============================================================================
 * Dedicated, SSR-safe builder for speech synthesis narration text.
 *
 * STRICT PRIVACY BOUNDARY:
 * - Uses ONLY an explicit allowlist of approved visible public fields:
 *     ✓ household.displayName
 *     ✓ household.region (village, district, state)
 *     ✓ schemes[].name, benefit (localized when available)
 *     ✓ asha.displayName, serviceArea
 *     ✓ public helpline (08047283240)
 * - FORBIDDEN: Raw objects, bearer tokens, token hashes, UIDs, member rosters,
 *   diagnoses, income, private household phone numbers MUST NEVER enter speech synthesis.
 *
 * UX ENHANCEMENT:
 * - "What to do next" (nextSteps) is REMOVED from simplified scheme cards & speech.
 * - Normalized with speech-normalizer for natural pronunciation of currency,
 *   ages (70+), numbers, phone sequences, and proper nouns.
 */

import { NfcResolveResponse, NfcPublicSchemeSummary } from "@shared/types/nfc";
import { normalizeSpeechText } from "./speech-normalizer";

/**
 * Maps application language code to standard BCP-47 locale tag for Indian speech synthesis.
 */
export function getSpeechSynthesisLang(language: string): string {
  switch (language) {
    case "hi":
      return "hi-IN";
    case "kn":
      return "kn-IN";
    default:
      return "en-IN";
  }
}

export interface LocalizedSchemeContent {
  name: string;
  benefit: string;
}

/**
 * Resolves localized scheme title and benefit description for known government schemes.
 * Falls back to server-provided strings for custom or newly registered schemes.
 */
export function getLocalizedScheme(
  scheme: { schemeId?: string; name?: string; benefit?: string },
  language: "en" | "hi" | "kn" | string
): LocalizedSchemeContent {
  const sId = (scheme.schemeId || "").toLowerCase().trim();
  const sName = (scheme.name || "").toLowerCase().trim();

  // 1. AB-PMJAY (Senior Citizens 70+ / Universal)
  if (
    sId === "ab-pmjay" ||
    sId.includes("pmjay") ||
    sName.includes("jan arogya") ||
    sName.includes("ayushman bharat")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "आयुष्मान भारत — प्रधानमंत्री जन आरोग्य योजना (AB-PMJAY 70+)",
          benefit:
            "देशभर के सूचीबद्ध अस्पतालों में 70 वर्ष और उससे अधिक आयु के वरिष्ठ नागरिकों के लिए प्रति वर्ष ₹5,00,000 तक का मुफ्त अस्पताल उपचार कवर।",
        };
      case "kn":
        return {
          name: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ — ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಆರೋಗ್ಯ ಯೋಜನೆ (AB-PMJAY 70+)",
          benefit:
            "ನೋಂದಾಯಿತ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ 70 ವರ್ಷ ಮತ್ತು ಮೇಲ್ಪಟ್ಟ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಪ್ರತಿ ವರ್ಷ ₹5,00,000 ವರೆಗೆ ಉಚಿತ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆ ಸೌಲಭ್ಯ.",
        };
      default:
        return {
          name: scheme.name || "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (AB-PMJAY 70+)",
          benefit:
            scheme.benefit ||
            "Up to ₹5,00,000 per year secondary and tertiary hospital cover for senior citizens aged 70+ across empaneled hospitals nationwide.",
        };
    }
  }

  // 2. JSY (Janani Suraksha Yojana)
  if (
    sId === "jsy" ||
    sId.includes("jsy") ||
    sName.includes("janani suraksha")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "जननी सुरक्षा योजना (JSY)",
          benefit:
            "मान्यता प्राप्त सरकारी या निजी स्वास्थ्य केंद्रों में संस्थागत प्रसव कराने वाली गर्भवती महिलाओं के लिए प्रत्यक्ष नकद सहायता और मातृत्व देखभाल।",
        };
      case "kn":
        return {
          name: "ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ (JSY)",
          benefit:
            "ಅಂಗೀಕೃತ ಸರ್ಕಾರಿ ಅಥವಾ ಖಾಸಗಿ ಆರೋಗ್ಯ ಕೇಂದ್ರಗಳಲ್ಲಿ ಹೆರಿಗೆ ಮಾಡಿಸುವ ಗರ್ಭಿಣಿಯರಿಗೆ ನೇರ ಆರ್ಥಿಕ ನೆರವು ಮತ್ತು ತಾಯಿ ಆರೈಕೆ ಸೌಲಭ್ಯ.",
        };
      default:
        return {
          name: scheme.name || "Janani Suraksha Yojana (JSY)",
          benefit:
            scheme.benefit ||
            "Direct cash assistance and maternal care for pregnant women delivering in accredited public or private health centers.",
        };
    }
  }

  // 3. PMMVY (Pradhan Mantri Matru Vandana Yojana)
  if (
    sId === "pmmvy" ||
    sId.includes("pmmvy") ||
    sName.includes("matru vandana") ||
    sName.includes("matrivandana")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "प्रधानमंत्री मातृ वंदना योजना (PMMVY)",
          benefit:
            "पहले जीवित बच्चे के लिए दो किस्तों में ₹5,000 और दूसरी कन्या शिशु होने पर ₹6,000 की प्रत्यक्ष लाभ अंतरण (DBT) वित्तीय सहायता।",
        };
      case "kn":
        return {
          name: "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ (PMMVY)",
          benefit:
            "ಮೊದಲ ಮಗುವಿಗೆ ಎರಡು ಕಂತುಗಳಲ್ಲಿ ₹5,000 ಮತ್ತು ಎರಡನೇ ಮಗು ಹೆಣ್ಣಾಗಿದ್ದಲ್ಲಿ ಒಂದೇ ಕಂತಿನಲ್ಲಿ ₹6,000 ನೇರ ನಗದು ವರ್ಗಾವಣೆ (DBT) ಆರ್ಥಿಕ ನೆರವು.",
        };
      default:
        return {
          name: scheme.name || "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
          benefit:
            scheme.benefit ||
            "Direct Benefit Transfer (DBT) of ₹5,000 in two installments for the first living child, and ₹6,000 in a single installment for a second child if the infant is a girl.",
        };
    }
  }

  // 4. JSSK (Janani Shishu Suraksha Karyakram)
  if (
    sId === "jssk" ||
    sId.includes("jssk") ||
    sName.includes("shishu suraksha")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "जननी शिशु सुरक्षा कार्यक्रम (JSSK)",
          benefit:
            "सरकारी स्वास्थ्य संस्थानों में गर्भवती महिलाओं और नवजात शिशुओं के लिए पूरी तरह से मुफ्त और कैशलेस प्रसव और उपचार।",
        };
      case "kn":
        return {
          name: "ಜನನಿ ಶಿಶು ಸುರಕ್ಷಾ ಕಾರ್ಯಕ್ರಮ (JSSK)",
          benefit:
            "ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಕೇಂದ್ರಗಳಲ್ಲಿ ಗರ್ಭಿಣಿಯರಿಗೆ ಮತ್ತು ನವಜಾತ ಶಿಶುಗಳಿಗೆ ಸಂಪೂರ್ಣ ಉಚಿತ ಮತ್ತು ನಗದುರಹಿತ ಹೆರಿಗೆ ಹಾಗೂ ಶಿಶು ಆರೈಕೆ ಸೌಲಭ್ಯ.",
        };
      default:
        return {
          name: scheme.name || "Janani Shishu Suraksha Karyakram (JSSK)",
          benefit:
            scheme.benefit ||
            "Completely free and cashless delivery and newborn care in public health facilities.",
        };
    }
  }

  // 5. AB-ArK (Ayushman Bharat - Arogya Karnataka)
  if (
    sId === "ab-ark-karnataka" ||
    sId.includes("ark") ||
    sName.includes("arogya karnataka")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "आयुष्मान भारत – आरोग्य कर्नाटक (AB-ArK)",
          benefit:
            "कर्नाटक में पात्र बीपीएल/एएवाई परिवारों के लिए ₹5,00,000 तक और सामान्य श्रेणी के लिए ₹1,50,000 तक का वार्षिक तृतीयक स्वास्थ्य सेवा कवर।",
        };
      case "kn":
        return {
          name: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ – ಆರೋಗ್ಯ ಕರ್ನಾಟಕ (AB-ArK)",
          benefit:
            "ಕರ್ನಾಟಕದಲ್ಲಿ ಅರ್ಹ ಬಿಪಿಎಲ್/ಎಎವೈ ಕುಟುಂಬಗಳಿಗೆ ₹5,00,000 ವರೆಗೆ ಹಾಗೂ ಸಾಮಾನ್ಯ ವರ್ಗಕ್ಕೆ ₹1,50,000 ವರೆಗೆ ವಾರ್ಷಿಕ ತೃತೀಯ ಹಂತದ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸಾ ರಕ್ಷಣೆ.",
        };
      default:
        return {
          name: scheme.name || "Ayushman Bharat – Arogya Karnataka (AB-ArK)",
          benefit:
            scheme.benefit ||
            "Up to ₹5,00,000 yearly tertiary healthcare cover for eligible BPL/AAY families and ₹1,50,000 for general category in Karnataka.",
        };
    }
  }

  // 6. State Health Assurance
  if (
    sId === "state-health-assurance" ||
    sName.includes("state health assurance") ||
    sName.includes("universal health assurance")
  ) {
    switch (language) {
      case "hi":
        return {
          name: "राज्य स्वास्थ्य आश्वासन कार्यक्रम",
          benefit:
            "राज्य के नेटवर्क अस्पतालों में कैशलेस तृतीयक देखभाल, गंभीर बीमारी कवर और नैदानिक सहायता।",
        };
      case "kn":
        return {
          name: "ರಾಜ್ಯ ಆರೋಗ್ಯ ಭರವಸೆ ಕಾರ್ಯಕ್ರಮ",
          benefit:
            "ರಾಜ್ಯ ನೆಟ್‌ವರ್ಕ್ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ನಗದುರಹಿತ ತೃತೀಯ ಹಂತದ ಆರೈಕೆ, ಗಂಭೀರ ಕಾಯಿಲೆಗಳ ಚಿಕಿತ್ಸೆ ಮತ್ತು ತಪಾಸಣಾ ನೆರವು.",
        };
      default:
        return {
          name: scheme.name || "State Universal Health Assurance Program",
          benefit:
            scheme.benefit ||
            "Cashless tertiary care, critical illness coverage, and diagnostic support across state network hospitals.",
        };
    }
  }

  return {
    name: scheme.name || "",
    benefit: scheme.benefit || "",
  };
}

/**
 * Constructs clean, natural, plain-language spoken text for the household NFC card.
 * Formulates sentences appropriately in English, Hindi, and Kannada.
 *
 * NOTE: "What to do next" has been intentionally removed to keep speech concise
 * and aligned with the simplified scheme card design.
 */
export function buildHouseholdSpeechText(
  data: NfcResolveResponse,
  language: "en" | "hi" | "kn" | string
): string {
  if (!data || !data.household) {
    return "";
  }

  const { household, schemes = [], asha } = data;

  // Build safe location string from allowlisted region fields only
  const locationParts = [
    household.region?.village,
    household.region?.district,
    household.region?.state,
  ].filter(Boolean);
  const locationStr = locationParts.join(", ");

  let rawSpeech = "";

  if (language === "hi") {
    // Hindi narration
    rawSpeech = `${household.displayName} के परिवार के लिए स्वास्थ्य लाभ। `;
    if (locationStr) {
      rawSpeech += `स्थान: ${locationStr}। `;
    }

    if (schemes.length > 0) {
      rawSpeech += `उपलब्ध लाभ: `;
      schemes.forEach((scheme, index) => {
        const loc = getLocalizedScheme(scheme, "hi");
        rawSpeech += `${index + 1}. ${loc.name}। ${loc.benefit}। `;
      });
    } else {
      rawSpeech += `इस परिवार के लिए अभी कोई सूचीबद्ध योजना नहीं मिली है। आपकी आशा कार्यकर्ता अन्य योजनाओं की जांच में मदद कर सकती हैं। `;
    }

    if (asha) {
      const area = asha.serviceArea === "Field Jurisdiction" ? "कार्यक्षेत्र" : asha.serviceArea;
      rawSpeech += `आपकी आशा कार्यकर्ता ${asha.displayName} हैं, सेवा क्षेत्र: ${area}। `;
    }

    rawSpeech += `सहायता के लिए स्वास्थ्य हेल्पलाइन 08047283240 पर कॉल करें।`;
  } else if (language === "kn") {
    // Kannada narration
    rawSpeech = `${household.displayName} ಅವರ ಕುಟುಂಬಕ್ಕೆ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು. `;
    if (locationStr) {
      rawSpeech += `ಸ್ಥಳ: ${locationStr}. `;
    }

    if (schemes.length > 0) {
      rawSpeech += `ಲಭ್ಯವಿರುವ ಸೌಲಭ್ಯಗಳು: `;
      schemes.forEach((scheme, index) => {
        const loc = getLocalizedScheme(scheme, "kn");
        rawSpeech += `${index + 1}. ${loc.name}. ${loc.benefit}. `;
      });
    } else {
      rawSpeech += `ಈ ಕುಟುಂಬಕ್ಕೆ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಯೋಜನೆಗಳು ಪಟ್ಟಿಯಾಗಿಲ್ಲ. ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಇತರ ಯೋಜನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಸಹಾಯ ಮಾಡಬಹುದು. `;
    }

    if (asha) {
      const area = asha.serviceArea === "Field Jurisdiction" ? "ಕ್ಷೇತ್ರ ವ್ಯಾಪ್ತಿ" : asha.serviceArea;
      rawSpeech += `ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ${asha.displayName}, ಸೇವಾ ವ್ಯಾಪ್ತಿ: ${area}. `;
    }

    rawSpeech += `ಸಹಾಯಕ್ಕಾಗಿ ಆರೋಗ್ಯ ಸಹಾಯವಾಣಿ 08047283240 ಗೆ ಕರೆ ಮಾಡಿ.`;
  } else {
    // English default
    rawSpeech = `Health benefits for ${household.displayName}. `;
    if (locationStr) {
      rawSpeech += `Location: ${locationStr}. `;
    }

    if (schemes.length > 0) {
      rawSpeech += `Available benefits: `;
      schemes.forEach((scheme, index) => {
        const loc = getLocalizedScheme(scheme, "en");
        rawSpeech += `${index + 1}. ${loc.name}. ${loc.benefit}. `;
      });
    } else {
      rawSpeech += `No listed benefits were found for this household right now. Your ASHA worker can help check whether another benefit applies. `;
    }

    if (asha) {
      rawSpeech += `Your ASHA worker is ${asha.displayName}, serving ${asha.serviceArea}. `;
    }

    rawSpeech += `For assistance, call healthcare helpline at 08047283240.`;
  }

  // Pass through deterministic normalization pipeline (currency, ages, phone numbers, proper nouns)
  return normalizeSpeechText(rawSpeech, language);
}
