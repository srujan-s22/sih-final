import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { VERIFIED_PRODUCTION_SCHEMES, DEVELOPMENT_FIXTURE_SCHEMES } from "../src/services/eligibility/scheme-seed.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";

async function migrateFirestorePhase4C() {
  console.log("==================================================");
  console.log("SWASTHYASETU — PHASE 4C/5 FIRESTORE SAFE SCHEME MIGRATION");
  console.log("==================================================");

  const defaultCredPath = path.join(
    os.homedir(),
    ".config",
    "swasthyaSetu",
    "firebase-service-account.json"
  );
  const resolvedCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredPath;

  if (!fs.existsSync(resolvedCredPath)) {
    throw new Error(`Service account JSON not found at ${resolvedCredPath}`);
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

  const repo = new SchemeRepository(db);

  // 1. Deprecate obsolete Phase 4A/4B versions in Firestore so they don't conflict
  console.log("\n1. Safely deprecating previous versions...");
  const obsoleteVersions = [
    { schemeId: "ab-pmjay", versionId: "ver_abpmjay_2026_1" },
    { schemeId: "jsy", versionId: "ver_jsy_2026_1" },
  ];

  for (const obs of obsoleteVersions) {
    const docRef = db
      .collection("schemes")
      .doc(obs.schemeId)
      .collection("versions")
      .doc(obs.versionId);

    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({ status: "DEPRECATED" });
      console.log(`   ✓ Marked ${obs.schemeId}/${obs.versionId} as DEPRECATED.`);
    }
  }

  // 2. Migrate Verified Production Schemes (AB-PMJAY 70+ and JSY Delivery Verification)
  console.log("\n2. Migrating Verified Production Schemes to active version 2026.2...");
  for (const item of VERIFIED_PRODUCTION_SCHEMES) {
    console.log(`   Updating scheme: ${item.scheme.id} -> currentVersion: ${item.scheme.currentVersion}...`);
    await repo.createScheme(item.scheme);
    await repo.createSchemeVersion(item.scheme.id, item.version);
    console.log(`   ✓ Persisted version: ${item.version.id} (${item.version.status})`);
  }

  // 3. Migrate Development Fixtures (DRAFT / UNSUPPORTED)
  console.log("\n3. Migrating Development Fixtures to explicit DRAFT state...");
  for (const item of DEVELOPMENT_FIXTURE_SCHEMES) {
    console.log(`   Updating fixture: ${item.scheme.id} (status: ${item.scheme.status})...`);
    await repo.createScheme(item.scheme);
    await repo.createSchemeVersion(item.scheme.id, item.version);
    console.log(`   ✓ Persisted fixture version: ${item.version.id} (${item.version.status})`);
  }

  console.log("\n==================================================");
  console.log("PHASE 4C/5 FIRESTORE MIGRATION COMPLETE: SUCCESS");
  console.log("==================================================");
}

migrateFirestorePhase4C()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
