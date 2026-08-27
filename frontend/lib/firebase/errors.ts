/**
 * Maps raw Firebase authentication error codes to concise, human-friendly messages.
 * Prevents leakage of internal error codes, URLs, and stack traces.
 */
export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  const err = error as { code?: string; message?: string };
  const code = err.code || "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Your email or password is incorrect.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email address already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many unsuccessful attempts. Please try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network connection error. Please verify your internet connection.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled before completion.";
    case "auth/popup-blocked":
      return "The sign-in popup was blocked by your browser. Please allow popups.";
    case "auth/requires-recent-login":
      return "For security, please sign in again to continue.";
    case "auth/internal-error":
      return "Authentication service is temporarily unavailable. Please try again.";
    default:
      if (typeof err.message === "string" && err.message.length > 0 && !err.message.includes("auth/")) {
        return err.message;
      }
      return "Unable to complete authentication. Please try again.";
  }
}
