export type AssistanceCategory =
  | "SCHEME_ENROLLMENT"
  | "FACILITY_ACCESS"
  | "DOCUMENT_HELP"
  | "ELIGIBILITY_CLARIFICATION"
  | "FOLLOW_UP"
  | "OTHER";

export type AssistanceStatus =
  | "PENDING"
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "FOLLOW_UP_REQUIRED"
  | "BLOCKED"
  | "ESCALATED"
  | "RESOLVED"
  | "DECLINED"
  | "CLOSED";

export type AssistancePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface AshaAssistanceRequest {
  id: string;
  householdId: string;
  citizenUid: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  ashaUid: string;
  ashaServiceCode: string;
  ashaName: string;
  category: AssistanceCategory;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  beneficiaryAge?: number | null;
  beneficiaryRelationship?: string | null;
  message: string;
  priority: AssistancePriority;
  status: AssistanceStatus;
  initiatedBy?: "CITIZEN" | "ASHA";
  responseNote?: string | null;
  declineReason?: string | null;
  caseId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssistanceRequestInput {
  category: AssistanceCategory;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  message: string;
  priority?: AssistancePriority;
}

export interface UpdateAssistanceRequestInput {
  status: AssistanceStatus;
  responseNote?: string | null;
  declineReason?: string | null;
}

