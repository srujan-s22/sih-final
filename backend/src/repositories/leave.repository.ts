import { Firestore } from "firebase-admin/firestore";
import {
  AshaLeaveRequest,
  AshaTemporaryAssignmentRecord,
  LeaveAuditLog,
  LeaveRequestStatus,
} from "../../../shared/types/leave.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class LeaveRepository extends BaseFirestoreRepository<AshaLeaveRequest> {
  // In-memory fallback stores for unit testing / uncredentialed offline development
  private memoryLeaveRequests = new Map<string, AshaLeaveRequest>();
  private memoryAssignments = new Map<string, AshaTemporaryAssignmentRecord>();
  private memoryAuditLogs = new Map<string, LeaveAuditLog>();

  constructor(firestore: Firestore | null = null) {
    super("asha_leave_requests", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test" || !this.firestore;
  }

  public clearMemoryStore(): void {
    this.memoryLeaveRequests.clear();
    this.memoryAssignments.clear();
    this.memoryAuditLogs.clear();
  }

  // ============================================================================
  // LEAVE REQUEST METHODS
  // ============================================================================

  public async createLeaveRequest(
    request: AshaLeaveRequest
  ): Promise<AshaLeaveRequest> {
    if (this.isUnitTestMode()) {
      this.memoryLeaveRequests.set(request.id, { ...request });
      return { ...request };
    }

    try {
      await this.getCollection().doc(request.id).set(request);
      this.memoryLeaveRequests.set(request.id, { ...request });
      return request;
    } catch {
      this.memoryLeaveRequests.set(request.id, { ...request });
      return request;
    }
  }

  public async getLeaveRequestById(
    id: string
  ): Promise<AshaLeaveRequest | null> {
    if (this.isUnitTestMode()) {
      const found = this.memoryLeaveRequests.get(id);
      return found ? { ...found } : null;
    }

    try {
      const doc = await this.getCollection().doc(id).get();
      if (!doc.exists) return null;
      return doc.data() as AshaLeaveRequest;
    } catch {
      const found = this.memoryLeaveRequests.get(id);
      return found ? { ...found } : null;
    }
  }

  public async listLeaveRequestsByAsha(
    ashaId: string
  ): Promise<AshaLeaveRequest[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => r.ashaId === ashaId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    try {
      const snapshot = await this.getCollection()
        .where("ashaId", "==", ashaId)
        .get();

      return snapshot.docs
        .map((d) => d.data() as AshaLeaveRequest)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => r.ashaId === ashaId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  public async listAllLeaveRequests(
    status?: LeaveRequestStatus
  ): Promise<AshaLeaveRequest[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => (!status || r.status === status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    try {
      let query: FirebaseFirestore.Query = this.getCollection();
      if (status) {
        query = query.where("status", "==", status);
      }
      const snapshot = await query.get();
      return snapshot.docs
        .map((d) => d.data() as AshaLeaveRequest)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => (!status || r.status === status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  public async listActiveApprovedRequests(): Promise<AshaLeaveRequest[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => r.status === "APPROVED")
        .sort((a, b) => new Date(a.effectiveUntil).getTime() - new Date(b.effectiveUntil).getTime());
    }

    try {
      const snapshot = await this.getCollection()
        .where("status", "==", "APPROVED")
        .get();

      return snapshot.docs
        .map((d) => d.data() as AshaLeaveRequest)
        .sort((a, b) => new Date(a.effectiveUntil).getTime() - new Date(b.effectiveUntil).getTime());
    } catch {
      return Array.from(this.memoryLeaveRequests.values())
        .filter((r) => r.status === "APPROVED")
        .sort((a, b) => new Date(a.effectiveUntil).getTime() - new Date(b.effectiveUntil).getTime());
    }
  }

  public async updateLeaveRequest(
    id: string,
    updates: Partial<AshaLeaveRequest>
  ): Promise<AshaLeaveRequest | null> {
    const existing = await this.getLeaveRequestById(id);
    if (!existing) return null;

    const updated: AshaLeaveRequest = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isUnitTestMode()) {
      this.memoryLeaveRequests.set(id, updated);
      return { ...updated };
    }

    try {
      await this.getCollection().doc(id).set(updated, { merge: true });
      this.memoryLeaveRequests.set(id, updated);
      return updated;
    } catch {
      this.memoryLeaveRequests.set(id, updated);
      return updated;
    }
  }

  // ============================================================================
  // TEMPORARY ASSIGNMENT HISTORY METHODS
  // ============================================================================

  public async createTemporaryAssignment(
    record: AshaTemporaryAssignmentRecord
  ): Promise<AshaTemporaryAssignmentRecord> {
    if (this.isUnitTestMode()) {
      this.memoryAssignments.set(record.id, { ...record });
      return { ...record };
    }

    try {
      await this.firestore!
        .collection("asha_temporary_assignments")
        .doc(record.id)
        .set(record);
      this.memoryAssignments.set(record.id, { ...record });
      return record;
    } catch {
      this.memoryAssignments.set(record.id, { ...record });
      return record;
    }
  }

  public async getTemporaryAssignmentsByLeaveId(
    leaveRequestId: string
  ): Promise<AshaTemporaryAssignmentRecord[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryAssignments.values()).filter(
        (a) => a.leaveRequestId === leaveRequestId
      );
    }

    try {
      const snapshot = await this.firestore!
        .collection("asha_temporary_assignments")
        .where("leaveRequestId", "==", leaveRequestId)
        .get();

      return snapshot.docs.map((d) => d.data() as AshaTemporaryAssignmentRecord);
    } catch {
      return Array.from(this.memoryAssignments.values()).filter(
        (a) => a.leaveRequestId === leaveRequestId
      );
    }
  }

  public async updateTemporaryAssignment(
    id: string,
    updates: Partial<AshaTemporaryAssignmentRecord>
  ): Promise<AshaTemporaryAssignmentRecord | null> {
    let existing: AshaTemporaryAssignmentRecord | null = null;
    if (this.isUnitTestMode()) {
      existing = this.memoryAssignments.get(id) || null;
    } else {
      try {
        const doc = await this.firestore!
          .collection("asha_temporary_assignments")
          .doc(id)
          .get();
        if (doc.exists) {
          existing = doc.data() as AshaTemporaryAssignmentRecord;
        }
      } catch {
        existing = this.memoryAssignments.get(id) || null;
      }
    }

    if (!existing) return null;

    const updated: AshaTemporaryAssignmentRecord = {
      ...existing,
      ...updates,
    };

    if (this.isUnitTestMode()) {
      this.memoryAssignments.set(id, updated);
      return { ...updated };
    }

    try {
      await this.firestore!
        .collection("asha_temporary_assignments")
        .doc(id)
        .set(updated, { merge: true });
      this.memoryAssignments.set(id, updated);
      return updated;
    } catch {
      this.memoryAssignments.set(id, updated);
      return updated;
    }
  }

  // ============================================================================
  // AUDIT LOGGING METHODS
  // ============================================================================

  public async createAuditLog(log: LeaveAuditLog): Promise<LeaveAuditLog> {
    if (this.isUnitTestMode()) {
      this.memoryAuditLogs.set(log.id, { ...log });
      return { ...log };
    }

    try {
      await this.firestore!
        .collection("asha_leave_audit_logs")
        .doc(log.id)
        .set(log);
      this.memoryAuditLogs.set(log.id, { ...log });
      return log;
    } catch {
      this.memoryAuditLogs.set(log.id, { ...log });
      return log;
    }
  }

  public async listAuditLogs(leaveRequestId?: string): Promise<LeaveAuditLog[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryAuditLogs.values())
        .filter((l) => !leaveRequestId || l.leaveRequestId === leaveRequestId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    try {
      let query: FirebaseFirestore.Query = this.firestore!.collection("asha_leave_audit_logs");
      if (leaveRequestId) {
        query = query.where("leaveRequestId", "==", leaveRequestId);
      }
      const snapshot = await query.get();
      return snapshot.docs
        .map((d) => d.data() as LeaveAuditLog)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return Array.from(this.memoryAuditLogs.values())
        .filter((l) => !leaveRequestId || l.leaveRequestId === leaveRequestId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }
}
