import { z } from "zod";
import {
  SchemeCategorySchema,
  SchemeLevelSchema,
  RuleOperatorSchema,
  TargetScopeSchema,
  RequiredDocumentSchema,
  SchemeActionSchema,
} from "./scheme.schema.js";

export const EligibilityStatusSchema = z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "NEEDS_INFORMATION"]);

export const RuleEvaluationDetailSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  scope: TargetScopeSchema,
  field: z.string(),
  operator: RuleOperatorSchema,
  status: z.enum(["MATCHED", "FAILED", "MISSING"]),
  explanation: z.string(),
  isVerifiedRule: z.boolean().optional(),
  sourceEvidence: z.string().optional(),
  pathwayCode: z.string().optional(),
});

export const MissingRequirementDetailSchema = z.object({
  field: z.string(),
  scope: TargetScopeSchema,
  description: z.string(),
  actionPrompt: z.string(),
});

export const EligibilityResultSchema = z.object({
  schemeId: z.string(),
  schemeName: z.string(),
  schemeShortName: z.string(),
  schemeVersion: z.string(),
  category: SchemeCategorySchema,
  level: SchemeLevelSchema,
  benefitSummary: z.string(),
  status: EligibilityStatusSchema,
  pathwayCode: z.string().optional(),
  isVerifiedScheme: z.boolean(),
  matchedRules: z.array(RuleEvaluationDetailSchema),
  failedRules: z.array(RuleEvaluationDetailSchema),
  missingRequirements: z.array(MissingRequirementDetailSchema),
  requiredDocuments: z.array(RequiredDocumentSchema),
  nextActions: z.array(SchemeActionSchema),
  evaluatedAt: z.string(),
});
