/**
 * Canonical Scheme Categories
 */
export type SchemeCategory =
  | "NATIONAL"
  | "STATE"
  | "MATERNAL"
  | "CHILD"
  | "SENIOR_CITIZEN"
  | "DISABILITY"
  | "OTHER";

/**
 * Scheme Administrative Governance Level
 */
export type SchemeLevel = "CENTRAL" | "STATE";

/**
 * Lifecycle Status of a Healthcare Scheme
 */
export type SchemeStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

/**
 * Lifecycle Status of a Scheme Version
 */
export type VersionStatus = "DRAFT" | "ACTIVE" | "DEPRECATED" | "ARCHIVED";

/**
 * Supported Rule Operators for Deterministic Evaluation
 */
export type RuleOperator =
  | "FIELD_EQUALS"
  | "FIELD_NOT_EQUALS"
  | "FIELD_IN"
  | "FIELD_NOT_IN"
  | "NUMBER_GREATER_THAN"
  | "NUMBER_GREATER_THAN_OR_EQUAL"
  | "NUMBER_LESS_THAN"
  | "NUMBER_LESS_THAN_OR_EQUAL"
  | "MEMBER_EXISTS"
  | "MEMBER_COUNT"
  | "MEMBER_FIELD_EQUALS"
  | "MEMBER_FIELD_IN";

/**
 * Evaluation Target Scope
 */
export type TargetScope = "HOUSEHOLD" | "MEMBER";

/**
 * Human-Readable Rule Explanations
 */
export interface RuleExplanation {
  matched: string;
  failed: string;
  missing: string;
}

/**
 * Deterministic Rule Definition with Authoritative Rule-Level Evidence
 */
export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  scope: TargetScope;
  field: string;
  operator: RuleOperator;
  value: unknown;
  requiredField: boolean;
  explanations: RuleExplanation;
  subRule?: RuleDefinition; // Used for member sub-criteria in MEMBER_EXISTS / MEMBER_COUNT
  isVerifiedRule?: boolean; // Rule-level authoritative verification flag
  sourceEvidence?: string; // Specific section / policy document proving this rule
  pathwayCode?: string; // Optional benefit pathway identifier (e.g. "PM-JAY-SENIOR-CITIZEN-70PLUS")
}

/**
 * Composite Rule Set with Boolean Logic
 */
export interface RuleSet {
  id: string;
  name: string;
  combination: "ALL" | "ANY";
  rules: RuleDefinition[];
}

/**
 * Document Requirement Metadata
 */
export interface RequiredDocument {
  id: string;
  name: string;
  required: boolean;
  description: string;
  issuingAuthority?: string;
}

/**
 * Prioritized Actionable Next Step
 */
export type ActionType =
  | "PROVIDE_INFORMATION"
  | "DOCUMENT_VERIFICATION"
  | "VISIT_CENTER"
  | "CONTACT_ASHA"
  | "APPLY_ONLINE"
  | "OTHER";

export type ActionPriority = "HIGH" | "MEDIUM" | "LOW";

export interface SchemeAction {
  id: string;
  title: string;
  description: string;
  actionType: ActionType;
  priority: ActionPriority;
}

/**
 * Authoritative Source Metadata
 */
export interface SourceMetadata {
  sourceOrganization: string;
  officialTitle: string;
  sourceUrl?: string;
  verifiedAt: string;
  effectiveDate?: string;
  isVerified: boolean;
  verificationNotes?: string;
  sourceCitation?: string;
  // Backward compatibility aliases
  sourceName?: string;
  notes?: string;
}

/**
 * Versioned Scheme Definition
 */
export interface SchemeVersion {
  id: string;
  schemeId: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: VersionStatus;
  ruleSet: RuleSet;
  requiredDocuments: RequiredDocument[];
  actions: SchemeAction[];
  sourceMetadata: SourceMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * Top-Level Healthcare Scheme Entity
 */
export interface Scheme {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: SchemeCategory;
  level: SchemeLevel;
  status: SchemeStatus;
  authority: string;
  state?: string;
  benefitSummary: string;
  benefitDetails?: string[];
  eligibilitySummary: string;
  requiredDocuments: RequiredDocument[];
  actions: SchemeAction[];
  currentVersion: string;
  activeVersion?: SchemeVersion;
  sourceMetadata: SourceMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed Evaluation Status
 */
export type EligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_INFORMATION";

/**
 * Single Rule Evaluation Result Detail
 */
export interface RuleEvaluationDetail {
  ruleId: string;
  ruleName: string;
  scope: TargetScope;
  field: string;
  operator: RuleOperator;
  status: "MATCHED" | "FAILED" | "MISSING";
  explanation: string;
  isVerifiedRule?: boolean;
  sourceEvidence?: string;
  pathwayCode?: string;
}

/**
 * Missing Information Field Detail
 */
export interface MissingRequirementDetail {
  field: string;
  scope: TargetScope;
  description: string;
  actionPrompt: string;
}

/**
 * Standardized Eligibility Evaluation Result
 */
export interface EligibilityResult {
  schemeId: string;
  schemeName: string;
  schemeShortName: string;
  schemeVersion: string;
  category: SchemeCategory;
  level: SchemeLevel;
  benefitSummary: string;
  status: EligibilityStatus;
  pathwayCode?: string;
  isVerifiedScheme: boolean;
  matchedRules: RuleEvaluationDetail[];
  failedRules: RuleEvaluationDetail[];
  missingRequirements: MissingRequirementDetail[];
  requiredDocuments: RequiredDocument[];
  nextActions: SchemeAction[];
  evaluatedAt: string;
}
