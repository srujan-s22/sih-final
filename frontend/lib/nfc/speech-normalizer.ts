/**
 * ==============================================================================
 * SWASTHYASETU NFC SPEECH NORMALIZATION UTILITY
 * ==============================================================================
 * Prepares raw displayed text into natural, pronunciation-friendly spoken words
 * across English, Hindi, and Kannada.
 *
 * Handles:
 * - Indian currency (₹5,00,000 -> 5 lakh rupees / 5 लाख रुपये / 5 ಲಕ್ಷ ರೂಪಾಯಿ)
 * - Ages (70+ -> 70 years and above / 70 वर्ष से अधिक / 70 ವರ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು)
 * - Member counts (4 members -> 4 सदस्य / 4 ಸದಸ್ಯರು)
 * - Phone numbers (08047283240 -> digit sequence with pauses for clear TTS pronunciation)
 * - Identifiers & PIN codes (RC-876567890 -> spaced letters & digits)
 * - Proper nouns & scheme abbreviations (PM-JAY, JSY, NFC)
 *
 * CRITICAL RULE: Visible UI text is NEVER altered. Only text sent to speech synthesis
 * is normalized.
 */

/**
 * Normalizes Indian currency amounts into natural spoken phrases.
 * e.g. "₹5,00,000" -> "5 lakh rupees" / "5 लाख रुपये" / "5 ಲಕ್ಷ ರೂಪಾಯಿ"
 * e.g. "₹1,400"    -> "1 thousand 400 rupees" / "1 हजार 400 रुपये" / "1 ಸಾವಿರ 400 ರೂಪಾಯಿ"
 */
export function normalizeCurrency(text: string, language: string): string {
  if (!text) return "";

  // 1. Match ₹5,00,000 or ₹ 5,00,000 or ₹500000 or ₹5 Lakh / Lakhs
  let result = text.replace(/₹\s*5[,.]?00[,.]?000(?:\/[-=])?/gi, () => {
    switch (language) {
      case "hi":
        return "5 लाख रुपये";
      case "kn":
        return "5 ಲಕ್ಷ ರೂಪಾಯಿ";
      default:
        return "5 lakh rupees";
    }
  });

  // 2. Match ₹1,400 or ₹ 1,400 or ₹1400
  result = result.replace(/₹\s*1[,.]?400(?:\/[-=])?/gi, () => {
    switch (language) {
      case "hi":
        return "1 हजार 400 रुपये";
      case "kn":
        return "1 ಸಾವಿರ 400 ರೂಪಾಯಿ";
      default:
        return "1 thousand 400 rupees";
    }
  });

  // 3. Match generic ₹X lakh / lakhs
  result = result.replace(/₹\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b/gi, (_match, num) => {
    switch (language) {
      case "hi":
        return `${num} लाख रुपये`;
      case "kn":
        return `${num} ಲಕ್ಷ ರೂಪಾಯಿ`;
      default:
        return `${num} lakh rupees`;
    }
  });

  // 4. Match generic ₹X crore / crores
  result = result.replace(/₹\s*(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)\b/gi, (_match, num) => {
    switch (language) {
      case "hi":
        return `${num} करोड़ रुपये`;
      case "kn":
        return `${num} ಕೋಟಿ ರೂಪಾಯಿ`;
      default:
        return `${num} crore rupees`;
    }
  });

  // 5. Match round thousand amounts like ₹5,000, ₹6,000, ₹1,000, ₹2,000, ₹3,000
  result = result.replace(/₹\s*([1-9]\d*)[,.]000(?:\/[-=])?\b/gi, (_match, thousands) => {
    switch (language) {
      case "hi":
        return `${thousands} हजार रुपये`;
      case "kn":
        return `${thousands} ಸಾವಿರ ರೂಪಾಯಿ`;
      default:
        return `${thousands} thousand rupees`;
    }
  });

  // 6. Match any other ₹ amount with Indian comma formatting (e.g. ₹500, ₹2,500)
  result = result.replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, (_match, num) => {
    const cleanNum = num.replace(/,/g, "");
    switch (language) {
      case "hi":
        return `${cleanNum} रुपये`;
      case "kn":
        return `${cleanNum} ರೂಪಾಯಿ`;
      default:
        return `${cleanNum} rupees`;
    }
  });

  return result;
}

/**
 * Normalizes age indicators like "70+" into clear spoken language.
 * e.g. "70+" -> "70 years and above" / "70 वर्ष से अधिक" / "70 ವರ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು"
 */
export function normalizeAges(text: string, language: string): string {
  if (!text) return "";

  return text.replace(/\b(\d+)\s*\+/g, (_match, age) => {
    switch (language) {
      case "hi":
        return `${age} वर्ष से अधिक`;
      case "kn":
        return `${age} ವರ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು`;
      default:
        return `${age} years and above`;
    }
  });
}

/**
 * Normalizes member counts into natural spoken phrases.
 * e.g. "4 members" -> "4 सदस्य" / "4 ಸದಸ್ಯರು"
 */
export function normalizeMemberCount(text: string, language: string): string {
  if (!text) return "";

  return text.replace(/\b(\d+)\s*members?\b/gi, (_match, count) => {
    switch (language) {
      case "hi":
        return `${count} सदस्य`;
      case "kn":
        return `${count} ಸದಸ್ಯರು`;
      default:
        return `${count} members`;
    }
  });
}

