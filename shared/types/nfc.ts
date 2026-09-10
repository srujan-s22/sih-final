/**
 * ==============================================================================
 * SWASTHYASETU NFC DOMAIN CONTRACTS (PHASE 1 & PHASE 2 HARDENING)
 * ==============================================================================
 */

export type NfcCardStatus = "ACTIVE" | "PENDING_WRITE" | "REVOKED";

/**
 * Server-side stored NFC credential entity in /household_nfc/{nfcId}
 * Note: Raw token is NEVER stored in database. Only SHA-256 tokenHash is persisted.
 */
export interface HouseholdNfcRecord {
  id: string;
  householdId: string;
  tokenHash: string;
  version: number;
  status: NfcCardStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
}

/**
 * Payload returned to authorized staff (ASHA/Admin) upon initial tag provisioning or rotation initiation.
 * The raw token is returned ONCE immediately after generation so the phone can write it to the physical tag.
 */
export interface NfcProvisionResponse {
  householdId: string;
  nfcId: string;
  token: string;
  version: number;
}

/**
 * Response for revoking an active NFC tag
 */
export interface NfcRevokeResponse {
  success: boolean;
  householdId: string;
  status: "REVOKED";
  revokedAt: string;
}

/**
 * Response for confirming successful physical write of a rotated NFC tag
 */
export interface NfcConfirmRotationResponse {
  success: boolean;
  householdId: string;
  nfcId: string;
  version: number;
  status: "ACTIVE";
  activatedAt: string;
}

/**
 * Response for cancelling an in-progress rotation
 */
export interface NfcCancelRotationResponse {
  success: boolean;
  householdId: string;
  cancelledNfcId?: string;
  activeVersion: number;
}

/**
 * Privacy-minimal public scheme summary for the unauthenticated NFC tap view.
 * Excludes internal rule definitions, diagnosis codes, and evaluation traces.
 */
export interface NfcPublicSchemeSummary {
  schemeId: string;
  name: string;
  benefit: string;
  nextSteps: string;
  eligibilityStatus: "ELIGIBLE" | "ACTION_REQUIRED" | "CHECK_REQUIRED";
}

/**
 * Safe public ASHA worker directory information for the NFC tap view.
 * Strictly excludes UID, email, personal phone numbers, and secrets.
 */
export interface NfcPublicAshaInfo {
  displayName: string;
  serviceArea: string;
  code: string;
}

/**
 * Basic region and household context for the unauthenticated NFC tap view.
 * Strictly excludes income category, ration card number, phone number, and individual member rosters.
 */
export interface NfcPublicHouseholdContext {
  displayName: string;
  region: {
    village: string;
    district: string;
    state: string;
  };
}

/**
 * Complete, privacy-minimal public DTO returned by the public NFC resolve API.
 */
export interface NfcResolveResponse {
  household: NfcPublicHouseholdContext;
  schemes: NfcPublicSchemeSummary[];
  asha: NfcPublicAshaInfo | null;
}

/**
 * Safe status metadata for an authorized household NFC credential query.
 * Excludes raw tokens and cryptographic hashes.
 */
export interface HouseholdNfcStatusResponse {
  hasActiveNfc: boolean;
  record: {
    id: string;
    householdId: string;
    version: number;
    status: NfcCardStatus;
    createdAt: string;
    updatedAt: string;
    revokedAt?: string | null;
  } | null;
  pendingReplacement?: {
    id: string;
    version: number;
    createdAt: string;
  } | null;
}
