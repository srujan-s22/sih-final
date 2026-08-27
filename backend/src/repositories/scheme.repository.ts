import { Firestore } from "firebase-admin/firestore";
import { Scheme, SchemeVersion } from "../../../shared/types/eligibility.js";
import { BaseFirestoreRepository } from "./firebase/base.repository.js";

export class SchemeRepository extends BaseFirestoreRepository<Scheme> {
  // In-memory store fallback ONLY for isolated automated unit tests
  private memorySchemes = new Map<string, Scheme>();
  private memoryVersions = new Map<string, Map<string, SchemeVersion>>(); // schemeId -> (versionId -> SchemeVersion)

  constructor(firestore: Firestore | null = null) {
    super("schemes", firestore);
  }

  private isUnitTestMode(): boolean {
    return process.env.NODE_ENV === "test";
  }

  /**
   * Retrieves a scheme document by its primary ID
   */
  public async getSchemeById(id: string): Promise<Scheme | null> {
    if (this.isUnitTestMode()) {
      const scheme = this.memorySchemes.get(id);
      return scheme ? { ...scheme } : null;
    }

    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Omit<Scheme, "id">) };
  }

  /**
   * Lists all active healthcare schemes
   */
  public async listActiveSchemes(): Promise<Scheme[]> {
    if (this.isUnitTestMode()) {
      return Array.from(this.memorySchemes.values())
        .filter((s) => s.status === "ACTIVE")
        .map((s) => ({ ...s }));
    }

    const querySnapshot = await this.getCollection()
      .where("status", "==", "ACTIVE")
      .get();

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Scheme, "id">),
    }));
  }

  /**
   * Creates a new scheme document
   */
  public async createScheme(scheme: Scheme): Promise<Scheme> {
    if (this.isUnitTestMode()) {
      this.memorySchemes.set(scheme.id, { ...scheme });
      return { ...scheme };
    }

    await this.getCollection().doc(scheme.id).set(scheme);
    return scheme;
  }

  /**
   * Updates an existing scheme document
   */
  public async updateScheme(
    id: string,
    updates: Partial<Scheme>
  ): Promise<Scheme | null> {
    if (this.isUnitTestMode()) {
      const existing = this.memorySchemes.get(id);
      if (!existing) {
        return null;
      }
      const updated: Scheme = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.memorySchemes.set(id, updated);
      return { ...updated };
    }

    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return null;
    }

    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updatedPayload, { merge: true });
    const fresh = await docRef.get();
    return { id: fresh.id, ...(fresh.data() as Omit<Scheme, "id">) };
  }

  /**
   * Retrieves the active version of a scheme
   */
  public async getActiveVersion(schemeId: string): Promise<SchemeVersion | null> {
    if (this.isUnitTestMode()) {
      const versionMap = this.memoryVersions.get(schemeId);
      if (!versionMap) return null;
      for (const v of versionMap.values()) {
        if (v.status === "ACTIVE") {
          return { ...v };
        }
      }
      return null;
    }

    const snapshot = await this.getCollection()
      .doc(schemeId)
      .collection("versions")
      .where("status", "==", "ACTIVE")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<SchemeVersion, "id">) };
  }

  /**
   * Retrieves a specific version of a scheme by versionId (e.g. "ver_2026_1")
   */
  public async getSchemeVersion(
    schemeId: string,
    versionId: string
  ): Promise<SchemeVersion | null> {
    if (this.isUnitTestMode()) {
      const versionMap = this.memoryVersions.get(schemeId);
      if (!versionMap) return null;
      const v = versionMap.get(versionId);
      return v ? { ...v } : null;
    }

    const doc = await this.getCollection()
      .doc(schemeId)
      .collection("versions")
      .doc(versionId)
      .get();

    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as Omit<SchemeVersion, "id">) };
  }

  /**
   * Creates a version document in the scheme's subcollection
   */
  public async createSchemeVersion(
    schemeId: string,
    version: SchemeVersion
  ): Promise<SchemeVersion> {
    if (this.isUnitTestMode()) {
      let versionMap = this.memoryVersions.get(schemeId);
      if (!versionMap) {
        versionMap = new Map();
        this.memoryVersions.set(schemeId, versionMap);
      }
      versionMap.set(version.id, { ...version });
      return { ...version };
    }

    await this.getCollection()
      .doc(schemeId)
      .collection("versions")
      .doc(version.id)
      .set(version);

    return version;
  }

  /**
   * Lists all versions for a scheme
   */
  public async listSchemeVersions(schemeId: string): Promise<SchemeVersion[]> {
    if (this.isUnitTestMode()) {
      const versionMap = this.memoryVersions.get(schemeId);
      if (!versionMap) return [];
      return Array.from(versionMap.values()).map((v) => ({ ...v }));
    }

    const snapshot = await this.getCollection()
      .doc(schemeId)
      .collection("versions")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SchemeVersion, "id">),
    }));
  }

  /**
   * Deletes a scheme and its in-memory/Firestore record (used in test cleanup)
   */
  public async deleteScheme(id: string): Promise<boolean> {
    if (this.isUnitTestMode()) {
      this.memoryVersions.delete(id);
      return this.memorySchemes.delete(id);
    }

    const docRef = this.getCollection().doc(id);
    await docRef.delete();
    return true;
  }

  /**
   * Clears in-memory test store
   */
  public clearMemoryStore(): void {
    this.memorySchemes.clear();
    this.memoryVersions.clear();
  }
}
