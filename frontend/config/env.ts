/**
 * Validated client environment variables.
 * Centralized to prevent scattered process.env calls across components.
 */
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV || "development",
  showDevDiagnostics: process.env.NEXT_PUBLIC_SHOW_DEV_DIAGNOSTICS === "true",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  },
  isProduction: process.env.NEXT_PUBLIC_APP_ENV === "production",
  isDevelopment: process.env.NEXT_PUBLIC_APP_ENV !== "production",
};
