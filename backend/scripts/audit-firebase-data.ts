import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

async function auditFirebaseData() {
  console.log("==================================================");
  console.log("SWASTHYASETU — AUDIT LIVE FIREBASE DATA");
  console.log("==================================================");

  const defaultCredPath = path.join(
    os.homedir(),
    ".config",
    "swasthyaSetu",
    "firebase-service-account.json"
  );
  const resolvedCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredPath;

  if (!fs.existsSync(resolvedCredPath)) {
    throw new Error(`Credentials not found at ${resolvedCredPath}`);
  }

  const rawJson = fs.readFileSync(resolvedCredPath, "utf-8");
  const serviceAccount = JSON.parse(rawJson);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "swasthyasetu-efd78",
    });
  }

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  console.log(`Connected to live Cloud Firestore project: ${serviceAccount.project_id}`);

  // 1. Discover all root collections
  const collections = await db.listCollections();
  console.log(`\nFound ${collections.length} root collections in Firestore:`);

  const auditReport: Array<{
    collection: string;
    docCount: number;
    subcollections: Record<string, number>;
    sampleDocIds: string[];
  }> = [];

  for (const col of collections) {
    const colName = col.id;
    const snap = await col.get();
    const docCount = snap.size;
    const sampleDocIds = snap.docs.slice(0, 5).map((d) => d.id);
    const subcollections: Record<string, number> = {};

    // Check for known or dynamically listed subcollections
    for (const doc of snap.docs) {
      const subCols = await doc.ref.listCollections();
      for (const subCol of subCols) {
        const subSnap = await subCol.get();
        subcollections[subCol.id] = (subcollections[subCol.id] || 0) + subSnap.size;
      }
    }

    auditReport.push({
      collection: colName,
      docCount,
      subcollections,
      sampleDocIds,
    });
  }

  console.log("\n--- FIRESTORE COLLECTIONS AUDIT ---");
  for (const item of auditReport) {
    console.log(`\nCollection: "${item.collection}"`);
    console.log(`  Document Count: ${item.docCount}`);
    console.log(`  Sample IDs: ${item.sampleDocIds.join(", ") || "(none)"}`);
    if (Object.keys(item.subcollections).length > 0) {
      console.log(`  Subcollections:`, item.subcollections);
    }
  }

  // 2. Audit Firebase Authentication Users
  console.log("\n--- FIREBASE AUTHENTICATION USERS AUDIT ---");
  try {
    const auth = admin.auth();
    const userRecords = await auth.listUsers(1000);
    console.log(`Total Firebase Auth users found: ${userRecords.users.length}`);
    for (const u of userRecords.users) {
      console.log(`  - UID: ${u.uid} | Email: ${u.email || "(no email)"} | Phone: ${u.phoneNumber || "(no phone)"} | Created: ${u.metadata.creationTime} | Provider: ${u.providerData.map(p => p.providerId).join(",")}`);
    }
  } catch (authErr) {
    console.error("Failed to list Firebase Auth users:", authErr);
  }

  console.log("\n==================================================");
  console.log("AUDIT COMPLETE — NO DATA MODIFIED");
  console.log("==================================================");
}

auditFirebaseData().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
