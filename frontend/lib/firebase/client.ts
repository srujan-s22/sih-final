import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { env } from "@/config/env";

/**
 * ==============================================================================
 * CLIENT-SIDE FIREBASE FOUNDATION (PHASE 2)
 * ==============================================================================
 *
 * ARCHITECTURAL BOUNDARY:
 * 1. The client-side Firebase SDK is reserved solely for Firebase Authentication.
 * 2. The frontend MUST NEVER directly query or mutate Firestore domain data.
 * 3. All domain data access is strictly gated behind the Fastify Node.js backend.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

const isFirebaseConfigured = Boolean(
  env.firebase.apiKey && env.firebase.projectId
);

if (typeof window !== "undefined" && isFirebaseConfigured) {
  if (!getApps().length) {
    try {
      app = initializeApp({
        apiKey: env.firebase.apiKey,
        authDomain: env.firebase.authDomain,
        projectId: env.firebase.projectId,
        storageBucket: env.firebase.storageBucket,
        messagingSenderId: env.firebase.messagingSenderId,
        appId: env.firebase.appId,
      });
      auth = getAuth(app);
    } catch (e) {
      console.warn("Client-side Firebase initialization deferred:", e);
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
  }
}

export function getClientAuth(): Auth | null {
  return auth;
}

export function isClientFirebaseReady(): boolean {
  return Boolean(app && auth);
}

/**
 * Retrieves current user's Firebase ID token for API authorization
 */
export async function getCurrentUserToken(forceRefresh = false): Promise<string | null> {
  const currentAuth = getClientAuth();
  if (!currentAuth) {
    return null;
  }

  // If currentUser is not yet settled, await native authStateReady promise so that
  // in-flight session restoration from IndexedDB completes before determining token availability.
  if (!currentAuth.currentUser && typeof currentAuth.authStateReady === "function") {
    try {
      await currentAuth.authStateReady();
    } catch (err) {
      console.warn("Firebase authStateReady resolution error:", err);
    }
  }

  if (!currentAuth.currentUser) {
    return null;
  }

  try {
    return await currentAuth.currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.error("Failed to retrieve Firebase ID token:", err);
    return null;
  }
}

/**
 * Client Email/Password Sign-In
 */
export async function authSignInWithEmail(email: string, pass: string): Promise<User> {
  const currentAuth = getClientAuth();
  if (!currentAuth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  const result = await signInWithEmailAndPassword(currentAuth, email, pass);
  return result.user;
}

/**
 * Client Email/Password Registration
 */
export async function authSignUpWithEmail(email: string, pass: string): Promise<User> {
  const currentAuth = getClientAuth();
  if (!currentAuth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  const result = await createUserWithEmailAndPassword(currentAuth, email, pass);
  return result.user;
}

/**
 * Optional Google Sign-In Provider
 */
export async function authSignInWithGoogle(): Promise<User> {
  const currentAuth = getClientAuth();
  if (!currentAuth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(currentAuth, provider);
  return result.user;
}

/**
 * Password Reset Email
 */
export async function authSendPasswordReset(email: string): Promise<void> {
  const currentAuth = getClientAuth();
  if (!currentAuth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  await sendPasswordResetEmail(currentAuth, email);
}

/**
 * Sign Out
 */
export async function authSignOut(): Promise<void> {
  const currentAuth = getClientAuth();
  if (currentAuth) {
    await firebaseSignOut(currentAuth);
  }
}
