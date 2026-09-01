"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
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
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName?: string,
    requestedRole?: UserRole,
    registrationSecret?: string
  ) => Promise<UserProfile>;
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
  const isExplicitRegistrationActiveRef = useRef(false);

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
        // If an explicit registration (signUpWithEmail) is in progress, skip generic sync
        // because signUpWithEmail will authoritatively call /register with role and secrets.
        if (isExplicitRegistrationActiveRef.current) {
          return;
        }

        try {
          // Sync user profile idempotently on the backend
          const activeLang = typeof window !== "undefined"
            ? (localStorage.getItem("swasthyasetu_lang") as "en" | "kn" | "hi" | null)
            : null;
          const syncRes = await authService.syncUser({
            displayName: currentUser.displayName,
            phoneNumber: currentUser.phoneNumber,
            preferredLanguage: activeLang || undefined,
          });

          if (syncRes.success) {
            setUserProfile(syncRes.data.user);
            setIsConsentRequired(syncRes.data.isConsentRequired);
          } else {
            console.warn("User sync response error:", syncRes.error);
          }
        } catch (syncErr) {
          console.error("User profile sync error:", syncErr);
        } finally {
          setIsLoading(false);
        }
      } else {
        let restoredDev = false;
        if (typeof window !== "undefined") {
          try {
            const savedDevRole = sessionStorage.getItem("swasthyasetu_dev_role") as UserRole | null;
            if (savedDevRole && ["CITIZEN", "ASHA", "ADMIN"].includes(savedDevRole)) {
              const devUid = `dev-${savedDevRole.toLowerCase()}-user`;
              apiClient.setTokenProvider(async () => `test_token_${devUid}_${savedDevRole.toLowerCase()}`);
              const activeLang = typeof window !== "undefined"
                ? (localStorage.getItem("swasthyasetu_lang") as "en" | "kn" | "hi" | null)
                : null;
              const syncRes = await authService.syncUser({
                displayName: `Test ${savedDevRole} User`,
                preferredLanguage: activeLang || undefined,
              });
              if (syncRes.success) {
                setUserProfile(syncRes.data.user);
                setIsConsentRequired(syncRes.data.isConsentRequired);
                restoredDev = true;
              }
            }
          } catch {
            // Ignore sessionStorage access error
          }
        }

        if (!restoredDev) {
          apiClient.clearTokenProvider();
          setUserProfile(null);
          setIsConsentRequired(false);
        }
        setIsLoading(false);
      }
    });

    // Register 401 callback with api client
    apiClient.setUnauthorizedHandler(() => {
      const currentAuth = getClientAuth();
      if (!currentAuth?.currentUser) {
        apiClient.clearTokenProvider();
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("swasthyasetu_dev_role");
          } catch {
            // ignore
          }
        }
        setUserProfile(null);
        setIsConsentRequired(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("swasthyasetu_dev_role");
      } catch {
        // ignore
      }
    }
    apiClient.clearTokenProvider();
    try {
      const firebaseUser = await authSignInWithEmail(email, pass);
      setUser(firebaseUser);
      // Force token refresh on fresh sign-in to guarantee fresh role & claims
      try {
        await firebaseUser.getIdToken(true);
      } catch {
        // Non-blocking fallback
      }
      const syncRes = await authService.syncUser({
        displayName: firebaseUser.displayName,
        phoneNumber: firebaseUser.phoneNumber,
      });
      if (syncRes.success) {
        setUserProfile(syncRes.data.user);
        setIsConsentRequired(syncRes.data.isConsentRequired);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (
      email: string,
      pass: string,
      displayName?: string,
      requestedRole: UserRole = "CITIZEN",
      registrationSecret?: string
    ) => {
      setIsLoading(true);
      setError(null);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("swasthyasetu_dev_role");
        } catch {
          // ignore
        }
      }
      apiClient.clearTokenProvider();
      isExplicitRegistrationActiveRef.current = true;
      let createdFirebaseUser: User | null = null;
      try {
        // STEP 1: PRE-VALIDATE AUTHORIZATION BEFORE CREATING FIREBASE AUTH USER
        if (requestedRole !== "CITIZEN") {
          const prevalRes = await authService.prevalidateRole(
            requestedRole,
            registrationSecret || null
          );
          if (!prevalRes.success) {
            throw new Error(
              prevalRes.error?.message ||
                "Staff registration could not be completed. Please verify your authorization code."
            );
          }
        }

        // STEP 2: ONLY AFTER AUTHORIZATION SUCCEEDS, CREATE FIREBASE ACCOUNT
        createdFirebaseUser = await authSignUpWithEmail(email, pass);
        setUser(createdFirebaseUser);

        // STEP 3: SYNCHRONIZE & ATTACH AUTHORITATIVE ROLE ON BACKEND
        const activeLang = typeof window !== "undefined"
          ? (localStorage.getItem("swasthyasetu_lang") as "en" | "kn" | "hi" | null)
          : null;
        const syncRes = await authService.registerUser({
          displayName: displayName || null,
          requestedRole,
          preferredLanguage: activeLang || undefined,
          registrationSecret: registrationSecret || null,
        });

        if (!syncRes.success) {
          // If backend registration fails after Firebase user creation, roll back!
          if (createdFirebaseUser) {
            try {
              await createdFirebaseUser.delete();
            } catch (delErr) {
              console.warn("Failed to roll back Firebase user after registration failure:", delErr);
            }
            setUser(null);
            setUserProfile(null);
          }
          throw new Error(
            syncRes.error?.message ||
              "Staff registration could not be completed. Please verify your authorization code."
          );
        }

        setUserProfile(syncRes.data.user);
        setIsConsentRequired(syncRes.data.isConsentRequired);
        return syncRes.data.user;
      } catch (err: unknown) {
        setIsLoading(false);
        throw err;
      } finally {
        isExplicitRegistrationActiveRef.current = false;
        setIsLoading(false);
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("swasthyasetu_dev_role");
      } catch {
        // ignore
      }
    }
    apiClient.clearTokenProvider();
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
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("swasthyasetu_dev_role");
        } catch {
          // ignore
        }
      }
      apiClient.clearTokenProvider();
      await authSignOut();
      setUser(null);
      setUserProfile(null);
      setIsConsentRequired(false);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Development identity switcher for testing roles locally without external credentials
  const switchDevIdentity = useCallback(async (devRole: UserRole) => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("swasthyasetu_dev_role", devRole);
        } catch {
          // ignore
        }
      }
      const devUid = `dev-${devRole.toLowerCase()}-user`;
      apiClient.setTokenProvider(async () => `test_token_${devUid}_${devRole.toLowerCase()}`);
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
