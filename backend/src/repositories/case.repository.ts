import { Firestore } from "firebase-admin/firestore";
import {
  AshaCase,
  CaseNote,
  CaseFollowUp,
  CaseActivity,
  CaseStatus,
  CasePriority,
} from "../../../shared/types/case.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class CaseRepository extends BaseFirestoreRepository<AshaCase> {
  // In-memory stores for unit testing
  private memoryCases = new Map<string, AshaCase>();
  private memoryNotes = new Map<string, Map<string, CaseNote>>(); // caseId -> (noteId -> CaseNote)
  private memoryFollowUps = new Map<string, Map<string, CaseFollowUp>>(); // caseId -> (followupId -> CaseFollowUp)
  private memoryActivities = new Map<string, Map<string, CaseActivity>>(); // caseId -> (activityId -> CaseActivity)

  constructor(firestore: Firestore | null = null) {
    super("cases", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test";
  }

  public clearMemoryStore(): void {
    this.memoryCases.clear();
    this.memoryNotes.clear();
    this.memoryFollowUps.clear();
    this.memoryActivities.clear();
  }

  // ============================================================================
  // CASE ROOT METHODS
  // ============================================================================

  public async getCaseById(id: string): Promise<AshaCase | null> {
    if (this.isUnitTestMode()) {
      const c = this.memoryCases.get(id);
      return c ? { ...c } : null;
    }

    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Omit<AshaCase, "id">) };
  }

  public async getCaseByHouseholdId(householdId: string): Promise<AshaCase | null> {
    if (this.isUnitTestMode()) {
      for (const c of this.memoryCases.values()) {
        if (c.householdId === householdId) {
          return { ...c };
        }
      }
      return null;
    }

    const querySnapshot = await this.getCollection()
      .where("householdId", "==", householdId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<AshaCase, "id">) };
  }

  public async listCasesByAsha(
    ashaUid: string,
    filter?: { status?: CaseStatus; priority?: CasePriority }
  ): Promise<AshaCase[]> {
    if (this.isUnitTestMode()) {
      const results: AshaCase[] = [];
      for (const c of this.memoryCases.values()) {
        if (c.assignedAshaUid === ashaUid) {
          if (filter?.status && c.status !== filter.status) continue;
          if (filter?.priority && c.priority !== filter.priority) continue;
          results.push({ ...c });
        }
      }
      return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    let query: FirebaseFirestore.Query = this.getCollection().where("assignedAshaUid", "==", ashaUid);

    if (filter?.status) {
      query = query.where("status", "==", filter.status);
    }
    if (filter?.priority) {
      query = query.where("priority", "==", filter.priority);
    }

    const snapshot = await query.get();
    const cases = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AshaCase, "id">),
    }));
    return cases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async listAllCases(
    filter?: { status?: CaseStatus; priority?: CasePriority }
  ): Promise<AshaCase[]> {
    if (this.isUnitTestMode()) {
      const results: AshaCase[] = [];
      for (const c of this.memoryCases.values()) {
        if (filter?.status && c.status !== filter.status) continue;
        if (filter?.priority && c.priority !== filter.priority) continue;
        results.push({ ...c });
      }
      return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    let query: FirebaseFirestore.Query = this.getCollection();

    if (filter?.status) {
      query = query.where("status", "==", filter.status);
    }
    if (filter?.priority) {
      query = query.where("priority", "==", filter.priority);
    }

    const snapshot = await query.get();
    const cases = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AshaCase, "id">),
    }));
    return cases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async createCase(caseData: AshaCase): Promise<AshaCase> {
    if (this.isUnitTestMode()) {
      this.memoryCases.set(caseData.id, { ...caseData });
      return { ...caseData };
    }

    const docRef = this.getCollection().doc(caseData.id);
    await docRef.set(caseData);
    return { ...caseData };
  }

  public async updateCase(id: string, updates: Partial<AshaCase>): Promise<AshaCase | null> {
    if (this.isUnitTestMode()) {
      const existing = this.memoryCases.get(id);
      if (!existing) return null;

      const updated: AshaCase = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.memoryCases.set(id, updated);
      return { ...updated };
    }

    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return null;

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<AshaCase, "id">) };
  }

  public async deleteCase(id: string): Promise<boolean> {
    if (this.isUnitTestMode()) {
      const existed = this.memoryCases.delete(id);
      this.memoryNotes.delete(id);
      this.memoryFollowUps.delete(id);
      this.memoryActivities.delete(id);
      return existed;
    }

    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return false;

    // Delete subcollections in Firestore
    const notesSnap = await docRef.collection("notes").get();
    for (const d of notesSnap.docs) await d.ref.delete();

    const followUpsSnap = await docRef.collection("followups").get();
    for (const d of followUpsSnap.docs) await d.ref.delete();

    const activitiesSnap = await docRef.collection("activities").get();
    for (const d of activitiesSnap.docs) await d.ref.delete();

    await docRef.delete();
    return true;
  }

  // ============================================================================
  // CASE NOTES SUBCOLLECTION
  // ============================================================================

  public async createNote(caseId: string, note: CaseNote): Promise<CaseNote> {
    if (this.isUnitTestMode()) {
      let noteMap = this.memoryNotes.get(caseId);
      if (!noteMap) {
        noteMap = new Map();
        this.memoryNotes.set(caseId, noteMap);
      }
      noteMap.set(note.id, { ...note });
      return { ...note };
    }

    await this.getCollection()
      .doc(caseId)
      .collection("notes")
      .doc(note.id)
      .set(note);

    return { ...note };
  }

  public async getNotes(caseId: string): Promise<CaseNote[]> {
    if (this.isUnitTestMode()) {
      const noteMap = this.memoryNotes.get(caseId);
      if (!noteMap) return [];
      return Array.from(noteMap.values())
        .map((n) => ({ ...n }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const snapshot = await this.getCollection()
      .doc(caseId)
      .collection("notes")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CaseNote, "id">),
    }));
  }

  // ============================================================================
  // CASE FOLLOW-UPS SUBCOLLECTION
  // ============================================================================

  public async createFollowUp(caseId: string, followUp: CaseFollowUp): Promise<CaseFollowUp> {
    if (this.isUnitTestMode()) {
      let followUpMap = this.memoryFollowUps.get(caseId);
      if (!followUpMap) {
        followUpMap = new Map();
        this.memoryFollowUps.set(caseId, followUpMap);
      }
      followUpMap.set(followUp.id, { ...followUp });
      return { ...followUp };
    }

    await this.getCollection()
      .doc(caseId)
      .collection("followups")
      .doc(followUp.id)
      .set(followUp);

    return { ...followUp };
  }

  public async getFollowUps(caseId: string): Promise<CaseFollowUp[]> {
    if (this.isUnitTestMode()) {
      const followUpMap = this.memoryFollowUps.get(caseId);
      if (!followUpMap) return [];
      return Array.from(followUpMap.values())
        .map((f) => ({ ...f }))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }

    const snapshot = await this.getCollection()
      .doc(caseId)
      .collection("followups")
      .orderBy("scheduledAt", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CaseFollowUp, "id">),
    }));
  }

  public async updateFollowUp(
    caseId: string,
    followUpId: string,
    updates: Partial<CaseFollowUp>
  ): Promise<CaseFollowUp | null> {
    if (this.isUnitTestMode()) {
      const followUpMap = this.memoryFollowUps.get(caseId);
      if (!followUpMap) return null;
      const existing = followUpMap.get(followUpId);
      if (!existing) return null;

      const updated: CaseFollowUp = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      followUpMap.set(followUpId, updated);
      return { ...updated };
    }

    const docRef = this.getCollection().doc(caseId).collection("followups").doc(followUpId);
    const existing = await docRef.get();
    if (!existing.exists) return null;

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<CaseFollowUp, "id">) };
  }

  // ============================================================================
  // CASE ACTIVITIES (AUDIT TRAIL) SUBCOLLECTION
  // ============================================================================

  public async createActivity(caseId: string, activity: CaseActivity): Promise<CaseActivity> {
    if (this.isUnitTestMode()) {
      let actMap = this.memoryActivities.get(caseId);
      if (!actMap) {
        actMap = new Map();
        this.memoryActivities.set(caseId, actMap);
      }
      actMap.set(activity.id, { ...activity });
      return { ...activity };
    }

    await this.getCollection()
      .doc(caseId)
      .collection("activities")
      .doc(activity.id)
      .set(activity);

    return { ...activity };
  }

  public async getActivities(caseId: string): Promise<CaseActivity[]> {
    if (this.isUnitTestMode()) {
      const actMap = this.memoryActivities.get(caseId);
      if (!actMap) return [];
      return Array.from(actMap.values())
        .map((a) => ({ ...a }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const snapshot = await this.getCollection()
      .doc(caseId)
      .collection("activities")
      .orderBy("timestamp", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CaseActivity, "id">),
    }));
  }
}
