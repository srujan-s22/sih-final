import { z } from "zod";

export const AICapabilitySchema = z.enum([
  "EXPLAIN_ELIGIBILITY",
  "PRIORITIZE_GAPS",
  "GENERATE_ACTION_PLAN",
  "SUMMARIZE_EVIDENCE",
  "EXPLAIN_NEEDS_INFORMATION",
]);

export const AICertaintyStateSchema = z.enum([
  "GROUNDED",
  "PARTIALLY_GROUNDED",
  "INSUFFICIENT_INFORMATION",
]);

export const AILanguageSchema = z.enum(["en", "hi", "kn"]);

export const AIHouseholdSummarySchema = z.object({
  state: z.string().min(1),
  district: z.string().min(1),
  incomeCategory: z.string().min(1),
  memberCount: z.number().int().nonnegative(),
});

export const AIMemberSummarySchema = z.object({
  memberIndex: z.number().int().nonnegative(),
  age: z.number().int().nonnegative(),
  gender: z.string(),
  relationship: z.string(),
  disabilityStatus: z.boolean(),
  maternalStatus: z.string().optional(),
  chronicConditionsCount: z.number().int().nonnegative(),
});

export const AIEligibilitySummarySchema = z.object({
  schemeId: z.string().min(1),
  schemeName: z.string().min(1),
  status: z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "NEEDS_INFORMATION", "UNKNOWN"]),
  pathwayCode: z.string().optional(),
  benefitSummary: z.string().optional(),
  matchedRuleSummaries: z.array(z.string()),
  failedRuleSummaries: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  isVerifiedScheme: z.boolean(),
});

export const AIGapSummarySchema = z.object({
  gapId: z.string().min(1),
  schemeId: z.string().optional(),
  schemeName: z.string().optional(),
  type: z.string(),
  priority: z.enum(["REQUIRED", "IMPORTANT", "OPTIONAL"]),
  title: z.string().min(1),
  description: z.string(),
  reason: z.string().optional(),
});

export const AISchemeSummarySchema = z.object({
  schemeId: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  category: z.string(),
  level: z.enum(["CENTRAL", "STATE"]),
  benefitSummary: z.string(),
  isVerified: z.boolean(),
});

export const AIVerifiedEvidenceSummarySchema = z.object({
  id: z.string().min(1),
  schemeId: z.string().min(1),
  claim: z.string(),
  officialTitle: z.string(),
  sourceOrganization: z.string(),
  sourceUrl: z.string().url(),
  sourceType: z.string(),
  documentType: z.string(),
  relevantExcerpt: z.string(),
});

export const AIExistingActionSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  actionType: z.string(),
  priority: z.string(),
});

export const AIContextSchema = z.object({
  contextVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  requestPurpose: AICapabilitySchema,
  language: AILanguageSchema,
  householdSummary: AIHouseholdSummarySchema,
  memberSummaries: z.array(AIMemberSummarySchema),
  eligibilityResults: z.array(AIEligibilitySummarySchema),
  gapResults: z.array(AIGapSummarySchema),
  schemeSummaries: z.array(AISchemeSummarySchema),
  verifiedEvidence: z.array(AIVerifiedEvidenceSummarySchema),
  existingActions: z.array(AIExistingActionSummarySchema),
});

export const AIIntelligenceRequestSchema = z.object({
  capability: AICapabilitySchema,
  schemeId: z.string().optional(),
  language: AILanguageSchema.default("en"),
  forceRefresh: z.boolean().optional(),
});

export const AIPrioritizedGapSchema = z.object({
  gapId: z.string().min(1),
  priority: z.enum(["P1", "P2", "P3"]),
  reason: z.string().min(1),
  recommendedNextStep: z.string().min(1),
});

export const AIActionPlanItemSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  actionType: z.string().min(1),
  sourceEvidenceReference: z.string().optional(),
});

export const AIEvidenceReferenceSchema = z.object({
  evidenceId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceOrganization: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const AIIntelligenceResponseSchema = z.object({
  capability: AICapabilitySchema,
  contextVersion: z.string().min(1),
  language: AILanguageSchema,
  certainty: AICertaintyStateSchema,
  explanation: z.string().optional(),
  prioritizedGaps: z.array(AIPrioritizedGapSchema).optional(),
  actionPlan: z.array(AIActionPlanItemSchema).optional(),
  needsInformationExplanation: z.string().optional(),
  evidenceReferences: z.array(AIEvidenceReferenceSchema).default([]),
  disclaimer: z.string().min(1),
  generatedAt: z.string(),
  cacheHit: z.boolean().optional(),
});
