import * as admin from "firebase-admin";
import {
  AIIntelligenceCacheRecord,
  AIIntelligenceResponse,
} from "../../../shared/types/ai.js";

export class AICacheRepository {
  private firestore: admin.firestore.Firestore | null;

  // L1 In-memory cache & fallback test store
  private memoryCache = new Map<string, AIIntelligenceCacheRecord>();

  constructor(firestore?: admin.firestore.Firestore | null) {
    this.firestore = firestore || null;
  }

  public clearMemoryStore(): void {
    this.memoryCache.clear();
  }

  /**
   * Retrieves cached AI intelligence response if valid and not expired
   */
  public async getCache(contextHash: string): Promise<AIIntelligenceResponse | null> {
    const now = Date.now();

    // 1. Check L1 Memory Cache
    const memCached = this.memoryCache.get(contextHash);
    if (memCached) {
      if (new Date(memCached.expiresAt).getTime() > now) {
        return {
          ...memCached.response,
          cacheHit: true,
        };
      }
      this.memoryCache.delete(contextHash);
    }

    // 2. Check L2 Firestore Cache
    if (this.firestore) {
      const snap = await this.firestore
        .collection("ai_intelligence_cache")
        .doc(contextHash)
        .get();

      if (snap.exists) {
        const data = snap.data() as AIIntelligenceCacheRecord;
        if (new Date(data.expiresAt).getTime() > now) {
          this.memoryCache.set(contextHash, data);
          return {
            ...data.response,
            cacheHit: true,
          };
        }
      }
    }

    return null;
  }

  /**
   * Persists AI intelligence response to L1 memory and L2 Firestore cache
   */
  public async setCache(
    contextHash: string,
    record: AIIntelligenceCacheRecord
  ): Promise<void> {
    this.memoryCache.set(contextHash, record);

    if (this.firestore) {
      await this.firestore
        .collection("ai_intelligence_cache")
        .doc(contextHash)
        .set(record);
    }
  }
}
