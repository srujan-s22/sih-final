/**
 * ==============================================================================
 * SWASTHYASETU NFC CREDENTIAL PARSER (PHASE 4 ROBUSTNESS)
 * ==============================================================================
 * Authoritative client-side parser for extracting and sanitizing NFC credentials
 * from URL search parameters.
 *
 * Enforces strict validation:
 * - Duplicate query parameters (e.g. ?hh=a&hh=b or ?t=1&t=2) are REJECTED.
 * - Whitespace is trimmed safely.
 * - Length bounds match Phase 1 backend schema:
 *     - householdId: 3 to 100 characters
 *     - token: 16 to 128 characters
 *     - version: 1 to 100,000 (positive integer, optional)
 * - Empty parameter state is distinguished from malformed credentials.
 * - Raw bearer tokens are NEVER logged or retained beyond in-memory resolution.
 */

export interface NfcCredential {
  householdId: string;
  token: string;
  version?: number;
}

export type ParseNfcCredentialResult =
  | { status: "VALID"; credential: NfcCredential }
  | { status: "EMPTY" }
  | { status: "MALFORMED"; reason: string };

type SearchParamsInput =
  | URLSearchParams
  | {
      get(name: string): string | null;
      getAll?(name: string): string[];
    }
  | string
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

/**
 * Parses search parameters into a validated NFC credential.
 */
export function parseNfcCredential(input: SearchParamsInput): ParseNfcCredentialResult {
  if (!input) {
    return { status: "EMPTY" };
  }

  let params: {
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
  };

  if (typeof input === "string") {
    const cleanQuery = input.startsWith("?") ? input.slice(1) : input;
    if (!cleanQuery.trim()) {
      return { status: "EMPTY" };
    }
    const searchParams = new URLSearchParams(cleanQuery);
    params = {
      get: (k) => searchParams.get(k),
      getAll: (k) => searchParams.getAll(k),
      has: (k) => searchParams.has(k),
    };
  } else if (input instanceof URLSearchParams) {
    params = {
      get: (k) => input.get(k),
      getAll: (k) => input.getAll(k),
      has: (k) => input.has(k),
    };
  } else if (typeof (input as any).get === "function") {
    const inputObj = input as {
      get(name: string): string | null;
      getAll?(name: string): string[];
      has?(name: string): boolean;
    };
    params = {
      get: (k) => inputObj.get(k),
      getAll: (k) => (typeof inputObj.getAll === "function" ? inputObj.getAll(k) : inputObj.get(k) ? [inputObj.get(k)!] : []),
      has: (k) => (typeof inputObj.has === "function" ? inputObj.has(k) : inputObj.get(k) !== null),
    };
  } else if (typeof input === "object") {
    const record = input as Record<string, string | string[] | undefined>;
    params = {
      get: (k) => {
        const val = record[k];
        if (Array.isArray(val)) return val[0] ?? null;
        return typeof val === "string" ? val : null;
      },
      getAll: (k) => {
        const val = record[k];
        if (Array.isArray(val)) return val.filter((item): item is string => typeof item === "string");
        return typeof val === "string" ? [val] : [];
      },
      has: (k) => k in record && record[k] !== undefined,
    };
  } else {
    return { status: "MALFORMED", reason: "Unsupported search parameter format" };
  }

  const allHh = params.getAll("hh");
  const allT = params.getAll("t");
  const allV = params.getAll("v");

  // 1. Check if entirely empty
  if (allHh.length === 0 && allT.length === 0 && allV.length === 0) {
    return { status: "EMPTY" };
  }

  // 2. Strict duplicate check (Section 4): Reject ambiguous duplicate parameters
  if (allHh.length > 1) {
    return { status: "MALFORMED", reason: "Duplicate household ID parameter detected" };
  }
  if (allT.length > 1) {
    return { status: "MALFORMED", reason: "Duplicate token parameter detected" };
  }
  if (allV.length > 1) {
    return { status: "MALFORMED", reason: "Duplicate version parameter detected" };
  }

  const rawHh = allHh[0] ?? "";
  const rawT = allT[0] ?? "";
  const rawV = allV[0];

  const hh = rawHh.trim();
  const token = rawT.trim();

  // 3. Completeness check: Both hh and token must be present and non-empty
  if (!hh || !token) {
    return {
      status: "MALFORMED",
      reason: !hh && !token
        ? "Missing household ID and token"
        : !hh
        ? "Missing household ID"
        : "Missing access token",
    };
  }

  // 4. Length Bounds Validation matching Phase 1 Schema (Section 5)
  if (hh.length < 3 || hh.length > 100) {
    return {
      status: "MALFORMED",
      reason: "Household ID must be between 3 and 100 characters",
    };
  }

  if (token.length < 16 || token.length > 128) {
    return {
      status: "MALFORMED",
      reason: "Access token must be between 16 and 128 characters",
    };
  }

  // 5. Version Handling (Section 6)
  let version: number | undefined;
  if (rawV !== undefined && rawV !== null) {
    const trimmedV = rawV.trim();
    if (trimmedV.length > 0) {
      if (!/^\d+$/.test(trimmedV)) {
        return {
          status: "MALFORMED",
          reason: "Version parameter must be a positive integer",
        };
      }
      const parsedVer = parseInt(trimmedV, 10);
      if (parsedVer < 1 || parsedVer > 100000) {
        return {
          status: "MALFORMED",
          reason: "Version parameter out of valid range (1 - 100,000)",
        };
      }
      version = parsedVer;
    }
  }

  return {
    status: "VALID",
    credential: {
      householdId: hh,
      token,
      ...(version !== undefined ? { version } : {}),
    },
  };
}
