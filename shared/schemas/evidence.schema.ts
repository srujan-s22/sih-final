import { z } from "zod";

export const SourceAuthorityTypeSchema = z.enum([
  "OFFICIAL_GOVERNMENT",
  "STATE_GOVERNMENT",
  "OFFICIAL_PORTAL",
  "TRUSTED_HEALTHCARE",
  "UNVERIFIED",
  "REJECTED",
]);

export const SourceDocumentTypeSchema = z.enum([
  "GUIDELINE",
  "GOVERNMENT_NOTIFICATION",
  "GAZETTE",
  "OFFICIAL_PORTAL",
  "FAQ",
  "POLICY_DOCUMENT",
  "PRESS_RELEASE",
  "PROGRAM_DOCUMENT",
  "UNKNOWN",
]);

export const EvidenceVerificationStatusSchema = z.enum([
  "DISCOVERED",
  "PENDING_REVIEW",
  "VERIFIED",
  "REJECTED",
  "SUPERSEDED",
]);

export const EvidenceVerificationMethodSchema = z.enum([
  "ADMIN_EXPLICIT_REVIEW",
  "AUTHORITATIVE_SOURCE_AUDIT",
  "SCHEME_VERSION_SEED",
]);

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  schemeVersionId: z.string().optional(),
  claim: z.string(),
  query: z.string(),
  queryHash: z.string(),
  sourceUrl: z.string().url(),
  sourceDomain: z.string(),
  sourceOrganization: z.string(),
  officialTitle: z.string(),
  sourceType: SourceAuthorityTypeSchema,
  documentType: SourceDocumentTypeSchema,
  sourceCitation: z.string().optional(),
  relevantExcerpt: z.string(),
  retrievedAt: z.string(),
  publishedAt: z.string().optional(),
  effectiveDate: z.string().optional(),
  verifiedAt: z.string().optional(),
  verificationStatus: EvidenceVerificationStatusSchema,
  verificationMethod: EvidenceVerificationMethodSchema.optional(),
  rejectionReason: z.string().optional(),
  contentHash: z.string(),
  supersedesEvidenceId: z.string().optional(),
  discoveredBy: z.string(),
  verifiedBy: z.string().optional(),
  authorityScore: z.number().min(0).max(100),
  relevanceScore: z.number().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const EvidenceConflictTypeSchema = z.enum([
  "CRITERIA_CHANGED",
  "BENEFIT_AMOUNT_CHANGED",
  "AGE_THRESHOLD_CHANGED",
  "GEOGRAPHIC_SCOPE_CHANGED",
  "INCOME_CRITERIA_CHANGED",
  "DOCUMENT_REQUIREMENT_CHANGED",
  "SCHEME_STATUS_CHANGED",
  "SOURCE_SUPERSEDED",
  "EFFECTIVE_DATE_CHANGED",
  "UNKNOWN_CONFLICT",
]);

export const EvidenceConflictStatusSchema = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
]);

export const EvidenceConflictSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  schemeVersionId: z.string().optional(),
  existingEvidenceId: z.string().optional(),
  newEvidenceId: z.string(),
  claim: z.string(),
  conflictType: EvidenceConflictTypeSchema,
  reason: z.string(),
  detectedAt: z.string(),
  status: EvidenceConflictStatusSchema,
  resolutionNotes: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PublicVerifiedEvidenceSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  claim: z.string(),
  officialTitle: z.string(),
  sourceOrganization: z.string(),
  sourceUrl: z.string().url(),
  sourceCitation: z.string().optional(),
  relevantExcerpt: z.string(),
  lastVerifiedAt: z.string(),
  documentType: SourceDocumentTypeSchema,
});

export const EvidenceSearchRequestSchema = z.object({
  schemeId: z.string().min(2, "Scheme ID must be at least 2 characters"),
  schemeVersionId: z.string().optional(),
  claim: z.string().min(5, "Claim must be at least 5 characters"),
  forceRefresh: z.boolean().optional().default(false),
});

export const UpdateEvidenceStatusRequestSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED", "SUPERSEDED"]),
  reason: z.string().optional(),
});
