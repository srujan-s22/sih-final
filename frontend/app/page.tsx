"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { schemeService } from "@/services/scheme-service";
import { Scheme } from "@shared/types/eligibility";
import {
  ShieldCheck,
  Users,
  HeartPulse,
  FileCheck,
  Lock,
  Building2,
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  ChevronRight,
  Info,
} from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, role, userProfile } = useAuth();
  const { t } = useTranslation();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSchemes() {
      setLoadingSchemes(true);
      try {
        const res = await schemeService.getActiveSchemes();
        if (res.success && mounted) {
          setSchemes(res.data.schemes);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (mounted) setLoadingSchemes(false);
      }
    }
    loadSchemes();
    return () => {
      mounted = false;
    };
  }, []);

  const getStartedHref = isAuthenticated
    ? role === "ADMIN"
      ? "/admin"
      : role === "ASHA"
      ? "/asha"
      : "/citizen"
    : "/auth/sign-in";

  const getPortalLabel = () => {
    if (role === "ADMIN") return t("navigation.adminConsole");
    if (role === "ASHA") return t("navigation.ashaWorkspace");
    return t("navigation.citizenPortal");
  };

  return (
    <div className="flex flex-col gap-12 sm:gap-16 md:gap-24 pb-16">
      {/* Authenticated Workspace Banner */}
      {isAuthenticated && (
        <aside
          aria-label="Active session banner"
          className="bg-teal-900 text-teal-50 px-4 py-3 border-b border-teal-800"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {t("home.activeSessionNotice", {
                  name: userProfile?.displayName || userProfile?.email || "Citizen",
                  role: role || "CITIZEN",
                })}
              </span>
            </div>
            <Link
              href={getStartedHref}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-300 hover:text-white transition-colors"
            >
              <span>{t("home.goToWorkspaceBtn", { portal: getPortalLabel() })}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </aside>
      )}

      {/* 1. Hero Section */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-slate-50 py-12 sm:py-16 md:py-20">
        <Shell className="py-0 md:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Hero Content */}
            <div className="lg:col-span-7 flex flex-col items-start space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                <span>{t("home.badge")}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.16]">
                {t("home.heroTitle")}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {t("home.heroSubtitle")}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 w-full sm:w-auto">
                <Link href={getStartedHref} className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto text-base shadow-sm font-semibold flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>{isAuthenticated ? getPortalLabel() : t("home.getStartedBtn")}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base">
                    {t("navigation.howItWorks")}
                  </Button>
                </a>
              </div>

              {/* Trust Micro-Badges */}
              <div className="pt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Free public service</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Privacy-first & consent-based</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Verified government criteria</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Illustration Card */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl space-y-4">
                  {/* Card Top: Household Profile Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Sample Family Check
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          Sharma Family (4 Members)
                        </h4>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {t("status.verified")}
                    </span>
                  </div>

                  {/* Scheme Matches Box */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold text-slate-700 block">
                      {t("citizen.healthBenefits")}:
                    </span>

                    {/* Item 1 */}
                    <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            Ayushman Bharat PM-JAY (70+)
                          </p>
                          <p className="text-[11px] text-teal-800 font-medium">
                            ₹5,00,000 / year hospital coverage
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        {t("status.eligible")}
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <HeartPulse className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            Janani Suraksha Yojana (JSY)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Institutional delivery support
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                        {t("status.action_required")}
                      </span>
                    </div>
                  </div>

                  {/* Next Step Action Indicator */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Recommended Action:</span>
                    <span className="font-semibold text-teal-800 flex items-center gap-1">
                      <span>Complete Aadhaar e-KYC</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Shell>
      </section>

      {/* 2. How It Works Section */}
      <Shell as="section" id="how-it-works" className="py-0 md:py-0 scroll-mt-20">
        <div className="max-w-2xl mb-8 sm:mb-10">
          <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block mb-1">
            Simple 3-Step Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t("home.howItWorksTitle")}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
            {t("home.howItWorksSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono">01</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {t("home.step1Title")}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {t("home.step1Desc")}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono">02</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {t("home.step2Title")}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {t("home.step2Desc")}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono">03</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {t("home.step3Title")}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {t("home.step3Desc")}
              </p>
            </div>
          </div>
        </div>
      </Shell>

      {/* 3. Healthcare Support Schemes */}
      <Shell as="section" id="schemes" className="py-0 md:py-0 scroll-mt-20">
        <div className="max-w-2xl mb-8 sm:mb-10">
          <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block mb-1">
            Government Programs
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t("home.schemesSectionTitle")}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
            {t("home.schemesSectionSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scheme 1 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-100">
                  National Program
                </span>
                <ShieldCheck className="w-5 h-5 text-teal-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Ayushman Bharat (AB-PMJAY)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Up to ₹5 lakh per family per year for secondary and tertiary hospitalization, with a dedicated universal ₹5 lakh top-up for senior citizens aged 70+.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Cashless Inpatient Care</span>
              <span className="text-teal-700 font-semibold">100% Cashless</span>
            </div>
          </div>

          {/* Scheme 2 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  Maternal Care
                </span>
                <HeartPulse className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Janani Suraksha Yojana (JSY)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Conditional cash assistance for institutional delivery, antenatal checkups, and post-natal maternal nutrition under the National Health Mission.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Mother & Child</span>
              <span className="text-teal-700 font-semibold">Direct Benefit</span>
            </div>
          </div>

          {/* Scheme 3 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  State Health Programs
                </span>
                <Building2 className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                State Health Assurances
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                State-specific medical assistance programs providing free essential drugs, diagnostic tests, and tertiary specialty care.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Regional Coverage</span>
              <span className="text-teal-700 font-semibold">State Portals</span>
            </div>
          </div>
        </div>

        {/* Informational Assessment Disclaimer */}
        <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            <strong>Informational Notice:</strong> Eligibility shown is an informational assessment based on the registered scheme criteria. Final eligibility and enrollment are determined by the relevant government authority.
          </p>
        </div>
      </Shell>

      {/* 4. Trust & Privacy Section */}
      <Shell as="section" id="about" className="py-0 md:py-0 scroll-mt-20">
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-6 sm:p-8 md:p-10 shadow-xs">
          <div className="max-w-3xl space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block">
                Citizen Privacy & Trust
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {t("home.ctaTitle")}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {t("home.ctaSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white border border-teal-100">
                <Lock className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Server-Side Security</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Authorization and role validation enforced on the backend</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white border border-teal-100">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Consent-Governed</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">You control your health data usage at all times</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white border border-teal-100">
                <Building2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Official Evidence</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Every recommendation is traceable to verified government rules</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link href={getStartedHref}>
                <Button variant="primary" size="md" className="font-semibold shadow-xs">
                  {isAuthenticated ? `Go to ${getPortalLabel()}` : t("home.getStartedBtn")}
                </Button>
              </Link>
              <Link href="/auth/consent" className="text-xs font-medium text-teal-800 hover:text-teal-900 underline underline-offset-2">
                {t("navigation.privacyConsent")}
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    </div>
  );
}
