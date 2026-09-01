/**
 * Canonical SwasthyaSetu User Roles
 * Authoritative role is strictly resolved and verified by the backend.
 */
export type UserRole = "CITIZEN" | "ASHA" | "ADMIN";

/**
 * User Consent Status
 */
export type ConsentStatus = "accepted" | "pending" | "declined";

/**
 * Server-Validated User Profile Entity stored in /users/{uid}
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  role: UserRole;
  consentStatus: ConsentStatus;
  consentVersion: string | null;
  consentedAt: string | null;
  ashaServiceCode?: string | null;
  serviceArea?: string | null;
  preferredLanguage?: "en" | "kn" | "hi" | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Historical Consent Audit Record stored in /users/{uid}/consent_history/{consentId}
 */
export interface ConsentRecord {
  id: string;
  userId: string;
  consentVersion: string;
  accepted: boolean;
  timestamp: string;
  method: "web_portal" | "mobile" | "admin";
}

/**
 * Consent Submission Payload
 */
export interface ConsentSubmission {
  consentVersion: string;
  accepted: boolean;
  method?: "web_portal" | "mobile";
}

/**
 * Admin Role Assignment Payload
 */
export interface RoleAssignmentRequest {
  targetUid: string;
  newRole: UserRole;
}

/**
 * Response for GET /api/v1/auth/me
 */
export interface AuthMeResponse {
  user: UserProfile;
  isConsentRequired: boolean;
  activeConsentVersion: string;
}

/**
 * Response for POST /api/v1/auth/sync
 */
export interface AuthSyncResponse {
  user: UserProfile;
  isNewUser: boolean;
  isConsentRequired: boolean;
  activeConsentVersion: string;
}
