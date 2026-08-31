"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/i18n/i18n-context";
import { Language, SUPPORTED_LANGUAGES } from "@/i18n/types";
import { Languages, Check, ChevronDown } from "lucide-react";

export interface LanguageSelectorProps {
  variant?: "dropdown" | "pills";
  size?: "sm" | "md";
  className?: string;
}

export function LanguageSelector({
  variant = "dropdown",
  size = "sm",
  className = "",
}: LanguageSelectorProps) {
  const { language, setLanguage, languages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  if (variant === "pills") {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200 gap-1 ${className}`}
        role="group"
        aria-label="Select Language"
      >
        {SUPPORTED_LANGUAGES.map((l) => {
          const isActive = language === l.code;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                isActive
                  ? "bg-white text-teal-900 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
              aria-pressed={isActive}
            >
              {l.nativeName}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Change language, current language is ${currentLang.nativeName}`}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 shadow-2xs transition-colors cursor-pointer select-none ${
          size === "sm" ? "h-8 px-2.5 text-xs font-semibold" : "h-10 px-3.5 text-sm font-medium"
        }`}
      >
        <Languages className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
        <span>{currentLang.nativeName}</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 mb-1">
            Select Language
          </div>
          {SUPPORTED_LANGUAGES.map((l) => {
            const isSelected = language === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitem"
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-teal-50 text-teal-900 font-bold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{l.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
