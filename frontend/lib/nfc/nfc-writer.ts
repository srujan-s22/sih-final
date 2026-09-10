declare const window: any;

/**
 * Resolves the public site origin dynamically from environment variables or browser context.
 * Priority:
 * 1. Explicitly provided customOrigin
 * 2. NEXT_PUBLIC_SITE_URL
 * 3. NEXT_PUBLIC_APP_URL
 * 4. NEXT_PUBLIC_VERCEL_URL
 * 5. window.location.origin (client-side)
 * 6. Localhost fallback (non-production only)
 *
 * In production SSR without configured environment variables, throws an explicit configuration error
 * instead of embedding an incorrect hardcoded domain.
 */
export function getPublicOrigin(customOrigin?: string): string {
  if (customOrigin && customOrigin.trim()) {
    return normalizeOrigin(customOrigin.trim());
  }

  // 1. Check explicit public site URL environment variables
  const envSiteUrl =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL);

  if (envSiteUrl && envSiteUrl.trim()) {
    return normalizeOrigin(envSiteUrl.trim());
  }

  // 2. Check Vercel deployment URL
  const vercelUrl = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl && vercelUrl.trim()) {
    const rawVercel = vercelUrl.trim();
    const prefixed = rawVercel.startsWith("http://") || rawVercel.startsWith("https://")
      ? rawVercel
      : `https://${rawVercel}`;
    return normalizeOrigin(prefixed);
  }

  // 3. Check browser window origin
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return normalizeOrigin(window.location.origin);
  }

  // 4. Non-production development fallback
  const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  if (!isProd) {
    return "http://localhost:3000";
  }

  // 5. In production without config or browser context, fail fast and securely
  throw new Error(
    "NFC URL generation failed: No public site origin configured. " +
    "Please set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL in your environment."
  );
}

/**
 * Normalizes an origin string: ensures http/https protocol and strips trailing slashes.
 */
function normalizeOrigin(origin: string): string {
  let normalized = origin.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

/**
 * Checks whether the current runtime environment supports Web NFC writing.
 * Strictly SSR-safe: returns false if called during Next.js SSR.
 */
export function isNfcWritingSupported(): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    return "NDEFReader" in window || Boolean((window as any).NDEFReader);
  } catch {
    return false;
  }
}

/**
 * Centralized, environment-aware builder for NFC deep-link URLs.
 * Encodes householdId, access token, and schema version into standard NDEF URI format.
 */
export function buildNfcUrl(
  householdId: string,
  token: string,
  customOrigin?: string,
  version: number = 1
): string {
  if (!householdId || !householdId.trim()) {
    throw new Error("Household ID is required to build NFC URL.");
  }
  if (!token || !token.trim()) {
    throw new Error("Access token is required to build NFC URL.");
  }

  const baseOrigin = getPublicOrigin(customOrigin);
  const url = new URL("/nfc", baseOrigin);
  url.searchParams.set("hh", householdId.trim());
  url.searchParams.set("t", token.trim());
  url.searchParams.set("v", String(version));
  return url.toString();
}

/**
 * Writes an NDEF URL record to a physical NFC tag via the Web NFC API.
 * Handles DOMException variants and abort signals with actionable user feedback.
 */
export async function writeNfcTag(
  nfcUrl: string,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!isNfcWritingSupported()) {
    return {
      success: false,
      error:
        "Web NFC writing is not supported on this browser or device. Please use Chrome on an NFC-enabled Android device.",
    };
  }

  try {
    const NDEFReaderClass = (window as any).NDEFReader;
    const ndef = new NDEFReaderClass();

    await ndef.write(
      {
        records: [
          {
            recordType: "url",
            data: nfcUrl,
          },
        ],
      },
      { signal: abortSignal }
    );

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { success: false, error: "NFC write operation was cancelled." };
      }
      if (err.name === "NotAllowedError") {
        return {
          success: false,
          error:
            "NFC permission was denied. Please allow NFC access in your Chrome site settings.",
        };
      }
      if (err.name === "NotSupportedError") {
        return {
          success: false,
          error:
            "NFC is not supported or currently disabled. Please enable NFC in your Android settings.",
        };
      }
      if (err.name === "NetworkError") {
        return {
          success: false,
          error:
            "NFC card moved away too quickly. Please bring the card closer and hold it steady against the back of your phone.",
        };
      }
      if (err.name === "InvalidStateError") {
        return {
          success: false,
          error:
            "The NFC tag is locked or formatted as read-only. Please use a writable NDEF-compatible NFC tag.",
        };
      }
      return { success: false, error: err.message || "Failed to write NFC tag." };
    }
    return {
      success: false,
      error: "An unexpected error occurred while communicating with the NFC tag.",
    };
  }
}
