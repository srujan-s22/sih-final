"use client";

import React, { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@shared/types/auth";
import { LoadingState } from "@/components/ui/loading-state";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireConsent?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireConsent = true,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, isConsentRequired, role } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // 1. Not authenticated -> Redirect to sign-in
    if (!isAuthenticated) {
      router.replace("/auth/sign-in");
      return;
    }

    // 2. Consent required -> Redirect to consent notice
    if (requireConsent && isConsentRequired) {
      router.replace("/auth/consent");
      return;
    }

    // 3. Insufficient role -> Redirect to unauthorized page
    if (allowedRoles && role && !allowedRoles.includes(role)) {
      router.replace("/unauthorized");
      return;
    }
  }, [isAuthenticated, isLoading, isConsentRequired, role, allowedRoles, requireConsent, router]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingState message="Verifying authentication and security context..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireConsent && isConsentRequired) {
    return null;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
