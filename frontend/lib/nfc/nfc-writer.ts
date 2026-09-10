declare const window: any;

const DEFAULT_SITE_URL = "https://swasthyasetu.gov.in";

/**
 * Checks whether the current runtime environment supports Web NFC writing.
 * Strictly SSR-safe: returns false if called during Next.js SSR.
 */
export function isNfcWritingSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "NDEFReader" in window || Boolean((window as any).NDEFReader);
}

/**
 * Centralized, environment-aware builder for NFC deep-link URLs.
 * Encodes householdId, access token, and schema version into standard NDEF URI format.
 */
export function buildNfcUrl(
  householdId: string,
  token: string,
  customOrigin?: string
): string {
  if (!householdId || !householdId.trim()) {
    throw new Error("Household ID is required to build NFC URL.");
  }
  if (!token || !token.trim()) {
    throw new Error("Access token is required to build NFC URL.");
  }

  let base: string =
    customOrigin ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : DEFAULT_SITE_URL);

  // Ensure base has proper protocol
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    base = `https://${base}`;
  }

  const url = new URL("/nfc", base);
  url.searchParams.set("hh", householdId.trim());
  url.searchParams.set("t", token.trim());
  url.searchParams.set("v", "1");
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
