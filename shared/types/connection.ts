import { IncomeCategory } from "./household.js";

export type ConnectionRequestStatus = "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";

export interface AshaPublicDirectoryInfo {
  serviceCode: string;
  displayName: string;
  serviceArea?: string | null;
  state?: string | null;
  district?: string | null;
}

export interface AshaConnectionRequest {
  id: string;
  householdId: string;
  citizenUid: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  incomeCategory: IncomeCategory;
  memberCount: number;
  ashaUid: string;
  ashaServiceCode: string;
  ashaName: string;
  status: ConnectionRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitizenConnectionStatusResponse {
  status: "NONE" | "PENDING" | "ACTIVE" | "REJECTED";
  connection?: AshaConnectionRequest;
  asha?: AshaPublicDirectoryInfo;
}

export interface AshaConnectionActionInput {
  note?: string;
}
