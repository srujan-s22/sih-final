import { z } from "zod";
import { SourceMetadataSchema } from "./scheme.schema.js";
import { EligibilityResultSchema } from "./eligibility.schema.js";

export const GapTypeSchema = z.enum([
  "MISSING_INFORMATION",
  "MISSING_DOCUMENT",
  "VERIFICATION_REQUIRED",
  "ENROLMENT_REQUIRED",
  "FACILITY_REQUIREMENT",
  "OFFICIAL_DATABASE_CHECK_REQUIRED",
  "ACTION_REQUIRED",
]);

export const GapPrioritySchema = z.enum(["REQUIRED", "IMPORTANT", "OPTIONAL"]);

export const GapSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  schemeName: z.string(),
  type: GapTypeSchema,
  priority: GapPrioritySchema,
  title: z.string(),
  description: z.string(),
  reason: z.string(),
  targetField: z.string().optional(),
  targetScope: z.enum(["HOUSEHOLD", "MEMBER"]).optional(),
  officialSource: SourceMetadataSchema.optional(),
});

export const DocumentStatusSchema = z.enum([
  "READY",
  "PARTIALLY_READY",
  "NOT_READY",
  "UNKNOWN",
]);

export const DocumentReadinessItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean(),
  description: z.string(),
  status: DocumentStatusSchema,
  issuingAuthority: z.string().optional(),
  relatedSchemeId: z.string(),
  relatedSchemeName: z.string(),
});

export const OverallDocumentReadinessSchema = z.object({
  status: DocumentStatusSchema,
  totalRequired: numberSchema(),
  readyCount: numberSchema(),
  unknownCount: numberSchema(),
  missingCount: numberSchema(),
  items: z.array(DocumentReadinessItemSchema),
});

function numberSchema() {
  return z.number().int().min(0);
}

export const GuidanceActionTypeSchema = z.enum([
  "COMPLETE_EKYC",
  "VERIFY_INFORMATION",
  "CONTACT_ASHA",
  "VISIT_ENROLMENT_CENTRE",
  "CHECK_OFFICIAL_DATABASE",
  "COMPLETE_MISSING_INFORMATION",
  "PROVIDE_DOCUMENT",
]);

export const ActionPlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: GapPrioritySchema,
  actionType: GuidanceActionTypeSchema,
  reason: z.string(),
  relatedSchemeId: z.string(),
  relatedSchemeName: z.string(),
  relatedGapId: z.string().optional(),
  stepNumber: z.number().int().min(1),
  officialSource: SourceMetadataSchema.optional(),
});

export const HouseholdGuidanceStatusSchema = z.enum([
  "COMPLETE",
  "ACTION_NEEDED",
  "MORE_INFORMATION_NEEDED",
  "NO_CURRENT_MATCH",
]);

export const GuidanceResponseSchema = z.object({
  householdStatus: HouseholdGuidanceStatusSchema,
  statusSummary: z.string(),
  evaluatedSchemesCount: z.number().int().min(0),
  eligibleSchemes: z.array(EligibilityResultSchema),
  informationNeededSchemes: z.array(EligibilityResultSchema),
  notEligibleSchemes: z.array(EligibilityResultSchema),
  gaps: z.array(GapSchema),
  documentReadiness: OverallDocumentReadinessSchema,
  actionPlan: z.array(ActionPlanItemSchema),
  evaluatedAt: z.string(),
});
