"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";

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
    <div className="min-h-[75vh] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Before you continue
          </h1>
          <p className="text-sm text-slate-600">
            Please review our healthcare entitlement usage notice.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Healthcare Access Notice</CardTitle>
            <CardDescription>
              Consent Notice Version 1.0
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <div role="alert" className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                {error}
              </div>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                We use the information you provide to identify household healthcare access gaps, evaluate scheme entitlements, and help connect you with verified national and state healthcare programs.
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2 flex items-center gap-1"
                >
                  {isExpanded ? "Show less" : "Learn more about data usage"}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs text-slate-600 leading-relaxed">
                    <p>
                      <strong>1. Purpose:</strong> Data is evaluated solely for entitlement matching (e.g. AB-PMJAY, state healthcare schemes) and gap resolution.
                    </p>
                    <p>
                      <strong>2. Privacy:</strong> Your data is never sold or utilized for unauthorized commercial purposes.
                    </p>
                    <p>
                      <strong>3. Security:</strong> All records are stored with server-side authentication and role-based access boundaries.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleDecline}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Decline & Sign Out
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleAccept}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Recording..." : "Accept & Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
