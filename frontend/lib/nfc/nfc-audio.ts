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
  scheme: NfcPublicSchemeSummary,
  language: "en" | "hi" | "kn" | string
): LocalizedSchemeContent {
  if (scheme.schemeId === "ab-pmjay") {
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

  if (scheme.schemeId === "jsy") {
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

  return {
    name: scheme.name,
    benefit: scheme.benefit,
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
      rawSpeech += `आपकी आशा कार्यकर्ता ${asha.displayName} हैं, सेवा क्षेत्र: ${asha.serviceArea}। `;
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
      rawSpeech += `ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ${asha.displayName}, ಸೇವಾ ವ್ಯಾಪ್ತಿ: ${asha.serviceArea}. `;
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
