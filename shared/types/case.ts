import { UserRole } from "./auth.js";
import { Household, Member, IncomeCategory, Gender, CreateHouseholdInput } from "./household.js";
import { EligibilityResult } from "./eligibility.js";
import { GuidanceResponse } from "./guidance.js";

export interface FieldRegistrationInput extends Omit<CreateHouseholdInput, "rationCardNumber"> {
  rationCardNumber?: string;
  headAge?: number;
  headGender?: Gender;
}

export type CaseStatus =
  | "NEW"
  | "ACTIVE"
  | "NEEDS_ATTENTION"
  | "FOLLOW_UP"
  | "RESOLVED"
  | "CLOSED";

export type CasePriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

export type CaseActivityType =
  | "CASE_CREATED"
  | "CASE_ASSIGNED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "NOTE_ADDED"
  | "FOLLOWUP_SCHEDULED"
  | "FOLLOWUP_COMPLETED"
  | "CONTACT_RECORDED";

export interface AshaCase {
  id: string;
  householdId: string;
  assignedAshaUid: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  incomeCategory: IncomeCategory;
  memberCount: number;
  status: CaseStatus;
  priority: CasePriority;
  detectedGapsCount: number;
  eligibleSchemesCount: number;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorUid: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CaseFollowUp {
  id: string;
  caseId: string;
  scheduledAt: string;
  reason: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseActivity {
  id: string;
  caseId: string;
  actorUid: string;
  actorRole: UserRole;
  actorName: string;
  type: CaseActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface CaseDetailResponse {
  case: AshaCase;
  household: Household;
  members: Member[];
  eligibilityResults: EligibilityResult[];
  guidance: GuidanceResponse;
  notes: CaseNote[];
  followUps: CaseFollowUp[];
  activities: CaseActivity[];
}

export interface CaseSummaryResponse {
  totalAssigned: number;
  needsAttentionCount: number;
  urgentCount: number;
  upcomingFollowUpsCount: number;
  resolvedCount: number;
}
