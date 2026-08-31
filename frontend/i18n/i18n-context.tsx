"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, TranslationDictionary } from "./types";
import { en } from "./translations/en";
import { kn } from "./translations/kn";
import { hi } from "./translations/hi";

const TRANSLATION_MAP: Record<Language, TranslationDictionary> = {
  en,
  kn,
  hi,
};

const STORAGE_KEY = "swasthyasetu_lang";

export interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveKey(dict: TranslationDictionary, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: any = dict;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from storage or browser detection on client
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored && (stored === "en" || stored === "kn" || stored === "hi")) {
        setLanguageState(stored);
        document.documentElement.lang = stored;
      } else {
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith("kn")) {
          setLanguageState("kn");
          document.documentElement.lang = "kn";
        } else if (browserLang.startsWith("hi")) {
          setLanguageState("hi");
          document.documentElement.lang = "hi";
        } else {
          document.documentElement.lang = "en";
        }
      }
    } catch {
      // Ignore localStorage access issues in sandbox
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const activeDict = TRANSLATION_MAP[language] || TRANSLATION_MAP.en;
      let text = resolveKey(activeDict, key);

      // Fallback to English if key missing in active language
      if (!text && language !== "en") {
        text = resolveKey(TRANSLATION_MAP.en, key);
      }

      if (!text) {
        // Return key safely if no translation exists
        return key;
      }

      return interpolate(text, params);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback instance if used outside Provider
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key: string, params?: Record<string, string | number>) => {
        let text = resolveKey(en, key) || key;
        return interpolate(text, params);
      },
      languages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
}
