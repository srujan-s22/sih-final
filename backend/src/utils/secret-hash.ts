import * as crypto from "crypto";

/**
 * Computes a deterministic SHA-256 hash of a registration secret.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret.trim()).digest("hex");
}

/**
 * Securely verifies a supplied secret against the expected hash using constant-time comparison.
 * Returns false if either parameter is missing, empty, or mismatched.
 */
export function verifySecretHash(
  suppliedSecret: string | undefined | null,
  expectedHash: string | undefined | null
): boolean {
  if (!suppliedSecret || !expectedHash) {
    return false;
  }

  const cleanSecret = suppliedSecret.trim();
  const cleanExpected = expectedHash.trim().toLowerCase();

  if (cleanSecret.length === 0 || cleanExpected.length === 0) {
    return false;
  }

  const suppliedHash = crypto.createHash("sha256").update(cleanSecret).digest("hex");

  // Constant-time comparison
  const suppliedBuf = Buffer.from(suppliedHash, "hex");
  const expectedBuf = Buffer.from(cleanExpected, "hex");

  if (suppliedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedBuf, expectedBuf);
}
