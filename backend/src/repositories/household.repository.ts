import { Firestore } from "firebase-admin/firestore";
import { Household, Member } from "../../../shared/types/household.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class HouseholdRepository extends BaseFirestoreRepository<Household> {
  // In-memory store fallback ONLY for isolated automated unit tests
  private memoryHouseholds = new Map<string, Household>();
  private memoryMembers = new Map<string, Map<string, Member>>(); // householdId -> (memberId -> Member)

  constructor(firestore: Firestore | null = null) {
    super("households", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test";
  }

  /**
   * Retrieves a household document by its owner UID
   */
  public async getHouseholdByOwnerUid(ownerUid: string): Promise<Household | null> {
    if (this.isUnitTestMode()) {
      for (const hh of this.memoryHouseholds.values()) {
        if (hh.ownerUid === ownerUid) {
          return { ...hh };
        }
      }
      return null;
    }

    const querySnapshot = await this.getCollection()
      .where("ownerUid", "==", ownerUid)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<Household, "id">) };
  }

  /**
   * Retrieves a household by its primary document ID
   */
  public async getHouseholdById(id: string): Promise<Household | null> {
    if (this.isUnitTestMode()) {
      const hh = this.memoryHouseholds.get(id);
      return hh ? { ...hh } : null;
    }

    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Omit<Household, "id">) };
  }

  /**
   * Creates a new household document
   */
  public async createHousehold(household: Household): Promise<Household> {
    if (this.isUnitTestMode()) {
      this.memoryHouseholds.set(household.id, { ...household });
      return { ...household };
    }

    await this.getCollection().doc(household.id).set(household);
    return household;
  }

  /**
   * Updates an existing household document
   */
  public async updateHousehold(
    id: string,
    updates: Partial<Household>
  ): Promise<Household | null> {
    if (this.isUnitTestMode()) {
      const existing = this.memoryHouseholds.get(id);
      if (!existing) {
        return null;
      }
      const updated: Household = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.memoryHouseholds.set(id, updated);
      return { ...updated };
    }

    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return null;
    }

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<Household, "id">) };
  }

  /**
   * Retrieves all members of a household from the subcollection
   */
  public async getMembers(householdId: string): Promise<Member[]> {
    if (this.isUnitTestMode()) {
      const memberMap = this.memoryMembers.get(householdId);
      if (!memberMap) return [];
      return Array.from(memberMap.values()).map((m) => ({ ...m }));
    }

    const snapshot = await this.getCollection()
      .doc(householdId)
      .collection("members")
      .orderBy("createdAt", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Member, "id">),
    }));
  }

  /**
   * Retrieves a single member by memberId within a household
   */
  public async getMemberById(householdId: string, memberId: string): Promise<Member | null> {
    if (this.isUnitTestMode()) {
      const memberMap = this.memoryMembers.get(householdId);
      if (!memberMap) return null;
      const m = memberMap.get(memberId);
      return m ? { ...m } : null;
    }

    const doc = await this.getCollection()
      .doc(householdId)
      .collection("members")
      .doc(memberId)
      .get();

    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Omit<Member, "id">) };
  }

  /**
   * Adds a member to the household's subcollection
   */
  public async createMember(householdId: string, member: Member): Promise<Member> {
    if (this.isUnitTestMode()) {
      let memberMap = this.memoryMembers.get(householdId);
      if (!memberMap) {
        memberMap = new Map();
        this.memoryMembers.set(householdId, memberMap);
      }
      memberMap.set(member.id, { ...member });
      return { ...member };
    }

    await this.getCollection()
      .doc(householdId)
      .collection("members")
      .doc(member.id)
      .set(member);

    return member;
  }

  /**
   * Updates an existing member in the household's subcollection
   */
  public async updateMember(
    householdId: string,
    memberId: string,
    updates: Partial<Member>
  ): Promise<Member | null> {
    if (this.isUnitTestMode()) {
      const memberMap = this.memoryMembers.get(householdId);
      if (!memberMap) return null;
      const existing = memberMap.get(memberId);
      if (!existing) return null;

      const updated: Member = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      memberMap.set(memberId, updated);
      return { ...updated };
    }

    const docRef = this.getCollection()
      .doc(householdId)
      .collection("members")
      .doc(memberId);

    const existing = await docRef.get();
    if (!existing.exists) {
      return null;
    }

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<Member, "id">) };
  }

  /**
   * Deletes a member from the household's subcollection
   */
  public async deleteMember(householdId: string, memberId: string): Promise<boolean> {
    if (this.isUnitTestMode()) {
      const memberMap = this.memoryMembers.get(householdId);
      if (!memberMap) return false;
      return memberMap.delete(memberId);
    }

    const docRef = this.getCollection()
      .doc(householdId)
      .collection("members")
      .doc(memberId);

    const existing = await docRef.get();
    if (!existing.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  }

  /**
   * Utility for test cleanup
   */
  public clearMemoryStore(): void {
    this.memoryHouseholds.clear();
    this.memoryMembers.clear();
  }
}
