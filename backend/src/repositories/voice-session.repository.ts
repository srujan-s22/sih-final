import { Firestore } from "firebase-admin/firestore";
import { VoiceSession } from "../../../shared/types/voice.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class VoiceSessionRepository extends BaseFirestoreRepository<VoiceSession> {
  private memoryStore = new Map<string, VoiceSession>();

  constructor(firestore: Firestore | null = null) {
    super("voice_sessions", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test" || !this.firestore;
  }

  public clearMemoryStore(): void {
    this.memoryStore.clear();
  }

  public async createSession(session: VoiceSession): Promise<VoiceSession> {
    if (this.isUnitTestMode()) {
      this.memoryStore.set(session.id, { ...session });
      return { ...session };
    }

    try {
      await this.getCollection().doc(session.id).set(session);
      this.memoryStore.set(session.id, { ...session });
      return session;
    } catch {
      this.memoryStore.set(session.id, { ...session });
      return session;
    }
  }

  public async getSessionById(sessionId: string): Promise<VoiceSession | null> {
    if (this.isUnitTestMode()) {
      const found = this.memoryStore.get(sessionId);
      return found ? { ...found } : null;
    }

    try {
      const doc = await this.getCollection().doc(sessionId).get();
      if (!doc.exists) return null;
      return doc.data() as VoiceSession;
    } catch {
      const found = this.memoryStore.get(sessionId);
      return found ? { ...found } : null;
    }
  }

  public async getSessionByCallSid(callSid: string): Promise<VoiceSession | null> {
    if (this.isUnitTestMode()) {
      for (const session of this.memoryStore.values()) {
        if (session.callSid === callSid) {
          return { ...session };
        }
      }
      return null;
    }

    try {
      const snapshot = await this.getCollection()
        .where("callSid", "==", callSid)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as VoiceSession;
    } catch {
      for (const session of this.memoryStore.values()) {
        if (session.callSid === callSid) {
          return { ...session };
        }
      }
      return null;
    }
  }

  public async updateSession(
    sessionId: string,
    updates: Partial<VoiceSession>
  ): Promise<VoiceSession | null> {
    const existing = await this.getSessionById(sessionId);
    if (!existing) return null;

    const merged: VoiceSession = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.isUnitTestMode()) {
      this.memoryStore.set(sessionId, merged);
      return { ...merged };
    }

    try {
      await this.getCollection().doc(sessionId).set(merged, { merge: true });
      this.memoryStore.set(sessionId, merged);
      return merged;
    } catch {
      this.memoryStore.set(sessionId, merged);
      return merged;
    }
  }

  public async listRecentSessionsForAdmin(limitCount: number = 20): Promise<VoiceSession[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memoryStore.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitCount);
    }

    try {
      const snapshot = await this.getCollection()
        .orderBy("createdAt", "desc")
        .limit(limitCount)
        .get();

      return snapshot.docs.map((d) => d.data() as VoiceSession);
    } catch {
      return Array.from(this.memoryStore.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitCount);
    }
  }

  public async countSessionsToday(): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    noAnswer: number;
    averageDuration: number;
  }> {
    const todayStr = new Date().toISOString().split("T")[0];
    const all = Array.from(this.memoryStore.values()).filter(
      (s) => s.createdAt.startsWith(todayStr)
    );

    let active = 0;
    let completed = 0;
    let failed = 0;
    let noAnswer = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const s of all) {
      if (s.status === "ACTIVE" || s.status === "PROCESSING" || s.status === "RESPONDING") {
        active++;
      } else if (s.callOutcome === "CALL_COMPLETED" || s.status === "COMPLETED") {
        completed++;
      } else if (s.callOutcome === "CALL_FAILED" || s.status === "FAILED") {
        failed++;
      } else if (s.callOutcome === "CALL_NO_ANSWER" || s.callOutcome === "CALL_BUSY") {
        noAnswer++;
      }

      if (s.durationSeconds && s.durationSeconds > 0) {
        totalDuration += s.durationSeconds;
        durationCount++;
      }
    }

    return {
      total: all.length,
      active,
      completed,
      failed,
      noAnswer,
      averageDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    };
  }
}
