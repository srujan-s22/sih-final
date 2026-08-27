import { z } from "zod";

export const SchemeCategorySchema = z.enum([
  "NATIONAL",
  "STATE",
  "MATERNAL",
  "CHILD",
  "SENIOR_CITIZEN",
  "DISABILITY",
  "OTHER",
]);

export const SchemeLevelSchema = z.enum(["CENTRAL", "STATE"]);

export const SchemeStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);

export const VersionStatusSchema = z.enum(["DRAFT", "ACTIVE", "DEPRECATED", "ARCHIVED"]);

export const RuleOperatorSchema = z.enum([
  "FIELD_EQUALS",
  "FIELD_NOT_EQUALS",
  "FIELD_IN",
  "FIELD_NOT_IN",
  "NUMBER_GREATER_THAN",
  "NUMBER_GREATER_THAN_OR_EQUAL",
  "NUMBER_LESS_THAN",
  "NUMBER_LESS_THAN_OR_EQUAL",
  "MEMBER_EXISTS",
  "MEMBER_COUNT",
  "MEMBER_FIELD_EQUALS",
  "MEMBER_FIELD_IN",
]);

export const TargetScopeSchema = z.enum(["HOUSEHOLD", "MEMBER"]);

export const RuleExplanationSchema = z.object({
  matched: z.string().min(1),
  failed: z.string().min(1),
  missing: z.string().min(1),
});

export const RequiredDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1),
  issuingAuthority: z.string().optional(),
});

export const SchemeActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  actionType: z.enum([
    "PROVIDE_INFORMATION",
    "DOCUMENT_VERIFICATION",
    "VISIT_CENTER",
    "CONTACT_ASHA",
    "APPLY_ONLINE",
    "OTHER",
  ]),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export const SourceMetadataSchema = z.object({
  sourceOrganization: z.string().min(1).default("Official Source"),
  officialTitle: z.string().min(1).default("Official Scheme Guidelines"),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  verifiedAt: z.string(),
  effectiveDate: z.string().optional(),
  isVerified: z.boolean(),
  verificationNotes: z.string().optional(),
  sourceCitation: z.string().optional(),
  sourceName: z.string().optional(),
  notes: z.string().optional(),
});

export const RuleDefinitionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    scope: TargetScopeSchema,
    field: z.string().min(1),
    operator: RuleOperatorSchema,
    value: z.unknown(),
    requiredField: z.boolean(),
    explanations: RuleExplanationSchema,
    subRule: RuleDefinitionSchema.optional(),
    isVerifiedRule: z.boolean().optional(),
    sourceEvidence: z.string().optional(),
    pathwayCode: z.string().optional(),
  })
);

export const RuleSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  combination: z.enum(["ALL", "ANY"]),
  rules: z.array(RuleDefinitionSchema),
});

export const CreateSchemeVersionSchema = z.object({
  schemeId: z.string().min(1),
  version: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
  status: VersionStatusSchema.default("ACTIVE"),
  ruleSet: RuleSetSchema,
  requiredDocuments: z.array(RequiredDocumentSchema).default([]),
  actions: z.array(SchemeActionSchema).default([]),
  sourceMetadata: SourceMetadataSchema,
});

export const CreateSchemeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
  name: z.string().min(2),
  shortName: z.string().min(1),
  description: z.string().min(5),
  category: SchemeCategorySchema,
  level: SchemeLevelSchema,
  status: SchemeStatusSchema.default("ACTIVE"),
  authority: z.string().min(2),
  state: z.string().optional(),
  benefitSummary: z.string().min(5),
  benefitDetails: z.array(z.string()).optional(),
  eligibilitySummary: z.string().min(5),
  requiredDocuments: z.array(RequiredDocumentSchema).default([]),
  actions: z.array(SchemeActionSchema).default([]),
  currentVersion: z.string().min(1),
  sourceMetadata: SourceMetadataSchema,
});