/**
 * Normalizes telephone numbers into individual spoken digits separated by pauses.
 * This prevents speech synthesis engines from reading a 10/11 digit telephone
 * number as a large multi-billion integer.
 *
 * e.g. "08047283240" -> "0, 8, 0, 4, 7, 2, 8, 3, 2, 4, 0"
 */
export function normalizePhoneNumberForSpeech(phone: string): string {
  if (!phone) return "";
  const digitsOnly = phone.trim().replace(/[^\d]/g, "");
  if (digitsOnly.length >= 7) {
    return digitsOnly.split("").join(", ");
  }
  return phone;
}

/**
 * Normalizes identifier strings (ration cards, codes, PIN codes) so they are
 * spelled out rather than read as huge integers.
 * e.g. "RC-876567890" -> "R C, 8 7 6 5 6 7 8 9 0"
 * e.g. "562112" -> "5, 6, 2, 1, 1, 2"
 */
export function normalizeIdentifier(id: string, language: string): string {
  if (!id) return "";

  if (/^RC[-_]/i.test(id.trim())) {
    const parts = id.trim().split(/[-_]/);
    const prefix = language === "hi" ? "आर सी" : language === "kn" ? "ಆರ್ ಸಿ" : "R C";
    const restSpaced = parts
      .slice(1)
      .map((part) => (/^\d+$/.test(part) ? part.split("").join(", ") : part.split("").join(" ")))
      .join(", ");
    return `${prefix}, ${restSpaced}`;
  }

  if (/^\d{6}$/.test(id.trim())) {
    return id.trim().split("").join(", ");
  }

  return id;
}

/**
 * Normalizes technical abbreviations into pronunciation-friendly forms.
 */
export function normalizeProperNouns(text: string, language: string): string {
  if (!text) return "";

  let result = text;

  if (language === "hi") {
    result = result
      .replace(/\b(?:AB-PMJAY|PM-JAY|PMJAY)\b/g, "आयुष्मान भारत पीएम-जेएवाई")
      .replace(/\b(?:PMMVY)\b/g, "प्रधानमंत्री मातृ वंदना योजना पीएमएमवीवाई")
      .replace(/\b(?:DBT)\b/g, "डीबीटी")
      .replace(/\b(?:JSSK)\b/g, "जननी शिशु सुरक्षा कार्यक्रम जेएसएसके")
      .replace(/\bJSY\b/g, "जननी सुरक्षा योजना जेएसवाई")
      .replace(/\bNFC\b/g, "एनएफसी")
      .replace(/\bASHA\b/g, "आशा");
  } else if (language === "kn") {
    result = result
      .replace(/\b(?:AB-PMJAY|PM-JAY|PMJAY)\b/g, "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಪಿಎಂ-ಜೆಎವೈ")
      .replace(/\b(?:PMMVY)\b/g, "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ ಪಿಎಂಎಂವಿವೈ")
      .replace(/\b(?:DBT)\b/g, "ಡಿಬಿಟಿ")
      .replace(/\b(?:JSSK)\b/g, "ಜನನಿ ಶಿಶು ಸುರಕ್ಷಾ ಕಾರ್ಯಕ್ರಮ ಜೆಎಸ್‌ಎಸ್‌ಕೆ")
      .replace(/\bJSY\b/g, "ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ ಜೆಎಸ್ ವೈ")
      .replace(/\bNFC\b/g, "ಎನ್‌ಎಫ್‌ಸಿ")
      .replace(/\bASHA\b/g, "ಆಶಾ");
  } else {
    result = result
      .replace(/\b(?:AB-PMJAY|PM-JAY|PMJAY)\b/g, "Ayushman Bharat P M Jay")
      .replace(/\b(?:PMMVY)\b/g, "Pradhan Mantri Matru Vandana Yojana P M M V Y")
      .replace(/\b(?:DBT)\b/g, "D B T")
      .replace(/\b(?:JSSK)\b/g, "Janani Shishu Suraksha Karyakram J S S K")
      .replace(/\bJSY\b/g, "Janani Suraksha Yojana J S Y")
      .replace(/\bNFC\b/g, "N F C")
      .replace(/\bASHA\b/g, "ASHA");
  }

  return result;
}

/**
 * Comprehensive speech text preparation pipeline.
 * Normalizes all elements (currency, ages, members, phone numbers, proper nouns)
 * in order for the target language.
 */
export function normalizeSpeechText(text: string, language: string): string {
  if (!text) return "";

  let prepared = text;

  // 1. Currency
  prepared = normalizeCurrency(prepared, language);

  // 2. Ages (e.g. 70+)
  prepared = normalizeAges(prepared, language);

  // 3. Member counts
  prepared = normalizeMemberCount(prepared, language);

  // 4. Proper nouns & scheme abbreviations
  prepared = normalizeProperNouns(prepared, language);

  // 5. Standalone phone numbers in text (10 or 11 digits)
  prepared = prepared.replace(/\b(0\d{10}|[6-9]\d{9})\b/g, (match) => {
    return normalizePhoneNumberForSpeech(match);
  });

  // 6. Clean up repeated commas or awkward spacing
  prepared = prepared
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  return prepared;
}
