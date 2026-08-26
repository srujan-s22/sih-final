export interface Member {
    id: string;
    householdId: string;
    fullName: string;
    age: number;
    gender: "male" | "female" | "other";
    relationship: string;
    disabilityStatus: boolean;
    chronicConditions: string[];
    createdAt: string;
    updatedAt: string;
}
export interface Household {
    id: string;
    headOfHouseholdName: string;
    rationCardNumber: string;
    incomeCategory: "BPL" | "AAY" | "APL" | "OTHER";
    state: string;
    district: string;
    village: string;
    pincode: string;
    members?: Member[];
    createdAt: string;
    updatedAt: string;
}
