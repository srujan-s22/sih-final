/**
 * ==============================================================================
 * SWASTHYASETU NFC ACCESSIBLE READ-ALOUD HELPER (PHASE 5)
 * ==============================================================================
 * Dedicated, SSR-safe builder for speech synthesis narration text.
 *
 * STRICT PRIVACY BOUNDARY (Sections 11 & 39):
 * - Uses ONLY an explicit allowlist of approved visible public fields:
 *     ✓ household.displayName
 *     ✓ household.region (village, district, state)
 *     ✓ schemes[].name, benefit, nextSteps
 *     ✓ asha.displayName, serviceArea
 * - FORBIDDEN: Raw objects, bearer tokens, token hashes, UIDs, member rosters,
 *   diagnoses, income, phone numbers, or database paths MUST NEVER enter speech synthesis.
 */

import { NfcResolveResponse } from "@shared/types/nfc";

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

/**
 * Constructs clean, natural, plain-language spoken text for the household NFC card.
 * Formulates sentences appropriately in English, Hindi, and Kannada.
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

  let speech = "";

  if (language === "hi") {
    // Hindi narration
    speech = `${household.displayName} के परिवार के लिए स्वास्थ्य लाभ। `;
    if (locationStr) {
      speech += `स्थान: ${locationStr}। `;
    }

    if (schemes.length > 0) {
      speech += `उपलब्ध लाभ: `;
      schemes.forEach((scheme, index) => {
        speech += `${index + 1}. ${scheme.name}. ${scheme.benefit}. आगे क्या करना है: ${scheme.nextSteps}. `;
      });
    } else {
      speech += `इस परिवार के लिए अभी कोई सूचीबद्ध योजना नहीं मिली है। आपकी आशा कार्यकर्ता अन्य योजनाओं की जांच में मदद कर सकती हैं। `;
    }

    if (asha) {
      speech += `आपकी आशा कार्यकर्ता ${asha.displayName} हैं, सेवा क्षेत्र: ${asha.serviceArea}। `;
    }
  } else if (language === "kn") {
    // Kannada narration
    speech = `${household.displayName} ಅವರ ಕುಟುಂಬಕ್ಕೆ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು. `;
    if (locationStr) {
      speech += `ಸ್ಥಳ: ${locationStr}. `;
    }

    if (schemes.length > 0) {
      speech += `ಲಭ್ಯವಿರುವ ಸೌಲಭ್ಯಗಳು: `;
      schemes.forEach((scheme, index) => {
        speech += `${index + 1}. ${scheme.name}. ${scheme.benefit}. ಮುಂದೆ ಏನು ಮಾಡಬೇಕು: ${scheme.nextSteps}. `;
      });
    } else {
      speech += `ಈ ಕುಟುಂಬಕ್ಕೆ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಯೋಜನೆಗಳು ಪಟ್ಟಿಯಾಗಿಲ್ಲ. ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಇತರ ಯೋಜನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಸಹಾಯ ಮಾಡಬಹುದು. `;
    }

    if (asha) {
      speech += `ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ${asha.displayName}, ಸೇವಾ ವ್ಯಾಪ್ತಿ: ${asha.serviceArea}. `;
    }
  } else {
    // English default
    speech = `Health benefits for ${household.displayName}. `;
    if (locationStr) {
      speech += `Location: ${locationStr}. `;
    }

    if (schemes.length > 0) {
      speech += `Available benefits: `;
      schemes.forEach((scheme, index) => {
        speech += `${index + 1}. ${scheme.name}. ${scheme.benefit}. What to do next: ${scheme.nextSteps}. `;
      });
    } else {
      speech += `No listed benefits were found for this household right now. Your ASHA worker can help check whether another benefit applies. `;
    }

    if (asha) {
      speech += `Your ASHA worker is ${asha.displayName}, serving ${asha.serviceArea}. `;
    }
  }

  return speech.trim();
}
