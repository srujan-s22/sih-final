import { Firestore } from "firebase-admin/firestore";

export class FirebaseService {
  constructor(private firestore: Firestore | null) {}

  public getStatus() {
    return {
      connected: this.firestore !== null,
      provider: "Cloud Firestore",
    };
  }
}
