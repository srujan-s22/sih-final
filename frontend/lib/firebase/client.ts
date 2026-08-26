import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { env } from "@/config/env";

/**
 * ==============================================================================
 * CLIENT-SIDE FIREBASE FOUNDATION (PHASE 1)
 * ==============================================================================
 *
 * ARCHITECTURAL BOUNDARY:
 * 1. The client-side Firebase SDK is reserved solely for Firebase Authentication
 *    interactions (e.g. Phone OTP / token generation in Phase 2).
 * 2. The frontend MUST NEVER directly query or mutate Firestore domain data
 *    (households, members, gaps, actions, schemes, etc.).
 * 3. All domain data access is strictly gated behind the Fastify Node.js backend
 *    via the server-side Firebase Admin SDK repository layer.
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
