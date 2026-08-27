import { EligibilityStatus, Scheme } from "./eligibility.js";
import { Gap, GapType, GapPriority, GuidanceActionType, ActionPlanItem } from "./guidance.js";
import { SourceAuthorityType, SourceDocumentType } from "./evidence.js";

/**
 * Supported AI Capabilities in SwasthyaSetu
 */
export type AICapability =
  | "EXPLAIN_ELIGIBILITY"
  | "PRIORITIZE_GAPS"
  | "GENERATE_ACTION_PLAN"
  | "SUMMARIZE_EVIDENCE"
  | "EXPLAIN_NEEDS_INFORMATION";

/**
 * Grounded Certainty States (Policy-Certainty, NOT vague model confidence)
 */
export type AICertaintyState =
  | "GROUNDED"
  | "PARTIALLY_GROUNDED"
  | "INSUFFICIENT_INFORMATION";

/**
 * Supported Language Codes for Multilingual Readiness
 */
export type AILanguage = "en" | "hi" | "kn";

/**
 * Sanitized Household Summary for AI Context (STRICTLY NO PII)
 */
export interface AIHouseholdSummary {
  state: string;
  district: string;
  incomeCategory: string;
  memberCount: number;
}

/**
 * Sanitized Member Summary for AI Context (STRICTLY NO PII)
 */
export interface AIMemberSummary {
  memberIndex: number;
  age: number;
  gender: string;
  relationship: string;
  disabilityStatus: boolean;
  maternalStatus?: string;
  chronicConditionsCount: number;
}

/**
 * Sanitized Eligibility Result Summary for AI Context
 */
export interface AIEligibilitySummary {
  schemeId: string;
  schemeName: string;
  status: EligibilityStatus;
  pathwayCode?: string;
  benefitSummary?: string;
  matchedRuleSummaries: string[];
  failedRuleSummaries: string[];
  missingRequirements: string[];
  isVerifiedScheme: boolean;
}

/**
 * Sanitized Gap Summary for AI Context
 */
export interface AIGapSummary {
  gapId: string;
  schemeId?: string;
  schemeName?: string;
  type: GapType;
  priority: GapPriority;
  title: string;
  description: string;
  reason?: string;
}

/**
 * Sanitized Scheme Summary for AI Context
 */
export interface AISchemeSummary {
  schemeId: string;
  name: string;
  shortName: string;
  category: string;
  level: "CENTRAL" | "STATE";
  benefitSummary: string;
  isVerified: boolean;
}

/**
 * Sanitized Verified Evidence Summary for AI Context
 */
export interface AIVerifiedEvidenceSummary {
  id: string;
  schemeId: string;
  claim: string;
  officialTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
  sourceType: SourceAuthorityType;
  documentType: SourceDocumentType;
  relevantExcerpt: string;
}

/**
 * Sanitized Existing Action Plan Item for AI Context
 */
export interface AIExistingActionSummary {
  id: string;
  title: string;
  actionType: GuidanceActionType | string;
  priority: GapPriority | string;
}

/**
 * Versioned, PII-Free AI Context Payload
 */
export interface AIContext {
  contextVersion: string; // e.g. "1.0"
  generatedAt: string;
  requestPurpose: AICapability;
  language: AILanguage;
  householdSummary: AIHouseholdSummary;
  memberSummaries: AIMemberSummary[];
  eligibilityResults: AIEligibilitySummary[];
  gapResults: AIGapSummary[];
  schemeSummaries: AISchemeSummary[];
  verifiedEvidence: AIVerifiedEvidenceSummary[];
  existingActions: AIExistingActionSummary[];
}

/**
 * Request payload for AI Intelligence Generation
 */
export interface AIIntelligenceRequest {
  capability: AICapability;
  schemeId?: string;
  language?: AILanguage;
  forceRefresh?: boolean;
}

/**
 * Prioritized Gap output item
 */
export interface AIPrioritizedGap {
  gapId: string;
  priority: "P1" | "P2" | "P3";
  reason: string;
  recommendedNextStep: string;
}

/**
 * Action Plan output item
 */
export interface AIActionPlanItem {
  stepNumber: number;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  actionType: string;
  sourceEvidenceReference?: string;
}

/**
 * Citation reference to verified source
 */
export interface AIEvidenceReference {
  evidenceId: string;
  sourceTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
}

/**
 * Structured AI Intelligence Response Envelope
 */
export interface AIIntelligenceResponse {
  capability: AICapability;
  contextVersion: string;
  language: AILanguage;
  certainty: AICertaintyState;
  explanation?: string;
  prioritizedGaps?: AIPrioritizedGap[];
  actionPlan?: AIActionPlanItem[];
  needsInformationExplanation?: string;
  evidenceReferences: AIEvidenceReference[];
  disclaimer: string;
  generatedAt: string;
  cacheHit?: boolean;
}

/**
 * Firestore Cache Entity stored at /ai_intelligence_cache/{contextHash}
 */
export interface AIIntelligenceCacheRecord {
  contextHash: string;
  capability: AICapability;
  contextVersion: string;
  language: AILanguage;
  response: AIIntelligenceResponse;
  createdAt: string;
  expiresAt: string;
}
