"use client";

import React, { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { nfcService } from "@/services/nfc-service";
import { useTranslation } from "@/i18n/i18n-context";
import { NfcResolveResponse, NfcPublicSchemeSummary } from "@shared/types/nfc";
import {
  ShieldCheck,
  Radio,
  HeartHandshake,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Lock,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Smartphone,
  Info,
  Volume2,
  Square,
} from "lucide-react";

function NfcResolverContent() {
  const searchParams = useSearchParams();
  const { t, language, setLanguage, languages } = useTranslation();

  // Read initial credential from URL search params into memory
  const initialHouseholdId = searchParams.get("hh");
  const initialToken = searchParams.get("t");

  // Keep credentials in memory only (never written to localStorage/sessionStorage)
  const [householdId] = useState<string | null>(initialHouseholdId);
  const [token] = useState<string | null>(initialToken);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NfcResolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Check speech synthesis support on mount
  useEffect(() => {
    setIsSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const resolveCredential = useCallback(async () => {
    if (!householdId || !token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await nfcService.resolvePublicNfc(householdId, token);
      if (res.success) {
        setData(res.data);

        // Security Hardening (Issue 3):
        // Once successfully resolved, clean the bearer credential from the visible URL bar
        // using history replacement without triggering a Next.js re-navigation.
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      } else {
        setError(res.error?.message || t("nfc.invalidCardDesc"));
      }
    } catch {
      setError(t("nfc.invalidCardDesc"));
    } finally {
      setLoading(false);
    }
  }, [householdId, token, t]);

  useEffect(() => {
    if (householdId && token) {
      resolveCredential();
    }
  }, [householdId, token, resolveCredential]);

  // Accessible Audio Playback (Issue 11 & 12):
  // Reads strictly visible, approved public information in the selected language.
  // Never reads raw tokens, household IDs, version numbers, or internal fields.
  const handleToggleAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!data) return;

    // Construct spoken text solely from approved public content
    const locationStr = [
      data.household.region.village,
      data.household.region.district,
      data.household.region.state,
    ]
      .filter(Boolean)
      .join(", ");

    let speechText = `${data.household.displayName}. ${locationStr}. `;

    if (data.schemes.length > 0) {
      speechText += `${t("nfc.schemesTitle")}: `;
      data.schemes.forEach((scheme, index) => {
        speechText += `${index + 1}. ${scheme.name}. ${scheme.benefit}. ${scheme.nextSteps}. `;
      });
    }

    if (data.asha) {
      speechText += `${t("nfc.ashaSectionTitle")}: ${data.asha.displayName}, ${data.asha.serviceArea}. `;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);

    // Language mapping
    const langMap: Record<string, string> = {
      en: "en-IN",
      kn: "kn-IN",
      hi: "hi-IN",
    };
    utterance.lang = langMap[language] || "en-IN";
    utterance.rate = 0.95;

    utterance.onend = () => {
      setIsPlayingAudio(false);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  // Helper for eligibility status badge
  const getStatusBadge = (status: NfcPublicSchemeSummary["eligibilityStatus"]) => {
    switch (status) {
      case "ELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{t("nfc.statusEligible")}</span>
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{t("nfc.statusActionRequired")}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Info className="w-3 h-3 text-sky-600" />
            <span>{t("nfc.statusCheckRequired")}</span>
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-4 sm:py-8 px-3 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-4">
        {/* Multilingual Selector Header */}
        <header className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-900 block leading-tight">
                SwasthyaSetu
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                {t("nfc.pageTitle")}
              </span>
            </div>
          </div>

          {/* Quick 1-tap Language Switcher with Accessible Touch Targets */}
          <div
            className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs"
            role="group"
            aria-label="Language selector"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                id={`lang-select-${lang.code}`}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  if (isPlayingAudio && typeof window !== "undefined") {
                    window.speechSynthesis.cancel();
                    setIsPlayingAudio(false);
                  }
                }}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  language === lang.code
                    ? "bg-teal-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {lang.nativeName}
              </button>
            ))}
          </div>
        </header>

        {/* STATE 1: NO NFC CREDENTIAL IN URL */}
        {!householdId || !token ? (
          <section
            id="nfc-no-params"
            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-5 shadow-xs"
          >
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-teal-100 animate-ping opacity-60" />
              <div className="relative w-16 h-16 rounded-full bg-teal-800 text-white flex items-center justify-center shadow-md">
                <Smartphone className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                {t("nfc.noParamsTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t("nfc.noParamsDesc")}
              </p>
            </div>

            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                <Radio className="w-4 h-4 text-teal-700 shrink-0" />
                <span>How to Tap Your Card:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed pl-1">
                <li>Ensure NFC is turned ON in your phone settings.</li>
                <li>Hold your SwasthyaSetu physical card steady against the back of your phone.</li>
                <li>Tap the link that opens to view your family healthcare entitlements.</li>
              </ol>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 transition-colors"
              >
                <span>{t("nfc.backToHome")}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        ) : loading ? (
          /* STATE 2: LOADING / SCANNING */
          <section
            id="nfc-loading"
            className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center space-y-4 shadow-xs"
          >
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-teal-200 border-t-teal-800 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-teal-800">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">
                {t("nfc.scanningCard")}
              </h2>
              <p className="text-xs text-slate-500">
                SwasthyaSetu Secure Verification
              </p>
            </div>
          </section>
        ) : error ? (
          /* STATE 3: ERROR / CARD REVOKED OR INVALID */
          <section
            id="nfc-error"
            className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-xs"
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-2xs">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t("nfc.invalidCardTitle")}
              </h2>
              <p className="text-xs text-red-800 max-w-sm mx-auto leading-relaxed">
                {error}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={resolveCredential}
                className="inline-flex items-center justify-center min-h-[44px] gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t("nfc.tryAgain")}</span>
              </button>
            </div>
          </section>
        ) : data ? (
          /* STATE 4: SUCCESS - VERY SIMPLE MULTILINGUAL HOUSEHOLD VIEW */
          <div id="nfc-household-view" className="space-y-4">
            {/* Physical Card Digital Replica with Neutral Product Language (Issue 1) */}
            <article
              id="nfc-card-replica"
              className="rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-900 text-white p-5 sm:p-6 shadow-lg relative overflow-hidden space-y-4"
            >
              {/* Subtle emblem */}
              <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                <HeartHandshake className="w-48 h-48 text-white" />
              </div>

              {/* Card Top Row with Audio Button */}
              <div className="flex items-center justify-between relative z-10 gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold tracking-wide">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{t("nfc.verifiedBadge")}</span>
                </span>

                {/* Accessible Audio Readout Button (Issue 11 & 12) */}
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    aria-label={isPlayingAudio ? t("nfc.stopListening") : t("nfc.listen")}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      isPlayingAudio
                        ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md animate-pulse"
                        : "bg-teal-950/60 text-teal-100 hover:bg-teal-950 border-teal-600/50"
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>{t("nfc.stopListening")}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{t("nfc.listen")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Household Name & Location */}
              <div className="relative z-10 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-200/90 block">
                  {t("nfc.householdLabel")}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {data.household.displayName}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-teal-100 pt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-teal-300" />
                  <span>
                    {[
                      data.household.region.village,
                      data.household.region.district,
                      data.household.region.state,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-teal-700/60 flex items-center justify-between text-[11px] text-teal-200 relative z-10">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-teal-300" />
                  <span>{t("nfc.tagSubtitle")}</span>
                </span>
              </div>
            </article>

            {/* Eligible Healthcare Schemes List */}
            <section id="nfc-schemes" className="space-y-2.5">
              <div className="flex items-baseline justify-between px-1">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    {t("nfc.schemesTitle")}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {t("nfc.schemesSubtitle")}
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {data.schemes.length} Available
                </span>
              </div>

              {data.schemes.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
                  {t("nfc.noSchemes")}
                </div>
              ) : (
                <div className="space-y-3">
                  {data.schemes.map((scheme) => (
                    <article
                      key={scheme.schemeId}
                      className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3 transition-shadow hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                            {scheme.name}
                          </h3>
                        </div>
                        {getStatusBadge(scheme.eligibilityStatus)}
                      </div>

                      {/* Benefits */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {t("nfc.keyBenefits")}
                        </span>
                        <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {scheme.benefit}
                        </p>
                      </div>

                      {/* Next Steps / How to avail */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                          {t("nfc.nextSteps")}
                        </span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {scheme.nextSteps}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* ASHA Worker Directory Card */}
            {data.asha && (
              <section
                id="nfc-asha-info"
                className="bg-white rounded-xl border border-teal-200/80 p-4 sm:p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                  <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                  <h2>{t("nfc.ashaSectionTitle")}</h2>
                </div>

                <div className="bg-teal-50/60 rounded-xl p-3.5 border border-teal-100 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">
                        {data.asha.displayName}
                      </span>
                      <span className="text-xs text-slate-600 block">
                        {t("nfc.serviceArea")}: <strong>{data.asha.serviceArea}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-white text-teal-900 px-2 py-0.5 rounded border border-teal-200">
                      {data.asha.code}
                    </span>
                  </div>

                  <p className="text-[11px] text-teal-900/80 leading-relaxed pt-1 border-t border-teal-200/60">
                    {t("nfc.ashaNotice")}
                  </p>
                </div>
              </section>
            )}

            {/* Privacy Guarantee Banner */}
            <aside
              id="nfc-privacy-guarantee"
              className="rounded-xl border border-slate-200 bg-slate-100/70 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"
            >
              <Lock className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
              <span>{t("nfc.privacyNotice")}</span>
            </aside>

            {/* Citizen Full Portal Link (routes to /auth/sign-in) */}
            <div className="pt-2 text-center">
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 transition-colors min-h-[44px] px-3 py-2"
              >
                <span>{t("nfc.loginForMore")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function NfcPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-xs">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading healthcare entitlements...</span>
          </div>
        </div>
      }
    >
      <NfcResolverContent />
    </Suspense>
  );
}
