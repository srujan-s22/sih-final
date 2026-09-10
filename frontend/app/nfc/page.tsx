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
  WifiOff,
} from "lucide-react";

import { parseNfcCredential, ParseNfcCredentialResult, NfcCredential } from "@/lib/nfc/nfc-parser";
import { buildHouseholdSpeechText, getSpeechSynthesisLang } from "@/lib/nfc/nfc-audio";

function NfcResolverContent() {
  const searchParams = useSearchParams();
  const { t, language, setLanguage, languages } = useTranslation();

  // Parse NFC credential on initial mount with strict validation & duplicate parameter detection
  const [parseResult] = useState<ParseNfcCredentialResult>(() =>
    parseNfcCredential(searchParams)
  );

  // Keep bearer credentials strictly in memory (never written to localStorage/sessionStorage/cookies)
  const credentialRef = useRef<NfcCredential | null>(
    parseResult.status === "VALID" ? parseResult.credential : null
  );

  const [loading, setLoading] = useState(parseResult.status === "VALID");
  const [data, setData] = useState<NfcResolveResponse | null>(null);
  const [error, setError] = useState<string | null>(
    parseResult.status === "MALFORMED" ? t("nfc.invalidCardDesc") : null
  );
  const [errorType, setErrorType] = useState<"invalid" | "network" | null>(
    parseResult.status === "MALFORMED" ? "invalid" : null
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isWebNfcSupported, setIsWebNfcSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // In-flight concurrency guard and AbortController for clean unmounts
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const ndefAbortControllerRef = useRef<AbortController | null>(null);

  // Check speech synthesis and Web NFC support on mount
  useEffect(() => {
    isMountedRef.current = true;
    setIsSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setIsWebNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);

    // Section 8 & 9: Sanitize visible URL bar immediately once credentials/parameters are processed
    // This ensures bearer tokens do not linger in the browser window whether resolution succeeds or fails.
    if (typeof window !== "undefined" && window.history?.replaceState && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (ndefAbortControllerRef.current) {
        ndefAbortControllerRef.current.abort();
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const resolveCredential = useCallback(async () => {
    const cred = credentialRef.current;
    if (!cred || !cred.householdId || !cred.token) {
      return;
    }

    // In-flight guard to prevent duplicate concurrent executions (e.g. React 19 StrictMode)
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    // Abort any preceding in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const res = await nfcService.resolvePublicNfc(
        cred.householdId,
        cred.token,
        cred.version,
        controller.signal
      );

      if (!isMountedRef.current) return;

      if (res.success) {
        setData(res.data);
      } else {
        if (res.error?.code === "REQUEST_ABORTED") {
          return;
        }

        // Section 25: Differentiate network connection issues from invalid NFC credentials
        if (
          res.error?.code === "NETWORK_UNREACHABLE" ||
          res.error?.code === "RATE_LIMIT_EXCEEDED"
        ) {
          setErrorType("network");
          setError(res.error.message || t("nfc.networkErrorDesc"));
        } else {
          setErrorType("invalid");
          setError(t("nfc.invalidCardDesc"));
        }
      }
    } catch {
      if (!isMountedRef.current) return;
      setErrorType("network");
      setError(t("nfc.networkErrorDesc"));
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (parseResult.status === "VALID") {
      resolveCredential();
    }
  }, [parseResult.status, resolveCredential]);

  const handleStartScan = async () => {
    if (typeof window === "undefined" || !("NDEFReader" in window)) return;
    setScanError(null);
    setIsScanning(true);

    if (ndefAbortControllerRef.current) {
      ndefAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    ndefAbortControllerRef.current = controller;

    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      await ndef.scan({ signal: controller.signal });

      ndef.addEventListener(
        "reading",
        (event: any) => {
          if (!isMountedRef.current) return;
          try {
            if (!event.message?.records?.length) {
              setScanError(t("nfc.invalidCardDesc"));
              setIsScanning(false);
              return;
            }

            for (const record of event.message.records) {
              let recordText = "";
              if (record.recordType === "url" || record.recordType === "text") {
                const decoder = new TextDecoder();
                recordText = decoder.decode(record.data);
              }

              if (recordText) {
                try {
                  const url = new URL(recordText, window.location.origin);
                  const parsed = parseNfcCredential(url.searchParams);
                  if (parsed.status === "VALID") {
                    credentialRef.current = parsed.credential;
                    setIsScanning(false);
                    resolveCredential();
                    return;
                  }
                } catch {
                  // If not a standard URL, continue to next record
                }
              }
            }

            setScanError(t("nfc.invalidCardDesc"));
            setIsScanning(false);
          } catch {
            if (isMountedRef.current) {
              setScanError(t("nfc.invalidCardDesc"));
              setIsScanning(false);
            }
          }
        },
        { signal: controller.signal }
      );

      ndef.addEventListener(
        "readingerror",
        () => {
          if (isMountedRef.current) {
            setScanError(t("nfc.invalidCardDesc"));
            setIsScanning(false);
          }
        },
        { signal: controller.signal }
      );
    } catch (err: any) {
      if (isMountedRef.current) {
        setIsScanning(false);
        if (err?.name !== "AbortError") {
          setScanError(err?.message || t("nfc.networkErrorDesc"));
        }
      }
    }
  };

  // Accessible Audio Playback (Sections 11, 12, 39):
  // User-triggered only, reads strictly visible approved public information in the selected language.
  // Never reads raw tokens, version numbers, internal IDs, or sensitive data.
  const handleToggleAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!data) return;

    const speechText = buildHouseholdSpeechText(data, language);
    if (!speechText) return;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = getSpeechSynthesisLang(language);
    utterance.rate = 0.92; // Slightly measured rate for clear rural/low-literacy comprehension

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

  // Language switch handler: stops audio narration immediately and updates language without re-resolving
  const handleLanguageChange = (langCode: "en" | "kn" | "hi") => {
    if (isPlayingAudio && typeof window !== "undefined") {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    setLanguage(langCode);
  };

  // Helper for eligibility status badge
  const getStatusBadge = (status: NfcPublicSchemeSummary["eligibilityStatus"]) => {
    switch (status) {
      case "ELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{t("nfc.statusEligible")}</span>
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{t("nfc.statusActionRequired")}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
            <Info className="w-3.5 h-3.5 text-sky-700 shrink-0" />
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

          {/* Quick 1-tap Language Switcher with Accessible Touch Targets (min 36px) */}
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
                onClick={() => handleLanguageChange(lang.code)}
                aria-pressed={language === lang.code}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-800 ${
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

        {/* STATE A: NO NFC CREDENTIAL IN URL */}
        {parseResult.status === "EMPTY" && !data && !loading && !error ? (
          <section
            id="nfc-no-params"
            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-6 shadow-xs"
          >
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-teal-100 animate-ping opacity-60" />
              <div className="relative w-16 h-16 rounded-full bg-teal-800 text-white flex items-center justify-center shadow-md">
                <Smartphone className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {t("nfc.noParamsTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t("nfc.noParamsDesc")}
              </p>
            </div>

            {/* Interactive Web NFC Scan Button if browser supports it */}
            {isWebNfcSupported ? (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={isScanning}
                  className={`w-full sm:w-auto inline-flex items-center justify-center min-h-[48px] gap-2.5 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
                    isScanning
                      ? "bg-amber-500 text-slate-950 border border-amber-400 animate-pulse cursor-wait"
                      : "bg-teal-800 hover:bg-teal-900 text-white border border-teal-700"
                  }`}
                >
                  <Radio className={`w-5 h-5 ${isScanning ? "animate-spin" : "animate-pulse"}`} />
                  <span>{isScanning ? t("nfc.scanningPrompt") : t("nfc.startScanBtn")}</span>
                </button>
                {scanError && (
                  <p className="text-xs text-red-600 font-medium">
                    {scanError}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic max-w-sm mx-auto">
                {t("nfc.nfcNotSupportedPrompt")}
              </p>
            )}

            {/* Simple 3-step visual instruction for low literacy users */}
            <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl text-xs text-teal-950 text-left space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
                <Radio className="w-4 h-4 text-teal-700 shrink-0" />
                <span>{t("nfc.howItWorks")}:</span>
              </div>
              <ol className="space-y-2 text-slate-700 text-xs leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>{t("nfc.howItWorksStep1")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>{t("nfc.howItWorksStep2")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>{t("nfc.howItWorksStep3")}</span>
                </li>
              </ol>
            </div>

            {/* Secondary Citizen Portal Access */}
            <div className="pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
              <Link
                href="/auth/sign-in"
                className="w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] gap-2 px-6 py-2.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
              >
                <span>{t("nfc.loginForMore")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 pt-1"
              >
                <span>{t("nfc.backToHome")}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        ) : loading ? (
          /* STATE B: LOADING / CHECKING HOUSEHOLD */
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
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t("nfc.checkingHousehold")}
              </h2>
              <p className="text-xs text-slate-500">
                SwasthyaSetu Secure Verification
              </p>
            </div>
          </section>
        ) : error ? (
          /* STATE E / STATE F: ERROR (INVALID CARD OR NETWORK FAILURE) */
          <section
            id="nfc-error"
            className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-xs"
          >
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-2xs">
              {errorType === "network" ? (
                <WifiOff className="w-8 h-8" />
              ) : (
                <AlertCircle className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {errorType === "network"
                  ? t("nfc.networkErrorTitle")
                  : t("nfc.invalidCardTitle")}
              </h2>
              <p className="text-xs text-red-800 max-w-sm mx-auto leading-relaxed">
                {error}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              {credentialRef.current ? (
                <button
                  type="button"
                  onClick={resolveCredential}
                  className="inline-flex items-center justify-center min-h-[44px] gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t("nfc.tryAgain")}</span>
                </button>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center justify-center min-h-[44px] gap-1.5 px-6 py-2.5 text-xs font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t("nfc.backToHome")}</span>
                </Link>
              )}
            </div>
          </section>
        ) : data ? (
          /* STATE C & D: SUCCESS - VERY SIMPLE MULTILINGUAL HOUSEHOLD VIEW */
          <div id="nfc-household-view" className="space-y-5">
            {/* Household Identity Card */}
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

                {/* Accessible Audio Readout Button (Sections 11 & 12) */}
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    aria-label={isPlayingAudio ? t("nfc.stopListening") : t("nfc.listen")}
                    className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      isPlayingAudio
                        ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md animate-pulse"
                        : "bg-teal-950/60 text-teal-100 hover:bg-teal-950 border-teal-600/50"
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>{t("nfc.stopListening")}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        <span>{t("nfc.listen")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Household Name & Location */}
              <div className="relative z-10 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/90 block">
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

            {/* PRIMARY SECTION: "YOUR HEALTH BENEFITS" */}
            <section id="nfc-schemes" className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {t("nfc.yourBenefitsTitle")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t("nfc.schemesSubtitle")}
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  {data.schemes.length} Available
                </span>
              </div>

              {/* STATE D: ZERO ELIGIBLE SCHEMES */}
              {data.schemes.length === 0 ? (
                <div
                  id="nfc-no-schemes-card"
                  className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 text-center space-y-3 shadow-2xs"
                >
                  <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center mx-auto border border-sky-200">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {t("nfc.noSchemesTitle")}
                    </h3>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                      {t("nfc.noSchemesDesc")}
                    </p>
                  </div>
                </div>
              ) : (
                /* SCHEME BENEFIT CARDS */
                <div className="space-y-3.5">
                  {data.schemes.map((scheme) => (
                    <article
                      key={scheme.schemeId}
                      className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5 transition-shadow hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {scheme.name}
                        </h3>
                        {getStatusBadge(scheme.eligibilityStatus)}
                      </div>

                      {/* Benefit: "What you can get" */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          {t("nfc.keyBenefits")}
                        </span>
                        <p className="text-slate-800 text-xs sm:text-sm font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                          {scheme.benefit}
                        </p>
                      </div>

                      {/* Next Steps: "What to do next" */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 block">
                          {t("nfc.nextSteps")}
                        </span>
                        <p className="text-slate-700 text-xs leading-relaxed bg-teal-50/50 p-3 rounded-lg border border-teal-100">
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
                <div className="flex items-center gap-2 text-teal-900 font-bold text-sm sm:text-base">
                  <UserCheck className="w-5 h-5 text-teal-700 shrink-0" />
                  <h2>{t("nfc.ashaSectionTitle")}</h2>
                </div>

                <div className="bg-teal-50/60 rounded-xl p-3.5 sm:p-4 border border-teal-100 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 text-sm sm:text-base block">
                        {data.asha.displayName}
                      </span>
                      <span className="text-xs text-slate-600 block pt-0.5">
                        {t("nfc.serviceArea")}: <strong>{data.asha.serviceArea}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-white text-teal-900 px-2 py-1 rounded border border-teal-200 font-semibold">
                      {data.asha.code}
                    </span>
                  </div>

                  <p className="text-xs text-teal-950/90 leading-relaxed pt-1.5 border-t border-teal-200/60">
                    {t("nfc.ashaNotice")}
                  </p>
                </div>
              </section>
            )}

            {/* Privacy Guarantee & Public vs Authenticated Notice (Sections 20, 21, 22) */}
            <aside
              id="nfc-privacy-guarantee"
              className="rounded-xl border border-slate-200 bg-slate-100/80 p-4 space-y-3 text-xs text-slate-600 leading-relaxed"
            >
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-700">{t("nfc.privacyNotice")}</p>
                  <p className="text-slate-500 text-[11px]">{t("nfc.publicVsAuthDesc")}</p>
                </div>
              </div>

              {/* Citizen Full Portal Link (Secondary action) */}
              <div className="pt-2 border-t border-slate-200/80 flex justify-center">
                <Link
                  href="/auth/sign-in"
                  className="w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] gap-2 px-6 py-2.5 text-xs font-bold text-teal-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <span>{t("nfc.loginForMore")}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </aside>
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
