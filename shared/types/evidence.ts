/**
 * Source Authority Classification
 * Distinguishes official government sources from third-party and untrusted domains.
 */
export type SourceAuthorityType =
  | "OFFICIAL_GOVERNMENT"
  | "STATE_GOVERNMENT"
  | "OFFICIAL_PORTAL"
  | "TRUSTED_HEALTHCARE"
  | "UNVERIFIED"
  | "REJECTED";

/**
 * Classification of government source document types
 */
export type SourceDocumentType =
  | "GUIDELINE"
  | "GOVERNMENT_NOTIFICATION"
  | "GAZETTE"
  | "OFFICIAL_PORTAL"
  | "FAQ"
  | "POLICY_DOCUMENT"
  | "PRESS_RELEASE"
  | "PROGRAM_DOCUMENT"
  | "UNKNOWN";

/**
 * Multi-stage Evidence Verification Lifecycle
 * Evidence begins as DISCOVERED / PENDING_REVIEW and is NEVER automatically VERIFIED.
 */
export type EvidenceVerificationStatus =
  | "DISCOVERED"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "SUPERSEDED";

/**
 * Verification method applied to the evidence
 */
export type EvidenceVerificationMethod =
  | "ADMIN_EXPLICIT_REVIEW"
  | "AUTHORITATIVE_SOURCE_AUDIT"
  | "SCHEME_VERSION_SEED";

/**
 * Full Provenance Evidence Record
 * Stored at policy/claim level (never contains citizen PII).
 */
export interface EvidenceRecord {
  id: string;
  schemeId: string;
  schemeVersionId?: string;
  claim: string;
  query: string;
  queryHash: string;

  // Source Provenance
  sourceUrl: string;
  sourceDomain: string;
  sourceOrganization: string;
  officialTitle: string;
  sourceType: SourceAuthorityType;
  documentType: SourceDocumentType;

  // Citation & Excerpt
  sourceCitation?: string;
  relevantExcerpt: string;

  // Freshness & Effective Dates
  retrievedAt: string;
  publishedAt?: string;
  effectiveDate?: string;
  verifiedAt?: string;

  // Verification State
  verificationStatus: EvidenceVerificationStatus;
  verificationMethod?: EvidenceVerificationMethod;
  rejectionReason?: string;

  // Hashing & Audit
  contentHash: string;
  supersedesEvidenceId?: string;
  discoveredBy: string; // e.g. "TAVILY_SEARCH" | "SYSTEM_SEED" | admin UID
  verifiedBy?: string; // Admin UID who verified

  // Advisory Scores
  authorityScore: number; // 0-100
  relevanceScore: number; // 0-100

  createdAt: string;
  updatedAt: string;
}

/**
 * Types of detected policy/rule conflicts
 */
export type EvidenceConflictType =
  | "CRITERIA_CHANGED"
  | "BENEFIT_AMOUNT_CHANGED"
  | "AGE_THRESHOLD_CHANGED"
  | "GEOGRAPHIC_SCOPE_CHANGED"
  | "INCOME_CRITERIA_CHANGED"
  | "DOCUMENT_REQUIREMENT_CHANGED"
  | "SCHEME_STATUS_CHANGED"
  | "SOURCE_SUPERSEDED"
  | "EFFECTIVE_DATE_CHANGED"
  | "UNKNOWN_CONFLICT";

/**
 * Conflict lifecycle status
 */
export type EvidenceConflictStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

/**
 * Non-destructive conflict record
 */
export interface EvidenceConflict {
  id: string;
  schemeId: string;
  schemeVersionId?: string;
  existingEvidenceId?: string;
  newEvidenceId: string;
  claim: string;
  conflictType: EvidenceConflictType;
  reason: string;
  detectedAt: string;
  status: EvidenceConflictStatus;
  resolutionNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search Cache Record
 * Persistent in /evidence_search_cache/{queryHash}
 */
export interface EvidenceSearchCacheRecord {
  queryHash: string;
  normalizedQuery: string;
  schemeId: string;
  schemeVersionId?: string;
  claim: string;
  resultCount: number;
  evidenceIds: string[];
  retrievedAt: string;
  expiresAt: string;
  provider: "tavily" | "system_fixture";
  providerRequestId?: string;
}

/**
 * Internal Normalized Provider Candidate (before domain validation & storage)
 */
export interface EvidenceCandidate {
  url: string;
  title: string;
  content: string;
  score?: number;
  publishedDate?: string;
  rawHostname: string;
}

/**
 * Admin Audit Trail Record for Evidence Actions
 */
export interface EvidenceAuditLog {
  id: string;
  adminUid: string;
  action: "EVIDENCE_VERIFIED" | "EVIDENCE_REJECTED" | "EVIDENCE_SUPERSEDED" | "CONFLICT_RESOLVED" | "CONFLICT_DISMISSED";
  evidenceId?: string;
  conflictId?: string;
  schemeId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  timestamp: string;
}

/**
 * Citizen-Safe Verified Evidence View
 * Contains ONLY public-facing verified source details (no internal hashes/notes/drafts).
 */
export interface PublicVerifiedEvidence {
  id: string;
  schemeId: string;
  claim: string;
  officialTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
  sourceCitation?: string;
  relevantExcerpt: string;
  lastVerifiedAt: string;
  documentType: SourceDocumentType;
}

/**
 * Admin Search Request DTO
 */
export interface EvidenceSearchRequest {
  schemeId: string;
  schemeVersionId?: string;
  claim: string;
  forceRefresh?: boolean;
}

/**
 * Admin Search Response DTO
 */
export interface EvidenceSearchResponse {
  cacheHit: boolean;
  query: string;
  queryHash: string;
  schemeId: string;
  retrievedAt: string;
  expiresAt: string;
  candidatesCount: number;
  evidence: EvidenceRecord[];
  conflicts: EvidenceConflict[];
}

/**
 * Admin Verification Update DTO
 */
export interface UpdateEvidenceStatusRequest {
  status: "VERIFIED" | "REJECTED" | "SUPERSEDED";
  reason?: string;
}
