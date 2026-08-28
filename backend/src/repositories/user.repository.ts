import { Firestore } from "firebase-admin/firestore";
import { UserProfile, ConsentRecord } from "../../../shared/types/auth.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";
import { env } from "../config/env.js";
import fs from "fs";

export class UserRepository extends BaseFirestoreRepository<UserProfile> {
  // In-memory store fallback for testing / uncredentialed local development
  private memoryStore = new Map<string, UserProfile>();
  private consentHistoryStore = new Map<string, ConsentRecord[]>();

  constructor(firestore: Firestore | null = null) {
    super("users", firestore);
  }

  private hasLiveFirestore(): boolean {
    if (process.env.NODE_ENV === "test" || !this.firestore) {
      return false;
    }
    return true;
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    if (!this.hasLiveFirestore()) {
      const user = this.memoryStore.get(uid);
      return user ? { ...user } : null;
    }

    try {
      const doc = await this.getCollection().doc(uid).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data() as UserProfile;
    } catch {
      const user = this.memoryStore.get(uid);
      return user ? { ...user } : null;
    }
  }

  public async createUserProfile(profile: UserProfile): Promise<UserProfile> {
    if (!this.hasLiveFirestore()) {
      this.memoryStore.set(profile.uid, { ...profile });
      return { ...profile };
    }

    try {
      await this.getCollection().doc(profile.uid).set(profile);
      this.memoryStore.set(profile.uid, { ...profile });
      return profile;
    } catch {
      this.memoryStore.set(profile.uid, { ...profile });
      return profile;
    }
  }

  public async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return null;
    }

    const updated: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (!this.hasLiveFirestore()) {
      this.memoryStore.set(uid, updated);
      return { ...updated };
    }

    try {
      await this.getCollection().doc(uid).set(updated, { merge: true });
      this.memoryStore.set(uid, updated);
      return updated;
    } catch {
      this.memoryStore.set(uid, updated);
      return updated;
    }
  }

  public async recordConsentHistory(
    userId: string,
    record: Omit<ConsentRecord, "id">
  ): Promise<ConsentRecord> {
    const consentId = `consent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullRecord: ConsentRecord = {
      id: consentId,
      ...record,
    };

    if (!this.hasLiveFirestore()) {
      const history = this.consentHistoryStore.get(userId) || [];
      history.push(fullRecord);
      this.consentHistoryStore.set(userId, history);
      return fullRecord;
    }

    try {
      await this.getCollection()
        .doc(userId)
        .collection("consent_history")
        .doc(consentId)
        .set(fullRecord);

      const history = this.consentHistoryStore.get(userId) || [];
      history.push(fullRecord);
      this.consentHistoryStore.set(userId, history);
      return fullRecord;
    } catch {
      const history = this.consentHistoryStore.get(userId) || [];
      history.push(fullRecord);
      this.consentHistoryStore.set(userId, history);
      return fullRecord;
    }
  }

  public async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    if (!this.hasLiveFirestore()) {
      return this.consentHistoryStore.get(userId) || [];
    }

    try {
      const snapshot = await this.getCollection()
        .doc(userId)
        .collection("consent_history")
        .orderBy("timestamp", "desc")
        .get();

      return snapshot.docs.map((d) => d.data() as ConsentRecord);
    } catch {
      return this.consentHistoryStore.get(userId) || [];
    }
  }

  public clearMemoryStore(): void {
    this.memoryStore.clear();
    this.consentHistoryStore.clear();
  }
}
