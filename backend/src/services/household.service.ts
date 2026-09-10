import {
  Household,
  Member,
  CreateHouseholdInput,
  UpdateHouseholdInput,
  CreateMemberInput,
  UpdateMemberInput,
} from "../../../shared/types/household.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { HTTP_STATUS } from "../config/constants.js";

export class HouseholdServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "HouseholdServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class HouseholdService {
  private householdRepo: HouseholdRepository;

  constructor(householdRepo: HouseholdRepository) {
    this.householdRepo = householdRepo;
  }

  /**
   * Atomically creates the authenticated citizen's household and initial member(s).
   * STRICT SECURITY RULE: ownerUid is extracted exclusively from verified token context.
   * STRICT 1:1 INVARIANT: Rejects with 409 Conflict if a household already exists for this citizen account.
   */
  public async createHousehold(
    ownerUid: string,
    input: CreateHouseholdInput
  ): Promise<{ household: Household; members: Member[]; isNew: boolean }> {
    const existing = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (existing) {
      throw new HouseholdServiceError(
        "A household profile is already registered for this citizen account. Duplicate household creation is not allowed.",
        HTTP_STATUS.CONFLICT,
        "HOUSEHOLD_ALREADY_EXISTS"
      );
    }

    const now = new Date().toISOString();
    const householdId = `hh_${ownerUid}`;

    const newHousehold: Household = {
      id: householdId,
      ownerUid, // Server-enforced ownership derived from authentic token UID
      headOfHouseholdName: input.headOfHouseholdName.trim(),
      rationCardNumber: input.rationCardNumber.trim(),
      incomeCategory: input.incomeCategory,
      state: input.state.trim(),
      district: input.district.trim(),
      village: input.village.trim(),
      pincode: input.pincode.trim(),
      ...(input.contactPhone ? { contactPhone: input.contactPhone.trim() } : {}),
      members: [],
      createdAt: now,
      updatedAt: now,
    };

    // Stage initial members for atomic batch write
    const initialMembers: Member[] = [];

    if (input.initialMembers && input.initialMembers.length > 0) {
      for (let i = 0; i < input.initialMembers.length; i++) {
        const m = input.initialMembers[i];
        initialMembers.push({
          id: `mem_${ownerUid}_${i + 1}`,
          householdId,
          fullName: m.fullName.trim(),
          age: m.age,
          gender: m.gender,
          relationship: m.relationship.trim(),
          disabilityStatus: Boolean(m.disabilityStatus),
          chronicConditions: Array.isArray(m.chronicConditions) ? m.chronicConditions : [],
          maternalStatus: m.maternalStatus || "none",
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (input.headAge !== undefined && input.headGender !== undefined) {
      // Automatic Head-of-Household member creation during atomic onboarding
      initialMembers.push({
        id: `mem_${ownerUid}_head`,
        householdId,
        fullName: input.headOfHouseholdName.trim(),
        age: input.headAge,
        gender: input.headGender,
        relationship: "Head",
        disabilityStatus: false,
        chronicConditions: [],
        maternalStatus: "none",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Atomic transaction / batch write
    const result = await this.householdRepo.createHouseholdWithMembers(
      newHousehold,
      initialMembers
    );

    return {
      household: result.household,
      members: result.members,
      isNew: true,
    };
  }

  /**
   * Idempotently gets or creates the authenticated citizen's household.
   * Deprecated for external onboarding: use createHousehold() to enforce 1:1 invariant.
   */
  public async getOrCreateHousehold(
    ownerUid: string,
    input: CreateHouseholdInput
  ): Promise<{ household: Household; members: Member[]; isNew: boolean }> {
    const existing = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);
    if (existing) {
      const members = await this.householdRepo.getMembers(existing.id);
      return {
        household: { ...existing, members },
        members,
        isNew: false,
      };
    }

    return this.createHousehold(ownerUid, input);
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
