import { Firestore } from "firebase-admin/firestore";
import {
  AshaConnectionRequest,
  ConnectionRequestStatus,
} from "../../../shared/types/connection.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class ConnectionRepository extends BaseFirestoreRepository<AshaConnectionRequest> {
  // In-memory store fallback for testing / isolated unit tests
  private memoryStore = new Map<string, AshaConnectionRequest>();

  constructor(firestore: Firestore | null = null) {
    super("asha_connection_requests", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test" || !this.firestore;
  }

  public async createRequest(
    request: AshaConnectionRequest
  ): Promise<AshaConnectionRequest> {
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
  ): Promise<AshaConnectionRequest | null> {
    if (this.isUnitTestMode()) {
      const found = this.memoryStore.get(requestId);
      return found ? { ...found } : null;
    }

    try {
      const doc = await this.getCollection().doc(requestId).get();
      if (!doc.exists) return null;
      return doc.data() as AshaConnectionRequest;
    } catch {
      const found = this.memoryStore.get(requestId);
      return found ? { ...found } : null;
    }
  }

  public async getActiveRequestByHouseholdId(
    householdId: string
  ): Promise<AshaConnectionRequest | null> {
    if (this.isUnitTestMode()) {
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId && req.status === "ACTIVE") {
          return { ...req };
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
      return snapshot.docs[0].data() as AshaConnectionRequest;
    } catch {
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId && req.status === "ACTIVE") {
          return { ...req };
        }
      }
      return null;
    }
  }

  public async getPendingRequestByHouseholdId(
    householdId: string
  ): Promise<AshaConnectionRequest | null> {
    if (this.isUnitTestMode()) {
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId && req.status === "PENDING") {
          return { ...req };
        }
      }
      return null;
    }

    try {
      const snapshot = await this.getCollection()
        .where("householdId", "==", householdId)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as AshaConnectionRequest;
    } catch {
      for (const req of this.memoryStore.values()) {
        if (req.householdId === householdId && req.status === "PENDING") {
          return { ...req };
        }
      }
      return null;
    }
  }

  public async listRequestsByAshaUid(
    ashaUid: string,
    status?: ConnectionRequestStatus
  ): Promise<AshaConnectionRequest[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryStore.values())
        .filter((r) => r.ashaUid === ashaUid && (!status || r.status === status))
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }

    try {
      let query = this.getCollection().where("ashaUid", "==", ashaUid);
      if (status) {
        query = query.where("status", "==", status);
      }
      const snapshot = await query.get();
      return snapshot.docs
        .map((d) => d.data() as AshaConnectionRequest)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    } catch {
      return Array.from(this.memoryStore.values())
        .filter((r) => r.ashaUid === ashaUid && (!status || r.status === status))
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
  }

  public async listRequestsByCitizenUid(
    citizenUid: string
  ): Promise<AshaConnectionRequest[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryStore.values())
        .filter((r) => r.citizenUid === citizenUid)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }

    try {
      const snapshot = await this.getCollection()
        .where("citizenUid", "==", citizenUid)
        .get();

      return snapshot.docs
        .map((d) => d.data() as AshaConnectionRequest)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    } catch {
      return Array.from(this.memoryStore.values())
        .filter((r) => r.citizenUid === citizenUid)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }
  }

  public async updateRequest(
    requestId: string,
    updates: Partial<AshaConnectionRequest>
  ): Promise<AshaConnectionRequest | null> {
    const existing = await this.getRequestById(requestId);
    if (!existing) return null;

    const updated: AshaConnectionRequest = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isUnitTestMode()) {
      this.memoryStore.set(requestId, updated);
      return { ...updated };
    }

    try {
      await this.getCollection().doc(requestId).set(updated, { merge: true });
      this.memoryStore.set(requestId, updated);
      return updated;
    } catch {
      this.memoryStore.set(requestId, updated);
      return updated;
    }
  }

  public async deleteRequest(requestId: string): Promise<boolean> {
    if (this.isUnitTestMode()) {
      return this.memoryStore.delete(requestId);
    }

    try {
      const docRef = this.getCollection().doc(requestId);
      const existing = await docRef.get();
      if (!existing.exists) return false;
      await docRef.delete();
      this.memoryStore.delete(requestId);
      return true;
    } catch {
      return this.memoryStore.delete(requestId);
    }
  }

  public clearMemoryStore(): void {
    this.memoryStore.clear();
  }
}
