import { UserRole } from "../../../shared/types/auth.js";
import { verifySecretHash } from "../utils/secret-hash.js";
import { env } from "../config/env.js";

export interface VerificationResult {
  allowed: boolean;
  role?: UserRole;
  error?: string;
  statusCode: number;
}

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const SAFE_INVALID_CODE_MSG = "Staff registration could not be completed. Please verify your authorization code.";
const SAFE_UNAVAILABLE_MSG = "Privileged account registration is currently unavailable.";

export class PrivilegedAuthService {
  private failedAttempts = new Map<string, AttemptRecord>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private ashaSecretHash?: string,
    private adminSecretHash?: string
  ) {
    this.ashaSecretHash = ashaSecretHash ?? env.ASHA_REGISTRATION_SECRET_HASH;
    this.adminSecretHash = adminSecretHash ?? env.ADMIN_REGISTRATION_SECRET_HASH;
  }

  /**
   * Sets hashes dynamically (useful for test isolation)
   */
  public setHashes(ashaHash?: string, adminHash?: string) {
    this.ashaSecretHash = ashaHash;
    this.adminSecretHash = adminHash;
  }

  /**
   * Clears in-memory failed attempt records
   */
  public clearFailedAttempts(): void {
    this.failedAttempts.clear();
  }

  /**
   * Checks whether the identifier (IP or email) is rate-limited due to repeated failed privileged registration attempts.
   */
  public isRateLimited(identifier: string): boolean {
    const record = this.failedAttempts.get(identifier);
    if (!record) return false;

    const now = Date.now();
    if (now - record.firstAttemptAt > this.WINDOW_MS) {
      this.failedAttempts.delete(identifier);
      return false;
    }

    const limit = (process.env.NODE_ENV === "development" && (identifier === "127.0.0.1" || identifier === "::1" || identifier === "localhost"))
      ? 100
      : this.MAX_ATTEMPTS;

    return record.count >= limit;
  }

  /**
   * Records a failed privileged registration attempt.
   */
  public recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const record = this.failedAttempts.get(identifier);

    if (!record || now - record.firstAttemptAt > this.WINDOW_MS) {
      this.failedAttempts.set(identifier, { count: 1, firstAttemptAt: now });
    } else {
      record.count += 1;
    }
  }

  /**
   * Resets failed attempts upon successful privileged verification.
   */
  public resetFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Authorizes the requested role and verifies staff registration secrets against configured hashes.
   * STRICT SECURITY RULES:
   * 1. Unspecified requestedRole is a normal sync -> allowed, role is undefined.
   * 2. CITIZEN role requires no secret.
   * 3. ASHA role requires ASHA_REGISTRATION_SECRET_HASH and matching secret.
   * 4. ADMIN role requires ADMIN_REGISTRATION_SECRET_HASH and matching secret.
   * 5. Missing secret hash FAILS CLOSED (never allows privileged access).
   * 6. Never leaks internal hash or whether secret is configured.
   */
  public verifyPrivilegedRole(
    requestedRole: string | undefined | null,
    registrationSecret: string | undefined | null,
    rateLimitKey?: string
  ): VerificationResult {
    // 0. No explicit role requested (regular login sync)
    if (!requestedRole) {
      return {
        allowed: true,
        role: undefined,
        statusCode: 200,
      };
    }

    // 1. Citizen Role: Open registration, no privileged secret required
    if (requestedRole === "CITIZEN") {
      return {
        allowed: true,
        role: "CITIZEN",
        statusCode: 200,
      };
    }

    // 2. ASHA Role Verification
    if (requestedRole === "ASHA") {
      if (!this.ashaSecretHash || this.ashaSecretHash.trim().length === 0) {
        // FAIL CLOSED: Configuration missing
        return {
          allowed: false,
          role: "CITIZEN",
          error: SAFE_UNAVAILABLE_MSG,
          statusCode: 503,
        };
      }

      const isValid = Boolean(registrationSecret && verifySecretHash(registrationSecret, this.ashaSecretHash));
      if (isValid) {
        if (rateLimitKey) this.resetFailedAttempts(rateLimitKey);
        return {
          allowed: true,
          role: "ASHA",
          statusCode: 200,
        };
      }

      // Invalid secret: check if already rate limited before this attempt
      const wasRateLimited = rateLimitKey ? this.isRateLimited(rateLimitKey) : false;
      if (rateLimitKey) this.recordFailedAttempt(rateLimitKey);

      return {
        allowed: false,
        role: "CITIZEN",
        error: wasRateLimited
          ? "Too many failed privileged registration attempts. Please try again later."
          : SAFE_INVALID_CODE_MSG,
        statusCode: wasRateLimited ? 429 : 403,
      };
    }

    // 3. ADMIN Role Verification
    if (requestedRole === "ADMIN") {
      if (!this.adminSecretHash || this.adminSecretHash.trim().length === 0) {
        // FAIL CLOSED: Configuration missing
        return {
          allowed: false,
          role: "CITIZEN",
          error: SAFE_UNAVAILABLE_MSG,
          statusCode: 503,
        };
      }

      const isValid = Boolean(registrationSecret && verifySecretHash(registrationSecret, this.adminSecretHash));
      if (isValid) {
        if (rateLimitKey) this.resetFailedAttempts(rateLimitKey);
        return {
          allowed: true,
          role: "ADMIN",
          statusCode: 200,
        };
      }

      // Invalid secret: check if already rate limited before this attempt
      const wasRateLimited = rateLimitKey ? this.isRateLimited(rateLimitKey) : false;
      if (rateLimitKey) this.recordFailedAttempt(rateLimitKey);

      return {
        allowed: false,
        role: "CITIZEN",
        error: wasRateLimited
          ? "Too many failed privileged registration attempts. Please try again later."
          : SAFE_INVALID_CODE_MSG,
        statusCode: wasRateLimited ? 429 : 403,
      };
    }

    // 4. Reject arbitrary / unsupported roles
    if (rateLimitKey) this.recordFailedAttempt(rateLimitKey);
    return {
      allowed: false,
      role: "CITIZEN",
      error: "Invalid role requested.",
      statusCode: 400,
    };
  }
}
