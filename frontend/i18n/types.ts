export type Language = "en" | "kn" | "hi";

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  telephonyCode: "en-IN" | "kn-IN" | "hi-IN";
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", telephonyCode: "en-IN" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", telephonyCode: "kn-IN" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", telephonyCode: "hi-IN" },
];

export const DEFAULT_LANGUAGE: Language = "en";

export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary;
};
