"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  getClientAuth,
  isClientFirebaseReady,
  authSignInWithEmail,
  authSignUpWithEmail,
  authSignInWithGoogle,
  authSendPasswordReset,
  authSignOut,
} from "@/lib/firebase/client";
import { authService } from "@/services/auth-service";
import { apiClient } from "@/services/api-client";
import { UserProfile, UserRole } from "@shared/types/auth";
import { CURRENT_CONSENT_VERSION } from "@/config/constants";

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  isFirebaseReady: boolean;
  isAuthenticated: boolean;
  isConsentRequired: boolean;
  error: string | null;
  clearError: () => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  submitConsent: (accepted: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchDevIdentity?: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isConsentRequired, setIsConsentRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await authService.getMe();
      if (res.success) {
        setUserProfile(res.data.user);
        setIsConsentRequired(res.data.isConsentRequired);
      } else if (res.error.code === "AUTH_TOKEN_MISSING" || res.error.code === "AUTH_TOKEN_EXPIRED") {
        setUserProfile(null);
        setIsConsentRequired(false);
      }
    } catch (err) {
      console.warn("Failed to refresh profile:", err);
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const ready = isClientFirebaseReady();
    setIsFirebaseReady(ready);

    const auth = getClientAuth();
    if (!auth) {
      // Local foundation mode when client Firebase credentials are not yet supplied
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Sync user profile idempotently on the backend
          const syncRes = await authService.syncUser({
            displayName: currentUser.displayName,
            phoneNumber: currentUser.phoneNumber,
          });

          if (syncRes.success) {
            setUserProfile(syncRes.data.user);
            setIsConsentRequired(syncRes.data.isConsentRequired);
          } else {
            console.warn("User sync response error:", syncRes.error);
          }
        } catch (syncErr) {
          console.error("User profile sync error:", syncErr);
        }
      } else {
        setUserProfile(null);
        setIsConsentRequired(false);
      }
      setIsLoading(false);
    });

    // Register 401 callback with api client
    apiClient.setUnauthorizedHandler(() => {
      setUserProfile(null);
      setIsConsentRequired(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authSignInWithEmail(email, pass);
    } catch (err: unknown) {
      setIsLoading(false);
      throw err;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string, displayName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newUser = await authSignUpWithEmail(email, pass);
      await authService.syncUser({ displayName: displayName || null });
      await refreshProfile();
    } catch (err: unknown) {
      setIsLoading(false);
      throw err;
    }
  }, [refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authSignInWithGoogle();
    } catch (err: unknown) {
      setIsLoading(false);
      throw err;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    await authSendPasswordReset(email);
  }, []);

  const submitConsent = useCallback(async (accepted: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.submitConsent({
        consentVersion: CURRENT_CONSENT_VERSION,
        accepted,
        method: "web_portal",
      });

      if (res.success) {
        setUserProfile(res.data.user);
        setIsConsentRequired(res.data.isConsentRequired);
      } else {
        throw new Error(res.error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authSignOut();
      setUser(null);
      setUserProfile(null);
      setIsConsentRequired(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Development identity switcher for testing roles locally without external credentials
  const switchDevIdentity = useCallback(async (devRole: UserRole) => {
    setIsLoading(true);
    try {
      // In dev mode, configure test token provider
      apiClient.setTokenProvider(async () => `test_token_devuser_${devRole.toLowerCase()}`);
      const syncRes = await authService.syncUser({
        displayName: `Test ${devRole} User`,
      });
      if (syncRes.success) {
        setUserProfile(syncRes.data.user);
        setIsConsentRequired(syncRes.data.isConsentRequired);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const role = userProfile?.role || null;
  const isAuthenticated = Boolean(user || userProfile);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role,
        isLoading,
        isFirebaseReady,
        isAuthenticated,
        isConsentRequired,
        error,
        clearError,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        submitConsent,
        signOut,
        refreshProfile,
        switchDevIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
