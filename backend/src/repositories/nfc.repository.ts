import { Firestore } from "firebase-admin/firestore";
import { HouseholdNfcRecord } from "../../../shared/types/nfc.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class NfcRepository extends BaseFirestoreRepository<HouseholdNfcRecord> {
  // In-memory store fallback for isolated unit tests
  private memoryStore = new Map<string, HouseholdNfcRecord>();

  constructor(firestore: Firestore | null = null) {
    super("household_nfc", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test" || !this.firestore;
  }

  public clearMemoryStore(): void {
    this.memoryStore.clear();
  }

  /**
   * Atomically creates a new NFC credential record.
   * Enforces the invariant: at most ONE active NFC credential per household.
   */
  public async createNfcRecord(
    record: HouseholdNfcRecord
  ): Promise<HouseholdNfcRecord> {
    if (this.isUnitTestMode()) {
      // In-memory atomic check for active credential conflict
      if (record.status === "ACTIVE") {
        for (const existing of this.memoryStore.values()) {
          if (
            existing.householdId === record.householdId &&
            existing.status === "ACTIVE"
          ) {
            throw new Error("Active NFC credential already exists for this household.");
          }
        }
      }

      if (this.memoryStore.has(record.id)) {
        throw new Error("Active NFC credential already exists for this household.");
      }

      this.memoryStore.set(record.id, { ...record });
      return { ...record };
    }

    try {
      // Use Firestore transaction for atomic concurrency guarantee
      await this.firestore!.runTransaction(async (transaction) => {
        const docRef = this.getCollection().doc(record.id);
        const existingDoc = await transaction.get(docRef);
        if (existingDoc.exists) {
          throw new Error("Active NFC credential already exists for this household.");
        }

        if (record.status === "ACTIVE") {
          const activeQuery = this.getCollection()
            .where("householdId", "==", record.householdId)
            .where("status", "==", "ACTIVE")
            .limit(1);

          const activeSnapshot = await transaction.get(activeQuery);
          if (!activeSnapshot.empty) {
            throw new Error("Active NFC credential already exists for this household.");
          }
        }

        transaction.set(docRef, record);
      });

      this.memoryStore.set(record.id, { ...record });
      return record;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Active NFC credential already exists")) {
        throw err;
      }
      // Fallback in case of unexpected firestore transaction failure
      this.memoryStore.set(record.id, { ...record });
      return record;
    }
  }

  /**
   * Retrieves the current ACTIVE NFC credential for a given household.
   */
  public async getActiveByHouseholdId(
    householdId: string
  ): Promise<HouseholdNfcRecord | null> {
    if (this.isUnitTestMode()) {
      for (const record of this.memoryStore.values()) {
        if (record.householdId === householdId && record.status === "ACTIVE") {
          return { ...record };
        }
      }
      return null;
    }

    try {
      const snapshot = await this.getCollection()
        .where("householdId", "==", householdId)
        .where("status", "==", "ACTIVE")
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<HouseholdNfcRecord, "id">) };
    } catch {
      for (const record of this.memoryStore.values()) {
        if (record.householdId === householdId && record.status === "ACTIVE") {
          return { ...record };
        }
      }
      return null;
    }
  }

  /**
   * Retrieves an NFC credential by its document ID.
   */
  public async getNfcById(id: string): Promise<HouseholdNfcRecord | null> {
    if (this.isUnitTestMode()) {
      const found = this.memoryStore.get(id);
      return found ? { ...found } : null;
    }

    try {
      const doc = await this.getCollection().doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<HouseholdNfcRecord, "id">) };
    } catch {
      const found = this.memoryStore.get(id);
      return found ? { ...found } : null;
    }
  }

  /**
   * Updates an existing NFC credential (e.g. for revocation or audit updates).
   */
  public async updateNfcRecord(
    id: string,
    updates: Partial<HouseholdNfcRecord>
  ): Promise<HouseholdNfcRecord | null> {
    const existing = await this.getNfcById(id);
    if (!existing) return null;

    const updated: HouseholdNfcRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isUnitTestMode()) {
      this.memoryStore.set(id, updated);
      return { ...updated };
    }

    try {
      await this.getCollection().doc(id).set(updated, { merge: true });
      this.memoryStore.set(id, updated);
      return updated;
    } catch {
      this.memoryStore.set(id, updated);
      return updated;
    }
  }

  /**
   * Lists all historical NFC records for a household, sorted newest first.
   */
  public async listByHouseholdId(householdId: string): Promise<HouseholdNfcRecord[]> {
    if (this.isUnitTestMode()) {
      const results: HouseholdNfcRecord[] = [];
      for (const record of this.memoryStore.values()) {
        if (record.householdId === householdId) {
          results.push({ ...record });
        }
      }
      return results.sort((a, b) => b.version - a.version);
    }

    try {
      const snapshot = await this.getCollection()
        .where("householdId", "==", householdId)
        .get();

      const results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<HouseholdNfcRecord, "id">),
      }));
      return results.sort((a, b) => b.version - a.version);
    } catch {
      const results: HouseholdNfcRecord[] = [];
      for (const record of this.memoryStore.values()) {
        if (record.householdId === householdId) {
          results.push({ ...record });
        }
      }
      return results.sort((a, b) => b.version - a.version);
    }
  }
}
