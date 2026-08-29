import { Firestore } from "firebase-admin/firestore";
import {
  AshaAssistanceRequest,
  AssistanceStatus,
} from "../../../shared/types/assistance.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class AssistanceRepository extends BaseFirestoreRepository<AshaAssistanceRequest> {
  private memoryStore = new Map<string, AshaAssistanceRequest>();

  constructor(firestore: Firestore | null = null) {
    super("asha_assistance_requests", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test" || !this.firestore;
  }

  public clearMemoryStore(): void {
    this.memoryStore.clear();
  }

  public async createRequest(
    request: AshaAssistanceRequest
  ): Promise<AshaAssistanceRequest> {
    if (this.isUnitTestMode()) {
      this.memoryStore.set(request.id, { ...request });
      return { ...request };
    }

    try {
      await this.getCollection().doc(request.id).set(request);
      this.memoryStore.set(request.id, { ...request });
      return request;
    } catch {
      this.memoryStore.set(request.id, { ...request });
      return request;
    }
  }

  public async getRequestById(
    requestId: string
  ): Promise<AshaAssistanceRequest | null> {
    if (this.isUnitTestMode()) {
      const found = this.memoryStore.get(requestId);
      return found ? { ...found } : null;
    }

    try {
      const doc = await this.getCollection().doc(requestId).get();
      if (!doc.exists) return null;
      return doc.data() as AshaAssistanceRequest;
    } catch {
      const found = this.memoryStore.get(requestId);
      return found ? { ...found } : null;
    }
  }

  public async listRequestsByCitizenUid(
    citizenUid: string
  ): Promise<AshaAssistanceRequest[]> {
    if (this.isUnitTestMode()) {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.citizenUid === citizenUid) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      const snapshot = await this.getCollection()
        .where("citizenUid", "==", citizenUid)
        .get();

      const results = snapshot.docs.map((doc) => doc.data() as AshaAssistanceRequest);
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.citizenUid === citizenUid) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  public async listRequestsByHouseholdId(
    householdId: string
  ): Promise<AshaAssistanceRequest[]> {
    if (this.isUnitTestMode()) {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      const snapshot = await this.getCollection()
        .where("householdId", "==", householdId)
        .get();

      const results = snapshot.docs.map((doc) => doc.data() as AshaAssistanceRequest);
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  public async listRequestsByAshaUid(
    ashaUid: string,
    status?: AssistanceStatus
  ): Promise<AshaAssistanceRequest[]> {
    if (this.isUnitTestMode()) {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.ashaUid === ashaUid) {
          if (!status || req.status === status) {
            results.push({ ...req });
          }
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      let query = this.getCollection().where("ashaUid", "==", ashaUid);
      if (status) {
        query = query.where("status", "==", status);
      }

      const snapshot = await query.get();
      const results = snapshot.docs.map((doc) => doc.data() as AshaAssistanceRequest);
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (req.ashaUid === ashaUid) {
          if (!status || req.status === status) {
            results.push({ ...req });
          }
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  public async listAllRequests(
    status?: AssistanceStatus
  ): Promise<AshaAssistanceRequest[]> {
    if (this.isUnitTestMode()) {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (!status || req.status === status) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      let query: FirebaseFirestore.Query = this.getCollection();
      if (status) {
        query = query.where("status", "==", status);
      }

      const snapshot = await query.get();
      const results = snapshot.docs.map((doc) => doc.data() as AshaAssistanceRequest);
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      const results: AshaAssistanceRequest[] = [];
      for (const req of this.memoryStore.values()) {
        if (!status || req.status === status) {
          results.push({ ...req });
        }
      }
      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  public async updateRequest(
    requestId: string,
    updates: Partial<AshaAssistanceRequest>
  ): Promise<AshaAssistanceRequest | null> {
    const existing = await this.getRequestById(requestId);
    if (!existing) return null;

    const merged: AshaAssistanceRequest = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isUnitTestMode()) {
      this.memoryStore.set(requestId, merged);
      return { ...merged };
    }

    try {
      await this.getCollection().doc(requestId).set(merged, { merge: true });
      this.memoryStore.set(requestId, merged);
      return merged;
    } catch {
      this.memoryStore.set(requestId, merged);
      return merged;
    }
  }
}
