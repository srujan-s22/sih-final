export type IncomeCategory = "BPL" | "AAY" | "APL" | "OTHER";
export type Gender = "male" | "female" | "other";
export type MaternalStatus = "none" | "pregnant" | "lactating";

export interface Member {
  id: string;
  householdId: string;
  fullName: string;
  age: number;
  gender: Gender;
  relationship: string;
  disabilityStatus: boolean;
  chronicConditions: string[];
  maternalStatus?: MaternalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  id: string;
  ownerUid: string;
  headOfHouseholdName: string;
  rationCardNumber: string;
  incomeCategory: IncomeCategory;
  state: string;
  district: string;
  village: string;
  pincode: string;
  contactPhone?: string;
  members?: Member[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateHouseholdInput {
  headOfHouseholdName: string;
  rationCardNumber: string;
  incomeCategory: IncomeCategory;
  state: string;
  district: string;
  village: string;
  pincode: string;
  contactPhone?: string;
}

export type UpdateHouseholdInput = Partial<CreateHouseholdInput>;

export interface CreateMemberInput {
  fullName: string;
  age: number;
  gender: Gender;
  relationship: string;
  disabilityStatus?: boolean;
  chronicConditions?: string[];
  maternalStatus?: MaternalStatus;
}

export type UpdateMemberInput = Partial<CreateMemberInput>;

export interface HouseholdResponse {
  household: Household;
  members: Member[];
}

export interface MemberResponse {
  member: Member;
}
