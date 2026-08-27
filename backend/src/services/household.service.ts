import {
  Household,
  Member,
  CreateHouseholdInput,
  UpdateHouseholdInput,
  CreateMemberInput,
  UpdateMemberInput,
} from "../../../shared/types/household.js";
import { HouseholdRepository } from "../repositories/household.repository.js";

export class HouseholdService {
  private householdRepo: HouseholdRepository;

  constructor(householdRepo: HouseholdRepository) {
    this.householdRepo = householdRepo;
  }

  /**
   * Idempotently gets or creates the authenticated citizen's household.
   * STRICT SECURITY RULE: ownerUid is extracted exclusively from verified token context.
   */
  public async getOrCreateHousehold(
    ownerUid: string,
    input: CreateHouseholdInput
  ): Promise<{ household: Household; isNew: boolean }> {
    const existing = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (existing) {
      const members = await this.householdRepo.getMembers(existing.id);
      return {
        household: { ...existing, members },
        isNew: false,
      };
    }

    const now = new Date().toISOString();
    const householdId = `hh_${ownerUid}`;

    const newHousehold: Household = {
      id: householdId,
      ownerUid, // Server-enforced ownership
      headOfHouseholdName: input.headOfHouseholdName,
      rationCardNumber: input.rationCardNumber,
      incomeCategory: input.incomeCategory,
      state: input.state,
      district: input.district,
      village: input.village,
      pincode: input.pincode,
      ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
      members: [],
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.householdRepo.createHousehold(newHousehold);
    return {
      household: created,
      isNew: true,
    };
  }

  /**
   * Retrieves the authenticated citizen's household and all family members
   */
  public async getHouseholdByOwner(
    ownerUid: string
  ): Promise<{ household: Household; members: Member[] } | null> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!household) {
      return null;
    }

    const members = await this.householdRepo.getMembers(household.id);
    return {
      household: { ...household, members },
      members,
    };
  }

  /**
   * Updates household demographic / location details
   * STRICT SECURITY RULE: ownerUid and document ID can never be mutated
   */
  public async updateHousehold(
    ownerUid: string,
    input: UpdateHouseholdInput
  ): Promise<Household> {
    const existing = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!existing) {
      throw new Error("Household not found.");
    }

    const safeUpdates: Partial<Household> = {
      ...(input.headOfHouseholdName && { headOfHouseholdName: input.headOfHouseholdName }),
      ...(input.rationCardNumber && { rationCardNumber: input.rationCardNumber }),
      ...(input.incomeCategory && { incomeCategory: input.incomeCategory }),
      ...(input.state && { state: input.state }),
      ...(input.district && { district: input.district }),
      ...(input.village && { village: input.village }),
      ...(input.pincode && { pincode: input.pincode }),
      ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone || undefined }),
    };

    const updated = await this.householdRepo.updateHousehold(existing.id, safeUpdates);
    if (!updated) {
      throw new Error("Failed to update household.");
    }

    const members = await this.householdRepo.getMembers(existing.id);
    return { ...updated, members };
  }

  /**
   * Adds a new member to the authenticated citizen's household
   */
  public async addMember(
    ownerUid: string,
    input: CreateMemberInput
  ): Promise<Member> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!household) {
      throw new Error("Household not found. Please create your household before adding members.");
    }

    const now = new Date().toISOString();
    const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newMember: Member = {
      id: memberId,
      householdId: household.id,
      fullName: input.fullName,
      age: input.age,
      gender: input.gender,
      relationship: input.relationship,
      disabilityStatus: Boolean(input.disabilityStatus),
      chronicConditions: Array.isArray(input.chronicConditions) ? input.chronicConditions : [],
      ...(input.maternalStatus && { maternalStatus: input.maternalStatus }),
      createdAt: now,
      updatedAt: now,
    };

    return await this.householdRepo.createMember(household.id, newMember);
  }

  /**
   * Retrieves all members of the authenticated citizen's household
   */
  public async getMembers(ownerUid: string): Promise<Member[]> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!household) {
      throw new Error("Household not found.");
    }
    return await this.householdRepo.getMembers(household.id);
  }

  /**
   * Updates an existing household member
   */
  public async updateMember(
    ownerUid: string,
    memberId: string,
    input: UpdateMemberInput
  ): Promise<Member> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!household) {
      throw new Error("Household not found.");
    }

    const existingMember = await this.householdRepo.getMemberById(household.id, memberId);
    if (!existingMember) {
      throw new Error("Household member not found.");
    }

    const safeUpdates: Partial<Member> = {
      ...(input.fullName && { fullName: input.fullName }),
      ...(input.age !== undefined && { age: input.age }),
      ...(input.gender && { gender: input.gender }),
      ...(input.relationship && { relationship: input.relationship }),
      ...(input.disabilityStatus !== undefined && { disabilityStatus: input.disabilityStatus }),
      ...(input.chronicConditions !== undefined && { chronicConditions: input.chronicConditions }),
      ...(input.maternalStatus !== undefined && { maternalStatus: input.maternalStatus }),
    };

    const updated = await this.householdRepo.updateMember(household.id, memberId, safeUpdates);
    if (!updated) {
      throw new Error("Failed to update household member.");
    }
    return updated;
  }

  /**
   * Removes a member from the authenticated citizen's household
   */
  public async deleteMember(
    ownerUid: string,
    memberId: string
  ): Promise<boolean> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (!household) {
      throw new Error("Household not found.");
    }

    const existingMember = await this.householdRepo.getMemberById(household.id, memberId);
    if (!existingMember) {
      throw new Error("Household member not found.");
    }

    return await this.householdRepo.deleteMember(household.id, memberId);
  }
}
