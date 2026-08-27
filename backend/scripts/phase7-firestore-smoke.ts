import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AICacheRepository } from "../src/repositories/ai-cache.repository.js";
import { AIIntelligenceCacheRecord } from "../../shared/types/ai.js";

async function runPhase7FirestoreSmoke() {
  console.log("==================================================");
  console.log("SWASTHYASETU — PHASE 7 REAL FIRESTORE AI CACHE SMOKE TEST");
  console.log("==================================================");

  const defaultCredPath = path.join(
    os.homedir(),
    ".config",
    "swasthyaSetu",
    "firebase-service-account.json"
  );
  const resolvedCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredPath;

  console.log(`Checking Firebase Admin credentials at: ${resolvedCredPath}`);
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

  const testContextHash = "hash_smoke_phase7_test_01";
  const repo = new AICacheRepository(db);

  try {
    // 1. Create Test AI Cache Record
    console.log(`\n1. Creating Test AI Cache in real Firestore: /ai_intelligence_cache/${testContextHash}...`);
    const testRecord: AIIntelligenceCacheRecord = {
      contextHash: testContextHash,
      capability: "EXPLAIN_ELIGIBILITY",
      contextVersion: "1.0",
      language: "en",
      response: {
        capability: "EXPLAIN_ELIGIBILITY",
        contextVersion: "1.0",
        language: "en",
        certainty: "GROUNDED",
        explanation: "Smoke test AI explanation: Senior citizen matches 70+ PM-JAY pathway.",
        evidenceReferences: [
          {
            evidenceId: "ev_smoke_ref_01",
            sourceTitle: "NHA Guidelines 70+",
            sourceOrganization: "National Health Authority",
            sourceUrl: "https://pmjay.gov.in/guidelines",
          },
        ],
        disclaimer: "Smoke test disclaimer.",
        generatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };

    await repo.setCache(testContextHash, testRecord);
    console.log("   ✓ AI Cache record created.");

    // 2. Read AI Cache Record
    console.log(`\n2. Reading AI Cache Record from real Firestore...`);
    const fetched = await repo.getCache(testContextHash);
    if (!fetched) {
      throw new Error("Failed to read created AI cache record from Firestore.");
    }
    console.log(`   ✓ Retrieved cache with certainty: ${fetched.certainty}`);
    console.log(`   ✓ CacheHit flag: ${fetched.cacheHit}`);
    console.log(`   ✓ Explanation: ${fetched.explanation}`);

    // 3. Targeted Cleanup
    console.log(`\n3. Performing targeted cleanup of smoke test cache document...`);
    await db.collection("ai_intelligence_cache").doc(testContextHash).delete();

    // Verify Cleanup
    const checkCache = await db.collection("ai_intelligence_cache").doc(testContextHash).get();
    if (checkCache.exists) {
      throw new Error("Cleanup failed: smoke test document still exists in Firestore.");
    }
    console.log("   ✓ Cleanup verified: smoke test cache cleanly removed.");

    console.log("\n==================================================");
    console.log("REAL FIRESTORE AI CACHE SMOKE TEST: PASS");
    console.log("AI CACHE PERSISTENCE & RETRIEVAL: PASS");
    console.log("CLEANUP: PASS");
    console.log("==================================================");
  } catch (err: unknown) {
    try {
      await db.collection("ai_intelligence_cache").doc(testContextHash).delete();
    } catch {}
    throw err;
  }
}

runPhase7FirestoreSmoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
