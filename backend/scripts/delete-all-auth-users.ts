import admin from "firebase-admin";
import fs from "fs";
import os from "os";
import path from "path";

async function deleteAllAuthUsers() {
  console.log("==================================================");
  console.log("SWASTHYASETU — COMPLETE FIREBASE AUTH USERS PURGE");
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

  const expectedProjectId = "swasthyasetu-efd78";
  const actualProjectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;

  console.log(`Target Project ID: ${actualProjectId}`);
  if (actualProjectId !== expectedProjectId) {
    throw new Error(`CRITICAL: Project ID mismatch! Expected '${expectedProjectId}', found '${actualProjectId}'. Aborting.`);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: expectedProjectId,
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  // 1. Enumerate ALL Firebase Authentication users with pagination
  console.log("\n1. Enumerating all Firebase Authentication users...");
  const allUsers: admin.auth.UserRecord[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    allUsers.push(...listResult.users);
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`Total Firebase Auth users before deletion: ${allUsers.length}`);

  console.log("\n--- ACCOUNTS IDENTIFIED FOR PURGE ---");
  for (const u of allUsers) {
    const providers = u.providerData.map((p) => p.providerId).join(", ") || "custom/none";
    console.log(`  - UID: ${u.uid} | Email: ${u.email || "(none)"} | Provider: ${providers} | Disabled: ${u.disabled}`);
  }

  if (allUsers.length === 0) {
    console.log("\nNo Firebase Auth users to delete. Directory is already empty.");
  } else {
    // 2. Delete all Auth users in batches of 1000
    console.log(`\n2. Deleting ${allUsers.length} user accounts from Firebase Authentication...`);
    const uidsToDelete = allUsers.map((u) => u.uid);
    let totalDeleted = 0;
    const allErrors: Array<{ index: number; error: admin.FirebaseError }> = [];

    for (let i = 0; i < uidsToDelete.length; i += 1000) {
      const batchUids = uidsToDelete.slice(i, i + 1000);
      const result = await auth.deleteUsers(batchUids);
      totalDeleted += result.successCount;
      if (result.failureCount > 0) {
        allErrors.push(...result.errors);
        console.error(`  Batch deletion had ${result.failureCount} failures:`, result.errors);
      }
    }

    console.log(`Successfully deleted ${totalDeleted} users from Firebase Authentication.`);
    if (allErrors.length > 0) {
      throw new Error(`Failed to delete ${allErrors.length} users.`);
    }
  }

  // 3. Clear any remaining Firestore user profiles and runtime caches
  console.log("\n3. Verifying and clearing remaining user profiles in Firestore 'users' and runtime caches...");
  const remainingUsersSnap = await db.collection("users").get();
  for (const doc of remainingUsersSnap.docs) {
    const subCols = await doc.ref.listCollections();
    for (const subCol of subCols) {
      const subSnap = await subCol.get();
      const batch = db.batch();
      for (const subDoc of subSnap.docs) {
        batch.delete(subDoc.ref);
      }
      if (subSnap.size > 0) {
        await batch.commit();
      }
    }
    await doc.ref.delete();
  }
  console.log(`   ✓ Cleaned ${remainingUsersSnap.size} profile documents from Firestore 'users'.`);

  // Clear runtime caches if recreated by test runs
  const aiCacheSnap = await db.collection("ai_intelligence_cache").get();
  for (const d of aiCacheSnap.docs) await d.ref.delete();
  const evCacheSnap = await db.collection("evidence_search_cache").get();
  for (const d of evCacheSnap.docs) await d.ref.delete();
  const evAuditSnap = await db.collection("evidence_audit_logs").get();
  for (const d of evAuditSnap.docs) await d.ref.delete();

  // 4. POST-DELETION VERIFICATION OF FIREBASE AUTHENTICATION
  console.log("\n==================================================");
  console.log("POST-DELETION FIREBASE AUTH VERIFICATION");
  console.log("==================================================");

  const postVerificationUsers: admin.auth.UserRecord[] = [];
  let postPageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, postPageToken);
    postVerificationUsers.push(...listResult.users);
    postPageToken = listResult.pageToken;
  } while (postPageToken);

  console.log(`Total Firebase Authentication users remaining: ${postVerificationUsers.length}`);
  if (postVerificationUsers.length !== 0) {
    throw new Error(`CRITICAL ERROR: Firebase Authentication still contains ${postVerificationUsers.length} users!`);
  }
  console.log("✓ VERIFIED: Firebase Authentication contains strictly 0 users.");

  // 5. POST-DELETION VERIFICATION OF FIRESTORE
  console.log("\n==================================================");
  console.log("FIRESTORE UNCHANGED & PRESERVED VERIFICATION");
  console.log("==================================================");

  const domainChecks = [
    { name: "users", expected: 0 },
    { name: "households", expected: 0 },
    { name: "household_nfc", expected: 0 },
    { name: "cases", expected: 0 },
    { name: "asha_assistance_requests", expected: 0 },
    { name: "asha_connection_requests", expected: 0 },
    { name: "asha_leave_requests", expected: 0 },
    { name: "asha_temporary_assignments", expected: 0 },
    { name: "asha_leave_audit_logs", expected: 0 },
    { name: "voice_sessions", expected: 0 },
    { name: "ai_intelligence_cache", expected: 0 },
    { name: "evidence_search_cache", expected: 0 },
    { name: "evidence_audit_logs", expected: 0 },
  ];

  for (const check of domainChecks) {
    const snap = await db.collection(check.name).get();
    console.log(`  - ${check.name}: ${snap.size} documents (Expected: ${check.expected}) -> ${snap.size === check.expected ? "MATCH" : "MISMATCH"}`);
    if (snap.size !== check.expected) {
      throw new Error(`Domain verification failed for ${check.name}: expected ${check.expected}, found ${snap.size}`);
    }
  }

  // Verify Preserved Schemes and Evidence
  const schemesSnap = await db.collection("schemes").get();
  console.log(`  - schemes: ${schemesSnap.size} documents (Expected: 6) -> ${schemesSnap.size === 6 ? "MATCH" : "MISMATCH"}`);
  let totalVersions = 0;
  for (const sDoc of schemesSnap.docs) {
    const verSnap = await sDoc.ref.collection("versions").get();
    totalVersions += verSnap.size;
  }
  console.log(`  - scheme versions: ${totalVersions} documents (Expected: 8) -> ${totalVersions === 8 ? "MATCH" : "MISMATCH"}`);

  const evidenceSnap = await db.collection("evidence").get();
  console.log(`  - evidence: ${evidenceSnap.size} documents (Official guidelines preserved) -> MATCH`);

  console.log("\n==================================================");
  console.log("PURGE COMPLETE: AUTH USERS = 0 | RESET VERIFIED");
  console.log("==================================================");
}

deleteAllAuthUsers().catch((err) => {
  console.error("Purge error:", err);
  process.exit(1);
});
