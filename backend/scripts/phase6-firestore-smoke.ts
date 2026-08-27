import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { EvidenceRepository } from "../src/repositories/evidence.repository.js";
import {
  EvidenceRecord,
  EvidenceConflict,
  EvidenceSearchCacheRecord,
} from "../../shared/types/evidence.js";

async function runPhase6FirestoreSmoke() {
  console.log("==================================================");
  console.log("SWASTHYASETU — PHASE 6 REAL FIRESTORE EVIDENCE SMOKE TEST");
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

  const testEvidenceId = "ev_smoke_phase6_test_01";
  const testConflictId = "conflict_smoke_phase6_test_01";
  const testQueryHash = "hash_smoke_phase6_test_01";

  const repo = new EvidenceRepository(db);

  try {
    // 1. Create Test Evidence Record
    console.log(`\n1. Creating Test Evidence in real Firestore: /evidence/${testEvidenceId}...`);
    const testEvidence: EvidenceRecord = {
      id: testEvidenceId,
      schemeId: "ab-pmjay",
      schemeVersionId: "2026.2",
      claim: "70+ senior citizen universal healthcare cover",
      query: "ab-pmjay senior citizen 70+ guidelines",
      queryHash: testQueryHash,
      sourceUrl: "https://pmjay.gov.in/guidelines/senior-70",
      sourceDomain: "pmjay.gov.in",
      sourceOrganization: "National Health Authority (NHA)",
      officialTitle: "NHA AB-PMJAY 70+ Operational Guidelines",
      sourceType: "OFFICIAL_GOVERNMENT",
      documentType: "GUIDELINE",
      sourceCitation: "NHA Guidelines Sec 2.1",
      relevantExcerpt: "Universal healthcare cover for senior citizens aged 70 years and above.",
      retrievedAt: new Date().toISOString(),
      publishedAt: "2024-09-15",
      verificationStatus: "PENDING_REVIEW",
      contentHash: "content_hash_smoke_01",
      discoveredBy: "SMOKE_TEST",
      authorityScore: 95,
      relevanceScore: 95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createEvidence(testEvidence);
    console.log("   ✓ Evidence record created.");

    // 2. Read Evidence Record
    console.log(`\n2. Reading Evidence Record from real Firestore...`);
    const fetched = await repo.getEvidenceById(testEvidenceId);
    if (!fetched || fetched.id !== testEvidenceId) {
      throw new Error("Failed to read created evidence from Firestore.");
    }
    console.log(`   ✓ Retrieved evidence with verification status: ${fetched.verificationStatus}`);

    // 3. Update Verification Status (Admin Workflow)
    console.log(`\n3. Updating Verification Status to VERIFIED...`);
    const updated = await repo.updateVerificationStatus(
      testEvidenceId,
      "VERIFIED",
      "admin_smoke_user",
      "Audited against live NHA gazette guidelines."
    );
    if (!updated || updated.verificationStatus !== "VERIFIED") {
      throw new Error("Failed to update verification status.");
    }
    console.log(`   ✓ Updated status to VERIFIED by: ${updated.verifiedBy}`);

    // 4. Create and Read Search Cache Record
    console.log(`\n4. Testing /evidence_search_cache persistence...`);
    const cacheRecord: EvidenceSearchCacheRecord = {
      queryHash: testQueryHash,
      normalizedQuery: "ab-pmjay senior citizen 70+ guidelines",
      schemeId: "ab-pmjay",
      schemeVersionId: "2026.2",
      claim: "70+ senior citizen universal healthcare cover",
      resultCount: 1,
      evidenceIds: [testEvidenceId],
      retrievedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      provider: "tavily",
    };
    await repo.setSearchCache(cacheRecord);

    const fetchedCache = await repo.getSearchCache(testQueryHash);
    if (!fetchedCache || fetchedCache.queryHash !== testQueryHash) {
      throw new Error("Failed to retrieve search cache record.");
    }
    console.log("   ✓ Search cache persisted and verified.");

    // 5. Create and Read Conflict Record
    console.log(`\n5. Testing /evidence_conflicts persistence...`);
    const conflictRecord: EvidenceConflict = {
      id: testConflictId,
      schemeId: "ab-pmjay",
      schemeVersionId: "2026.2",
      newEvidenceId: testEvidenceId,
      claim: "70+ senior citizen universal healthcare cover",
      conflictType: "AGE_THRESHOLD_CHANGED",
      reason: "Smoke test conflict verification",
      detectedAt: new Date().toISOString(),
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.createConflict(conflictRecord);

    const fetchedConflict = await repo.getConflictById(testConflictId);
    if (!fetchedConflict || fetchedConflict.id !== testConflictId) {
      throw new Error("Failed to retrieve conflict record.");
    }
    console.log(`   ✓ Conflict record persisted with type: ${fetchedConflict.conflictType}`);

    // 6. Cleanup
    console.log(`\n6. Performing targeted cleanup of smoke test documents...`);
    await db.collection("evidence").doc(testEvidenceId).delete();
    await db.collection("evidence_search_cache").doc(testQueryHash).delete();
    await db.collection("evidence_conflicts").doc(testConflictId).delete();

    // Verify Cleanup
    const checkEv = await db.collection("evidence").doc(testEvidenceId).get();
    const checkCache = await db.collection("evidence_search_cache").doc(testQueryHash).get();
    const checkConflict = await db.collection("evidence_conflicts").doc(testConflictId).get();

    if (checkEv.exists || checkCache.exists || checkConflict.exists) {
      throw new Error("Cleanup failed: smoke test documents still exist in Firestore.");
    }
    console.log("   ✓ Cleanup verified: all smoke test documents cleanly removed.");

    console.log("\n==================================================");
    console.log("REAL FIRESTORE EVIDENCE SMOKE TEST: PASS");
    console.log("EVIDENCE PERSISTENCE & PROVENANCE: PASS");
    console.log("ADMIN VERIFICATION STATUS WORKFLOW: PASS");
    console.log("SEARCH CACHE L2 PERSISTENCE: PASS");
    console.log("NON-DESTRUCTIVE CONFLICT STORAGE: PASS");
    console.log("CLEANUP: PASS");
    console.log("==================================================");
  } catch (err: unknown) {
    try {
      await db.collection("evidence").doc(testEvidenceId).delete();
      await db.collection("evidence_search_cache").doc(testQueryHash).delete();
      await db.collection("evidence_conflicts").doc(testConflictId).delete();
    } catch {}
    throw err;
  }
}

runPhase6FirestoreSmoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
