"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ShieldCheck, Lock, ChevronDown, ChevronUp, AlertCircle, Building2 } from "lucide-react";

export default function ConsentPage() {
  const router = useRouter();
  const { isAuthenticated, isConsentRequired, role, submitConsent, signOut, isLoading } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already consented or not authenticated, handle redirection
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/auth/sign-in");
      } else if (!isConsentRequired) {
        if (role === "ADMIN") router.replace("/admin");
        else if (role === "ASHA") router.replace("/asha");
        else router.replace("/citizen");
      }
    }
  }, [isAuthenticated, isConsentRequired, role, isLoading, router]);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitConsent(true);
      if (role === "ADMIN") router.replace("/admin");
      else if (role === "ASHA") router.replace("/asha");
      else router.replace("/citizen");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record consent.";
      setError(msg);
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    await signOut();
    router.replace("/auth/sign-in");
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingState message="Loading consent terms..." />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 font-bold border border-teal-200 shadow-2xs mx-auto">
            <ShieldCheck className="w-6 h-6 text-teal-700" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Before you continue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Please review how your household data is evaluated for healthcare support.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xl shadow-slate-100 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">Healthcare Access Notice</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
              Version 1.0
            </span>
          </div>

          {error && (
            <div role="alert" className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              We use the household details you provide to identify healthcare coverage gaps, match government scheme entitlements (e.g. AB-PMJAY), and guide your family to actionable healthcare care.
            </p>

            <div>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2 flex items-center gap-1"
              >
                <span>{isExpanded ? "Hide data policy details" : "Read key data safeguards"}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs text-slate-600 leading-relaxed animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-slate-900">1. Entitlement Purpose:</strong> Evaluated strictly for healthcare support matching and resolution workflows.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-slate-900">2. Privacy & Isolation:</strong> Your data is protected by server-side role boundaries and never sold.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-slate-900">3. Citizen Control:</strong> You can review, update, or revoke household information at any time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleDecline}
              disabled={submitting}
              className="w-full sm:w-auto text-xs"
            >
              Decline & Sign Out
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleAccept}
              disabled={submitting}
              className="w-full sm:w-auto font-semibold shadow-xs"
            >
              {submitting ? "Recording..." : "Accept & Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
