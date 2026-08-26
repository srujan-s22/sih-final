import { Firestore, DocumentData } from "firebase-admin/firestore";

export interface FilterCondition {
  field: string;
  operator: "<" | "<=" | "==" | "!=" | ">=" | ">" | "array-contains" | "in" | "array-contains-any";
  value: unknown;
}

export interface ListOptions {
  filters?: FilterCondition[];
  limit?: number;
  offset?: number;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Generic server-side repository abstraction over Cloud Firestore.
 * Ensures domain services and API routes interact with Firestore
 * through clean, testable, and typed boundaries.
 */
export class BaseFirestoreRepository<T extends DocumentData> {
  protected collectionName: string;
  protected firestore: Firestore | null;

  constructor(collectionName: string, firestore: Firestore | null = null) {
    this.collectionName = collectionName;
    this.firestore = firestore;
  }

  public setFirestore(firestore: Firestore): void {
    this.firestore = firestore;
  }

  protected getCollection() {
    if (!this.firestore) {
      throw new Error(
        `Cloud Firestore is not initialized. Cannot access collection '${this.collectionName}'.`
      );
    }
    return this.firestore.collection(this.collectionName);
  }

  public async getById(id: string): Promise<(T & { id: string }) | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...(doc.data() as T) };
  }

  public async create(id: string, data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T & { id: string }> {
    const now = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.getCollection().doc(id).set(payload);
    return { id, ...(payload as unknown as T) };
  }

  public async update(id: string, data: Partial<T>): Promise<(T & { id: string }) | null> {
    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return null;
    }

    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await docRef.update(payload);
    const updated = await docRef.get();
    return { id: updated.id, ...(updated.data() as T) };
  }

  public async delete(id: string): Promise<boolean> {
    const docRef = this.getCollection().doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return false;
    }
    await docRef.delete();
    return true;
  }

  public async list(options: ListOptions = {}): Promise<Array<T & { id: string }>> {
    let query: FirebaseFirestore.Query = this.getCollection();

    if (options.filters && options.filters.length > 0) {
      for (const f of options.filters) {
        query = query.where(f.field, f.operator, f.value);
      }
    }

    if (options.orderByField) {
      query = query.orderBy(options.orderByField, options.orderDirection || "desc");
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    if (options.offset && options.offset > 0) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as T),
    }));
  }
}
