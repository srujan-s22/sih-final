"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { getFriendlyAuthErrorMessage } from "@/lib/firebase/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { UserRole } from "@shared/types/auth";
import { env } from "@/config/env";
import { ShieldCheck, Lock, ArrowRight, User } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isConsentRequired,
    isFirebaseReady,
    role,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    switchDevIdentity,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (isConsentRequired) {
        router.replace("/auth/consent");
      } else if (role === "ADMIN") {
        router.replace("/admin");
      } else if (role === "ASHA") {
        router.replace("/asha");
      } else {
        router.replace("/citizen");
      }
    }
  }, [isAuthenticated, isConsentRequired, role, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      setErrorMessage(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setErrorMessage(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError("Please enter your registered email address.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      await sendPasswordReset(resetEmail);
      setResetSuccess(true);
    } catch (err: unknown) {
      setResetError(getFriendlyAuthErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleDevRoleLogin = async (devRole: UserRole) => {
    if (switchDevIdentity) {
      setLoading(true);
      await switchDevIdentity(devRole);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-5">
        {/* Brand & Purpose Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-700 text-white font-bold text-lg shadow-sm mx-auto">
            SS
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {mode === "signin" ? "Sign in to SwasthyaSetu" : "Create your citizen account"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
            Access healthcare benefits and manage your household records safely.
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xl shadow-slate-100 space-y-5">
          {/* Sign In / Sign Up Mode Switcher */}
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                mode === "signin"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                mode === "signup"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Input
                label="Full Name"
                placeholder="e.g. Ramesh Kumar"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              {mode === "signin" && (
                <div className="text-right pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetSuccess(false);
                      setResetError(null);
                      setIsResetOpen(true);
                    }}
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full font-semibold shadow-xs"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : mode === "signin"
                ? "Sign In"
                : "Create Account"}
            </Button>
          </form>

          {isFirebaseReady && (
            <div className="space-y-3 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase text-slate-400 font-semibold absolute">
                  Or
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full text-xs font-semibold"
              >
                Continue with Google
              </Button>
            </div>
          )}

          {/* Development Quick Role Test Switches */}
          {env.showDevDiagnostics && (
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Developer Diagnostics Gating
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[10px] py-1 h-auto"
                  onClick={() => handleDevRoleLogin("CITIZEN")}
                >
                  Citizen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[10px] py-1 h-auto"
                  onClick={() => handleDevRoleLogin("ASHA")}
                >
                  ASHA
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[10px] py-1 h-auto"
                  onClick={() => handleDevRoleLogin("ADMIN")}
                >
                  Admin
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Security Assurance */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5" />
          <span>Server-verified data protection • SIH 2026</span>
        </div>
      </div>

      {/* Password Reset Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Reset your password"
        description="Enter your registered email address to receive a password reset link."
      >
        {resetSuccess ? (
          <div className="space-y-4 py-2">
            <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
              Password reset email sent. Please check your inbox.
            </div>
            <Button
              variant="primary"
              size="sm"
              className="w-full font-semibold"
              onClick={() => setIsResetOpen(false)}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4 py-2">
            {resetError && (
              <div className="p-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                {resetError}
              </div>
            )}
            <Input
              label="Registered Email Address"
              type="email"
              placeholder="name@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={resetLoading}
                className="font-semibold"
              >
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
