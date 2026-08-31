import { UserRole } from "./auth.js";
import { Household, Member, IncomeCategory, Gender, CreateHouseholdInput } from "./household.js";
import { EligibilityResult } from "./eligibility.js";
import { GuidanceResponse } from "./guidance.js";
import { AshaAssistanceRequest } from "./assistance.js";

export interface FieldRegistrationInput extends Omit<CreateHouseholdInput, "rationCardNumber"> {
  rationCardNumber?: string;
  headAge?: number;
  headGender?: Gender;
}

export type CaseStatus =
  | "NEW"
  | "ACTIVE"
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "NEEDS_ATTENTION"
  | "FOLLOW_UP"
  | "FOLLOW_UP_REQUIRED"
  | "BLOCKED"
  | "ESCALATED"
  | "RESOLVED"
  | "CITIZEN_DECLINED"
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
  | "FOLLOWUP_RESCHEDULED"
  | "FOLLOWUP_CANCELLED"
  | "CONTACT_RECORDED"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_STATUS_CHANGED"
  | "ASSISTANCE_REQUESTED"
  | "REQUEST_ACCEPTED"
  | "REQUEST_DECLINED"
  | "CASE_SCHEME_INITIATED"
  | "CASE_ESCALATED"
  | "CASE_RESOLVED"
  | "AUTOMATION_DISPATCHED"
  | "AUTOMATION_FAILED";

export type CaseTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "BLOCKED";

export interface CaseTask {
  id: string;
  caseId: string;
  schemeId?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  type: string;
  title: string;
  description: string;
  status: CaseTaskStatus;
  order: number;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchemeJourneyStep {
  stepId: string;
  title: string;
  description: string;
  status: "PENDING" | "CURRENT" | "COMPLETED" | "BLOCKED";
  completedAt?: string | null;
}

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
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  assistanceRequestId?: string | null;
  currentJourneyStep?: string | null;
  journeySteps?: SchemeJourneyStep[];
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
  householdId?: string;
  headOfHouseholdName?: string;
  assignedAshaUid?: string;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  title?: string;
  reason: string;
  dueAt: string;
  scheduledAt: string; // for backward compatibility
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  isOverdue?: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  outcome?: string | null;
  notes?: string | null;
  rescheduledAt?: string | null;
  rescheduleReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  sourceTaskId?: string | null;
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
  tasks: CaseTask[];
  journeySteps: SchemeJourneyStep[];
  notes: CaseNote[];
  followUps: CaseFollowUp[];
  activities: CaseActivity[];
  assistanceRequests?: AshaAssistanceRequest[];
}

export interface CaseSummaryResponse {
  totalAssigned: number;
  needsAttentionCount: number;
  urgentCount: number;
  upcomingFollowUpsCount: number;
  resolvedCount: number;
}

export interface FollowUpSummaryResponse {
  total: number;
  dueToday: number;
  upcoming: number;
  overdue: number;
  completed: number;
  cancelled?: number;
  followUps: CaseFollowUp[];
}

export interface AutomationHealthResponse {
  webhookConfigured: boolean;
  webhookUrl: string | null;
  status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED";
  totalFollowUps: number;
  activeFollowUps: number;
  overdueFollowUps: number;
  completedFollowUps: number;
  cancelledFollowUps: number;
  recentEvents: AutomationDomainEvent[];
}

export interface InboundAutomationWebhookInput {
  eventId: string;
  eventType: DomainEventType | string;
  followUpId?: string;
  caseId?: string;
  householdId?: string;
  action?: "REMINDER_SENT" | "STATUS_CHECK" | "ESCALATE";
  notes?: string;
  timestamp?: string;
}

export type DomainEventType =
  | "CASE_CREATED"
  | "CASE_ASSIGNED"
  | "TASK_COMPLETED"
  | "FOLLOWUP_CREATED"
  | "FOLLOWUP_COMPLETED"
  | "FOLLOWUP_OVERDUE"
  | "FOLLOWUP_RESCHEDULED"
  | "FOLLOWUP_CANCELLED"
  | "REMINDER_SENT"
  | "AUTOMATION_TRIGGERED"
  | "AUTOMATION_FAILED"
  | "CASE_SCHEME_INITIATED"
  | "CASE_RESOLVED";

export interface AutomationDomainEvent {
  eventId: string;
  eventType: DomainEventType;
  timestamp: string;
  caseId: string;
  householdId: string;
  assignedAshaUid: string;
  schemeId?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  payload: Record<string, unknown>;
}

export type AshaAttentionCategory =
  | "OVERDUE_FOLLOWUP"
  | "BLOCKED_TASK"
  | "PREGNANCY_CARE"
  | "SENIOR_CITIZEN_PMJAY"
  | "MISSING_DOCUMENTS"
  | "UPCOMING_FOLLOWUP";

export type AshaAttentionActionType =
  | "INITIATE_SCHEME"
  | "COMPLETE_FOLLOWUP"
  | "UNBLOCK_TASK"
  | "REVIEW_CASE";

export type AshaAttentionPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface AshaAttentionSignal {
  id: string;
  householdId: string;
  caseId: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  priority: AshaAttentionPriority;
  category: AshaAttentionCategory;
  title: string;
  subtitle: string;
  beneficiaryName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryAge?: number | null;
  beneficiaryRelationship?: string | null;
  schemeId?: string | null;
  schemeName?: string | null;
  recommendedAction: string;
  actionType: AshaAttentionActionType;
}

export interface AshaAttentionSignalsResponse {
  summary: {
    totalAssignedHouseholds: number;
    needsAttentionCount: number;
    activeSchemeJourneys: number;
    overdueFollowUps: number;
  };
  signals: AshaAttentionSignal[];
}

export interface InitiateSchemeAssistanceInput {
  schemeId: string;
  beneficiaryMemberId?: string | null;
  priority?: CasePriority;
  notes?: string | null;
}

export interface InitiateSchemeAssistanceResponse {
  case: AshaCase;
  tasks: CaseTask[];
  journeySteps: SchemeJourneyStep[];
}

