/**
 * ==============================================================================
 * SWASTHYASETU NFC SPEECH VOICE SELECTION
 * ==============================================================================
 * Selects the optimal SpeechSynthesisVoice for the requested language.
 *
 * SPECIFICATION & FALLBACK STRATEGY:
 * - Kannada (kn):
 *     1. Exact kn-IN locale match
 *     2. Any kn language prefix match
 *     3. Indian English (en-IN) as final fallback
 *     4. Any English voice
 * - Hindi (hi):
 *     1. Exact hi-IN locale match
 *     2. Any hi language prefix match
 *     3. Indian English (en-IN) as final fallback
 *     4. Any English voice
 * - English (en):
 *     1. Exact en-IN locale match or Indian English voice name
 *     2. en-GB / en-US
 *     3. Any English voice
 *
 * CRITICAL REFINEMENTS:
 * 1. Never assume every device/browser has native hi-IN or kn-IN voices.
 * 2. Prefer the requested native locale voice when available.
 * 3. Use the planned fallback chain when unavailable.
 * 4. Never claim or imply that a native-language voice is guaranteed.
 * 5. Keep normalized speech text appropriate for the selected language.
 * 6. NEVER silently switch the UI language because of voice availability.
 */

export interface SpeechSynthesisVoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
  voiceURI?: string;
}

export interface VoiceSelectionResult {
  voice: SpeechSynthesisVoiceLike | null;
  langTag: string;
  isNativeVoice: boolean;
  isFallback: boolean;
}

/**
 * Normalizes BCP-47 locale tag strings for matching (e.g. "kn_IN" -> "kn-in")
 */
function normalizeLocale(tag: string): string {
  return (tag || "").toLowerCase().replace(/_/g, "-");
}

/**
 * Selects the best matching SpeechSynthesisVoice from the browser's available voices.
 */
export function selectBestSpeechVoice<T extends SpeechSynthesisVoiceLike = SpeechSynthesisVoiceLike>(
  voices: T[],
  language: "en" | "hi" | "kn" | string
): {
  voice: T | null;
  langTag: string;
  isNativeVoice: boolean;
  isFallback: boolean;
} {
  if (!voices || voices.length === 0) {
    const defaultTag = language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-IN";
    return {
      voice: null,
      langTag: defaultTag,
      isNativeVoice: false,
      isFallback: true,
    };
  }

  // Kannada voice selection
  if (language === "kn") {
    // 1. Exact kn-IN match
    const knIn = voices.find((v) => normalizeLocale(v.lang) === "kn-in");
    if (knIn) {
      return { voice: knIn, langTag: knIn.lang, isNativeVoice: true, isFallback: false };
    }

    // 2. Any Kannada voice
    const knAny = voices.find((v) => normalizeLocale(v.lang).startsWith("kn"));
    if (knAny) {
      return { voice: knAny, langTag: knAny.lang, isNativeVoice: true, isFallback: false };
    }

    // 3. Indian English fallback
    const enIn = voices.find(
      (v) =>
        normalizeLocale(v.lang) === "en-in" ||
        v.name.toLowerCase().includes("india") ||
        v.name.toLowerCase().includes("indian")
    );
    if (enIn) {
      return { voice: enIn, langTag: "en-IN", isNativeVoice: false, isFallback: true };
    }

    // 4. Any English voice
    const enAny = voices.find((v) => normalizeLocale(v.lang).startsWith("en"));
    if (enAny) {
      return { voice: enAny, langTag: enAny.lang, isNativeVoice: false, isFallback: true };
    }

    return { voice: voices[0], langTag: voices[0].lang, isNativeVoice: false, isFallback: true };
  }

  // Hindi voice selection
  if (language === "hi") {
    // 1. Exact hi-IN match
    const hiIn = voices.find((v) => normalizeLocale(v.lang) === "hi-in");
    if (hiIn) {
      return { voice: hiIn, langTag: hiIn.lang, isNativeVoice: true, isFallback: false };
    }

    // 2. Any Hindi voice
    const hiAny = voices.find((v) => normalizeLocale(v.lang).startsWith("hi"));
    if (hiAny) {
      return { voice: hiAny, langTag: hiAny.lang, isNativeVoice: true, isFallback: false };
    }

    // 3. Indian English fallback
    const enIn = voices.find(
      (v) =>
        normalizeLocale(v.lang) === "en-in" ||
        v.name.toLowerCase().includes("india") ||
        v.name.toLowerCase().includes("indian")
    );
    if (enIn) {
      return { voice: enIn, langTag: "en-IN", isNativeVoice: false, isFallback: true };
    }

    // 4. Any English voice
    const enAny = voices.find((v) => normalizeLocale(v.lang).startsWith("en"));
    if (enAny) {
      return { voice: enAny, langTag: enAny.lang, isNativeVoice: false, isFallback: true };
    }

    return { voice: voices[0], langTag: voices[0].lang, isNativeVoice: false, isFallback: true };
  }

  // English voice selection
  // 1. Indian English (en-IN)
  const enIn = voices.find(
    (v) =>
      normalizeLocale(v.lang) === "en-in" ||
      v.name.toLowerCase().includes("india") ||
      v.name.toLowerCase().includes("indian")
  );
  if (enIn) {
    return { voice: enIn, langTag: enIn.lang, isNativeVoice: true, isFallback: false };
  }

  // 2. en-GB or en-US
  const enGb = voices.find((v) => normalizeLocale(v.lang) === "en-gb");
  if (enGb) {
    return { voice: enGb, langTag: enGb.lang, isNativeVoice: true, isFallback: false };
  }

  const enUs = voices.find((v) => normalizeLocale(v.lang) === "en-us");
  if (enUs) {
    return { voice: enUs, langTag: enUs.lang, isNativeVoice: true, isFallback: false };
  }

  // 3. Any English voice
  const enAny = voices.find((v) => normalizeLocale(v.lang).startsWith("en"));
  if (enAny) {
    return { voice: enAny, langTag: enAny.lang, isNativeVoice: true, isFallback: false };
  }

  return { voice: voices[0], langTag: voices[0].lang, isNativeVoice: false, isFallback: true };
}
