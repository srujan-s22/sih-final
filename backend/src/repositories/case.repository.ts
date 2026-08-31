import { Firestore } from "firebase-admin/firestore";
import {
  AshaCase,
  CaseNote,
  CaseFollowUp,
  CaseActivity,
  CaseTask,
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
  private memoryTasks = new Map<string, Map<string, CaseTask>>(); // caseId -> (taskId -> CaseTask)

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
    this.memoryTasks.clear();
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
      this.memoryTasks.delete(id);
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

    const tasksSnap = await docRef.collection("tasks").get();
    for (const d of tasksSnap.docs) await d.ref.delete();

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

  public async getFollowUpById(caseId: string, followUpId: string): Promise<CaseFollowUp | null> {
    if (this.isUnitTestMode()) {
      const followUpMap = this.memoryFollowUps.get(caseId);
      if (!followUpMap) return null;
      const f = followUpMap.get(followUpId);
      return f ? { ...f } : null;
    }

    const doc = await this.getCollection().doc(caseId).collection("followups").doc(followUpId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as Omit<CaseFollowUp, "id">) };
  }

  public async listFollowUpsByAsha(
    ashaUid: string,
    filter?: { status?: string }
  ): Promise<CaseFollowUp[]> {
    if (this.isUnitTestMode()) {
      const results: CaseFollowUp[] = [];
      for (const [caseId, followUpMap] of this.memoryFollowUps.entries()) {
        const c = this.memoryCases.get(caseId);
        if (c && c.assignedAshaUid === ashaUid) {
          for (const f of followUpMap.values()) {
            if (filter?.status && f.status !== filter.status) continue;
            results.push({
              ...f,
              householdId: f.householdId || c.householdId,
              headOfHouseholdName: f.headOfHouseholdName || c.headOfHouseholdName,
              assignedAshaUid: f.assignedAshaUid || c.assignedAshaUid,
              schemeId: f.schemeId || c.schemeId,
              schemeName: f.schemeName || c.schemeName,
            });
          }
        }
      }
      return results.sort(
        (a, b) => new Date(a.dueAt || a.scheduledAt).getTime() - new Date(b.dueAt || b.scheduledAt).getTime()
      );
    }

    const cases = await this.listCasesByAsha(ashaUid);
    const results: CaseFollowUp[] = [];

    for (const c of cases) {
      const caseFollowUps = await this.getFollowUps(c.id);
      for (const f of caseFollowUps) {
        if (filter?.status && f.status !== filter.status) continue;
        results.push({
          ...f,
          householdId: f.householdId || c.householdId,
          headOfHouseholdName: f.headOfHouseholdName || c.headOfHouseholdName,
          assignedAshaUid: f.assignedAshaUid || c.assignedAshaUid,
          schemeId: f.schemeId || c.schemeId,
          schemeName: f.schemeName || c.schemeName,
        });
      }
    }

    return results.sort(
      (a, b) => new Date(a.dueAt || a.scheduledAt).getTime() - new Date(b.dueAt || b.scheduledAt).getTime()
    );
  }

  public async listAllFollowUpsForAdmin(
    filter?: { status?: string }
  ): Promise<CaseFollowUp[]> {
    if (this.isUnitTestMode()) {
      const results: CaseFollowUp[] = [];
      for (const [caseId, followUpMap] of this.memoryFollowUps.entries()) {
        const c = this.memoryCases.get(caseId);
        for (const f of followUpMap.values()) {
          if (filter?.status && f.status !== filter.status) continue;
          results.push({
            ...f,
            householdId: f.householdId || c?.householdId,
            headOfHouseholdName: f.headOfHouseholdName || c?.headOfHouseholdName,
            assignedAshaUid: f.assignedAshaUid || c?.assignedAshaUid,
            schemeId: f.schemeId || c?.schemeId,
            schemeName: f.schemeName || c?.schemeName,
          });
        }
      }
      return results.sort(
        (a, b) => new Date(a.dueAt || a.scheduledAt).getTime() - new Date(b.dueAt || b.scheduledAt).getTime()
      );
    }

    const allCases = await this.listAllCases();
    const results: CaseFollowUp[] = [];

    for (const c of allCases) {
      const caseFollowUps = await this.getFollowUps(c.id);
      for (const f of caseFollowUps) {
        if (filter?.status && f.status !== filter.status) continue;
        results.push({
          ...f,
          householdId: f.householdId || c.householdId,
          headOfHouseholdName: f.headOfHouseholdName || c.headOfHouseholdName,
          assignedAshaUid: f.assignedAshaUid || c.assignedAshaUid,
          schemeId: f.schemeId || c.schemeId,
          schemeName: f.schemeName || c.schemeName,
        });
      }
    }

    return results.sort(
      (a, b) => new Date(a.dueAt || a.scheduledAt).getTime() - new Date(b.dueAt || b.scheduledAt).getTime()
    );
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

  // ============================================================================
  // CASE TASKS SUBCOLLECTION
  // ============================================================================

  public async createTask(caseId: string, task: CaseTask): Promise<CaseTask> {
    if (this.isUnitTestMode()) {
      let taskMap = this.memoryTasks.get(caseId);
      if (!taskMap) {
        taskMap = new Map();
        this.memoryTasks.set(caseId, taskMap);
      }
      taskMap.set(task.id, { ...task });
      return { ...task };
    }

    await this.getCollection()
      .doc(caseId)
      .collection("tasks")
      .doc(task.id)
      .set(task);

    return { ...task };
  }

  public async getTasks(caseId: string): Promise<CaseTask[]> {
    if (this.isUnitTestMode()) {
      const taskMap = this.memoryTasks.get(caseId);
      if (!taskMap) return [];
      return Array.from(taskMap.values())
        .map((t) => ({ ...t }))
        .sort((a, b) => a.order - b.order || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const snapshot = await this.getCollection()
      .doc(caseId)
      .collection("tasks")
      .orderBy("order", "asc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CaseTask, "id">),
    }));
  }

  public async getTaskById(caseId: string, taskId: string): Promise<CaseTask | null> {
    if (this.isUnitTestMode()) {
      const taskMap = this.memoryTasks.get(caseId);
      if (!taskMap) return null;
      const found = taskMap.get(taskId);
      return found ? { ...found } : null;
    }

    const doc = await this.getCollection()
      .doc(caseId)
      .collection("tasks")
      .doc(taskId)
      .get();

    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as Omit<CaseTask, "id">) };
  }

  public async updateTask(
    caseId: string,
    taskId: string,
    updates: Partial<CaseTask>
  ): Promise<CaseTask | null> {
    if (this.isUnitTestMode()) {
      const taskMap = this.memoryTasks.get(caseId);
      if (!taskMap) return null;
      const existing = taskMap.get(taskId);
      if (!existing) return null;

      const updated: CaseTask = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      taskMap.set(taskId, updated);
      return { ...updated };
    }

    const docRef = this.getCollection().doc(caseId).collection("tasks").doc(taskId);
    const existing = await docRef.get();
    if (!existing.exists) return null;

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<CaseTask, "id">) };
  }
}

