import * as admin from "firebase-admin";
import {
  EvidenceRecord,
  EvidenceConflict,
  EvidenceSearchCacheRecord,
  EvidenceVerificationStatus,
  EvidenceAuditLog,
} from "../../../shared/types/evidence.js";

export class EvidenceRepository {
  private firestore: admin.firestore.Firestore | null;

  // In-memory cache & fallback test store
  private memoryEvidence = new Map<string, EvidenceRecord>();
  private memoryConflicts = new Map<string, EvidenceConflict>();
  private memorySearchCache = new Map<string, EvidenceSearchCacheRecord>();
  private memoryAuditLogs = new Map<string, EvidenceAuditLog>();

  constructor(firestore?: admin.firestore.Firestore | null) {
    this.firestore = firestore || null;
  }

  public clearMemoryStore(): void {
    this.memoryEvidence.clear();
    this.memoryConflicts.clear();
    this.memorySearchCache.clear();
    this.memoryAuditLogs.clear();
  }

  // ============================================================================
  // 1. EVIDENCE RECORDS
  // ============================================================================

  public async createEvidence(evidence: EvidenceRecord): Promise<void> {
    this.memoryEvidence.set(evidence.id, evidence);

    if (this.firestore) {
      await this.firestore.collection("evidence").doc(evidence.id).set(evidence);
    }
  }

  public async getEvidenceById(id: string): Promise<EvidenceRecord | null> {
    if (this.memoryEvidence.has(id)) {
      return this.memoryEvidence.get(id) || null;
    }

    if (this.firestore) {
      const snap = await this.firestore.collection("evidence").doc(id).get();
      if (snap.exists) {
        const data = snap.data() as EvidenceRecord;
        this.memoryEvidence.set(id, data);
        return data;
      }
    }

    return null;
  }

  public async listEvidenceBySchemeId(
    schemeId: string,
    verifiedOnly: boolean = false
  ): Promise<EvidenceRecord[]> {
    let results: EvidenceRecord[] = [];

    if (this.firestore) {
      let query: admin.firestore.Query = this.firestore
        .collection("evidence")
        .where("schemeId", "==", schemeId);

      if (verifiedOnly) {
        query = query.where("verificationStatus", "==", "VERIFIED");
      }

      const snap = await query.get();
      results = snap.docs.map((d) => d.data() as EvidenceRecord);
    } else {
      results = Array.from(this.memoryEvidence.values()).filter((e) => {
        if (e.schemeId !== schemeId) return false;
        if (verifiedOnly && e.verificationStatus !== "VERIFIED") return false;
        return true;
      });
    }

    return results;
  }

  public async updateVerificationStatus(
    id: string,
    status: EvidenceVerificationStatus,
    adminUid: string,
    reason?: string
  ): Promise<EvidenceRecord | null> {
    const existing = await this.getEvidenceById(id);
    if (!existing) return null;

    const previousStatus = existing.verificationStatus;
    const now = new Date().toISOString();

    const updated: EvidenceRecord = {
      ...existing,
      verificationStatus: status,
      verificationMethod: "ADMIN_EXPLICIT_REVIEW",
      verifiedAt: status === "VERIFIED" ? now : existing.verifiedAt,
      verifiedBy: adminUid,
      rejectionReason: status === "REJECTED" ? reason : existing.rejectionReason,
      updatedAt: now,
    };

    await this.createEvidence(updated);

    // Audit log
    const auditLog: EvidenceAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      adminUid,
      action: status === "VERIFIED" ? "EVIDENCE_VERIFIED" : "EVIDENCE_REJECTED",
      evidenceId: id,
      schemeId: existing.schemeId,
      previousStatus,
      newStatus: status,
      reason,
      timestamp: now,
    };

    await this.createAuditLog(auditLog);

    return updated;
  }

  // ============================================================================
  // 2. SEARCH CACHE
  // ============================================================================

  public async getSearchCache(queryHash: string): Promise<EvidenceSearchCacheRecord | null> {
    // 1. Check in-memory L1 cache
    const memCached = this.memorySearchCache.get(queryHash);
    if (memCached) {
      if (new Date(memCached.expiresAt).getTime() > Date.now()) {
        return memCached;
      }
      this.memorySearchCache.delete(queryHash);
    }

    // 2. Check Firestore L2 cache
    if (this.firestore) {
      const snap = await this.firestore.collection("evidence_search_cache").doc(queryHash).get();
      if (snap.exists) {
        const data = snap.data() as EvidenceSearchCacheRecord;
        if (new Date(data.expiresAt).getTime() > Date.now()) {
          this.memorySearchCache.set(queryHash, data);
          return data;
        }
      }
    }

    return null;
  }

  public async setSearchCache(record: EvidenceSearchCacheRecord): Promise<void> {
    this.memorySearchCache.set(record.queryHash, record);

    if (this.firestore) {
      await this.firestore.collection("evidence_search_cache").doc(record.queryHash).set(record);
    }
  }

  // ============================================================================
  // 3. EVIDENCE CONFLICTS
  // ============================================================================

  public async createConflict(conflict: EvidenceConflict): Promise<void> {
    this.memoryConflicts.set(conflict.id, conflict);

    if (this.firestore) {
      await this.firestore.collection("evidence_conflicts").doc(conflict.id).set(conflict);
    }
  }

  public async listConflicts(schemeId?: string): Promise<EvidenceConflict[]> {
    if (this.firestore) {
      let query: admin.firestore.Query = this.firestore.collection("evidence_conflicts");
      if (schemeId) {
        query = query.where("schemeId", "==", schemeId);
      }
      const snap = await query.get();
      return snap.docs.map((d) => d.data() as EvidenceConflict);
    }

    return Array.from(this.memoryConflicts.values()).filter((c) => {
      if (schemeId && c.schemeId !== schemeId) return false;
      return true;
    });
  }

  public async getConflictById(id: string): Promise<EvidenceConflict | null> {
    if (this.memoryConflicts.has(id)) {
      return this.memoryConflicts.get(id) || null;
    }

    if (this.firestore) {
      const snap = await this.firestore.collection("evidence_conflicts").doc(id).get();
      if (snap.exists) {
        return snap.data() as EvidenceConflict;
      }
    }

    return null;
  }

  // ============================================================================
  // 4. AUDIT LOGS
  // ============================================================================

  public async createAuditLog(log: EvidenceAuditLog): Promise<void> {
    this.memoryAuditLogs.set(log.id, log);

    if (this.firestore) {
      await this.firestore.collection("evidence_audit_logs").doc(log.id).set(log);
    }
  }
}
