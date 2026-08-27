import {
  EligibilityResult,
  RequiredDocument,
  SourceMetadata,
} from "./eligibility.js";

/**
 * Types of Gaps preventing immediate healthcare access or entitlement progression
 */
export type GapType =
  | "MISSING_INFORMATION"
  | "MISSING_DOCUMENT"
  | "VERIFICATION_REQUIRED"
  | "ENROLMENT_REQUIRED"
  | "FACILITY_REQUIREMENT"
  | "OFFICIAL_DATABASE_CHECK_REQUIRED"
  | "ACTION_REQUIRED";

/**
 * Gap Priority levels for deterministic resolution ordering
 */
export type GapPriority = "REQUIRED" | "IMPORTANT" | "OPTIONAL";

/**
 * Deterministic Gap representation
 */
export interface Gap {
  id: string;
  schemeId: string;
  schemeName: string;
  type: GapType;
  priority: GapPriority;
  title: string;
  description: string;
  reason: string;
  targetField?: string;
  targetScope?: "HOUSEHOLD" | "MEMBER";
  officialSource?: SourceMetadata;
}

/**
 * Status of individual document readiness
 */
export type DocumentStatus = "READY" | "PARTIALLY_READY" | "NOT_READY" | "UNKNOWN";

/**
 * Individual document requirement readiness item
 */
export interface DocumentReadinessItem {
  id: string;
  name: string;
  required: boolean;
  description: string;
  status: DocumentStatus;
  issuingAuthority?: string;
  relatedSchemeId: string;
  relatedSchemeName: string;
}

/**
 * Overall document readiness state for the household
 */
export interface OverallDocumentReadiness {
  status: DocumentStatus;
  totalRequired: number;
  readyCount: number;
  unknownCount: number;
  missingCount: number;
  items: DocumentReadinessItem[];
}

/**
 * Action Types supported by verified government workflows
 */
export type GuidanceActionType =
  | "COMPLETE_EKYC"
  | "VERIFY_INFORMATION"
  | "CONTACT_ASHA"
  | "VISIT_ENROLMENT_CENTRE"
  | "CHECK_OFFICIAL_DATABASE"
  | "COMPLETE_MISSING_INFORMATION"
  | "PROVIDE_DOCUMENT";

/**
 * Structured, deterministic Action Plan Item
 */
export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  priority: GapPriority;
  actionType: GuidanceActionType;
  reason: string;
  relatedSchemeId: string;
  relatedSchemeName: string;
  relatedGapId?: string;
  stepNumber: number;
  officialSource?: SourceMetadata;
}

/**
 * High-level citizen household guidance status
 */
export type HouseholdGuidanceStatus =
  | "COMPLETE"
  | "ACTION_NEEDED"
  | "MORE_INFORMATION_NEEDED"
  | "NO_CURRENT_MATCH";

/**
 * Unified Citizen Healthcare Guidance Response
 */
export interface GuidanceResponse {
  householdStatus: HouseholdGuidanceStatus;
  statusSummary: string;
  evaluatedSchemesCount: number;
  eligibleSchemes: EligibilityResult[];
  informationNeededSchemes: EligibilityResult[];
  notEligibleSchemes: EligibilityResult[];
  gaps: Gap[];
  documentReadiness: OverallDocumentReadiness;
  actionPlan: ActionPlanItem[];
  evaluatedAt: string;
}
