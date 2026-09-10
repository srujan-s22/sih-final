declare const window: any;
declare const navigator: any;
declare const document: any;

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

  // 1. Client-side execution: prioritize browser window origin over deployment/preview URLs
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return normalizeOrigin(window.location.origin);
  }

  // 2. Check explicit public site URL environment variables (server-side / explicit config)
  const envSiteUrl =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL);

  if (envSiteUrl && envSiteUrl.trim()) {
    return normalizeOrigin(envSiteUrl.trim());
  }

  // 3. Check Vercel deployment URL (fallback for server-side / SSR when window is undefined)
  const vercelUrl = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl && vercelUrl.trim()) {
    const rawVercel = vercelUrl.trim();
    const prefixed = rawVercel.startsWith("http://") || rawVercel.startsWith("https://")
      ? rawVercel
      : `https://${rawVercel}`;
    return normalizeOrigin(prefixed);
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
 * Omits optional "&v=1" when version === 1 to ensure the NDEF message fits comfortably
 * within NTAG213 tag capacity (<117 bytes).
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
  if (version !== 1) {
    url.searchParams.set("v", String(version));
  }
  return url.toString();
}

/**
 * Options for Web NFC physical tag writing.
 */
export interface WriteNfcOptions {
  signal?: AbortSignal;
  onRetry?: (attempt: number) => void;
}

/**
 * Writes an NDEF URL record to a physical NFC tag via the Web NFC API.
 * Handles DOMException variants, retries transient NetworkErrors exactly once after a 250ms delay,
 * and provides actionable user feedback without leaking sensitive tokens.
 */
export async function writeNfcTag(
  nfcUrl: string,
  optionsOrSignal?: AbortSignal | WriteNfcOptions
): Promise<{ success: boolean; error?: string }> {
  if (!isNfcWritingSupported()) {
    return {
      success: false,
      error:
        "Web NFC writing is not supported on this browser or device. Please use Chrome on an NFC-enabled Android device.",
    };
  }

  const signal =
    optionsOrSignal instanceof AbortSignal
      ? optionsOrSignal
      : optionsOrSignal?.signal;
  const onRetry =
    !(optionsOrSignal instanceof AbortSignal)
      ? optionsOrSignal?.onRetry
      : undefined;

  const executeWrite = async () => {
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
      {
        overwrite: true,
        signal,
      }
    );
  };

  try {
    try {
      await executeWrite();
      return { success: true };
    } catch (firstErr: unknown) {
      // If a transient NetworkError occurs (e.g. initial RF contact blip or Android Tag Dispatcher collision)
      // and the operation was not aborted by user, retry exactly once after a 250ms stabilization delay.
      if (
        firstErr instanceof Error &&
        firstErr.name === "NetworkError" &&
        !signal?.aborted
      ) {
        onRetry?.(1);

        await new Promise((resolve) => setTimeout(resolve, 250));

        if (signal?.aborted) {
          return { success: false, error: "NFC write operation was cancelled." };
        }

        await executeWrite();
        return { success: true };
      }
      throw firstErr;
    }
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
        const rawMsg = typeof err.message === "string" ? err.message.trim() : "";
        // Sanitize: ensure no tokens, query strings, or URLs leak in error messages
        const safeDetail =
          rawMsg && !rawMsg.includes("/nfc") && !rawMsg.includes("hh_") && !rawMsg.includes("?")
            ? ` (${rawMsg})`
            : "";
        return {
          success: false,
          error:
            `NFC communication was interrupted${safeDetail}. Please hold the NFC card flat and steady against the back of your phone near the NFC antenna, and try again.`,
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

/**
 * Copies the generated NFC provisioning URL to the user's clipboard.
 * Production-quality fallback for environments lacking Web NFC (e.g. iOS Safari, desktop, non-Chrome browsers).
 * Uses navigator.clipboard.writeText when available, with a safe fallback to document.execCommand.
 * Does not persist, log, or expose the URL or token.
 */
export async function copyNfcLinkToClipboard(
  nfcUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!nfcUrl || !nfcUrl.trim()) {
    return { success: false, error: "No NFC link available to copy." };
  }

  // 1. Modern navigator.clipboard API
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(nfcUrl);
      return { success: true };
    }
  } catch {
    // If navigator.clipboard fails (e.g. permissions or older WebKit), fall through to execCommand
  }

  // 2. Legacy fallback for older browsers or constrained contexts
  try {
    if (typeof document !== "undefined" && document.createElement && document.body) {
      const textArea = document.createElement("textarea");
      textArea.value = nfcUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.style.opacity = "0";
      textArea.setAttribute("readonly", "");
      textArea.setAttribute("aria-hidden", "true");
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        return { success: true };
      }
    }
  } catch {
    // Both mechanisms failed
  }

  return {
    success: false,
    error:
      "Unable to copy NFC link automatically. Please check your browser clipboard permissions.",
  };
}
