"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/lib/auth/auth-context";
import {
  ShieldCheck,
  Users,
  HeartPulse,
  FileCheck,
  Lock,
  Building2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  HeartHandshake,
} from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, role } = useAuth();

  const getStartedHref = isAuthenticated
    ? role === "ADMIN"
      ? "/admin"
      : role === "ASHA"
      ? "/asha"
      : "/citizen"
    : "/auth/sign-in";

  return (
    <div className="flex flex-col gap-12 sm:gap-16 md:gap-24 pb-16">
      {/* 1. Hero Section */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-slate-50 py-12 sm:py-16 md:py-20">
        <Shell className="py-0 md:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Hero Content */}
            <div className="lg:col-span-7 flex flex-col items-start space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                <span>Public Healthcare Access Platform</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.16]">
                Find healthcare support for your family.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                SwasthyaSetu helps you discover healthcare schemes your family may be eligible for and understand what to do next.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 w-full sm:w-auto">
                <Link href={getStartedHref} className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto text-base shadow-sm font-semibold flex items-center justify-center gap-2 group"
                  >
                    <span>Check eligibility</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base">
                    How it works
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
                  <span>Privacy-first & secure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Official schemes</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Illustration Card */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Decorative background glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-teal-200/50 to-emerald-200/30 rounded-2xl blur-lg opacity-70 -z-10" />

                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl space-y-4">
                  {/* Card Top: Household Profile Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Sample Household Check
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          Kumar Family (4 Members)
                        </h4>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Verified
                    </span>
                  </div>

                  {/* Scheme Matches Box */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold text-slate-700 block">
                      Healthcare Support Identified:
                    </span>

                    {/* Item 1 */}
                    <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            Ayushman Bharat (AB-PMJAY)
                          </p>
                          <p className="text-[11px] text-teal-800 font-medium">
                            ₹5,00,000 / year hospital coverage
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        Eligible
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <HeartPulse className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            Maternal & Child Health Care
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Antenatal & immunization support
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 shrink-0">
                        Family
                      </span>
                    </div>
                  </div>

                  {/* Next Step Action Indicator */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Recommended Next Step:</span>
                    <span className="font-semibold text-teal-800 flex items-center gap-1">
                      <span>Ration Card e-KYC</span>
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
            Simple Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Three simple steps to discover and access the healthcare benefits your family deserves.
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
                Tell us about your household
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Add basic information about your family members, location, and ration card tier.
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
                Check healthcare support
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Discover verified central and state government healthcare schemes your family qualifies for.
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
                Know what to do next
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Get clear document checklists, application instructions, and assistance touchpoints.
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
            Healthcare support for families
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5">
            Key public health initiatives supported across national and state networks.
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
                Up to ₹5 lakh per family per year for secondary and tertiary hospital care at empaneled public and private hospitals.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Cashless Treatment</span>
              <span className="text-teal-700 font-semibold">100% Covered</span>
            </div>
          </div>

          {/* Scheme 2 */}
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
                State-specific medical assistance programs providing free essential drugs, diagnostic tests, and specialty surgeries.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>State Universal Health</span>
              <span className="text-teal-700 font-semibold">Regional Care</span>
            </div>
          </div>

          {/* Scheme 3 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-2xs space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  Maternal Care
                </span>
                <HeartPulse className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Maternal & Child Health (JSY)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Direct financial assistance for institutional deliveries, free antenatal checkups, and comprehensive child immunization.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Mother & Child</span>
              <span className="text-teal-700 font-semibold">Direct Benefit</span>
            </div>
          </div>
        </div>
      </Shell>

      {/* 4. Trust & Privacy Panel */}
      <Shell as="section" className="py-0 md:py-0">
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-6 sm:p-8 md:p-10 shadow-xs">
          <div className="max-w-3xl space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block">
                Citizen Privacy & Security
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Your information stays protected
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Your household information is used only to help determine relevant healthcare support and connect your family with verified public benefits.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-teal-100">
                <Lock className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Protected Access</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Secure server-verified authentication</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-teal-100">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Consent-Driven</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">You control your health data usage</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-teal-100">
                <Building2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Public Alignment</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Direct official program discovery</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link href={getStartedHref}>
                <Button variant="primary" size="md" className="font-semibold shadow-xs">
                  Check your healthcare benefits
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    </div>
  );
}
