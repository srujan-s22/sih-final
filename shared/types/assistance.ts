export type AssistanceCategory =
  | "SCHEME_ENROLLMENT"
  | "FACILITY_ACCESS"
  | "DOCUMENT_HELP"
  | "ELIGIBILITY_CLARIFICATION"
  | "FOLLOW_UP"
  | "OTHER";

export type AssistanceStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

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
  message: string;
  status: AssistanceStatus;
  responseNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssistanceRequestInput {
  category: AssistanceCategory;
  schemeId?: string;
  schemeName?: string;
  message: string;
}

export interface UpdateAssistanceRequestInput {
  status: AssistanceStatus;
  responseNote?: string;
}
