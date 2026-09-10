import admin from "firebase-admin";
import fs from "fs";
import os from "os";
import path from "path";

interface ResetPlanItem {
  collection: string;
  docCount: number;
  subcollections: Record<string, number>;
  action: "RESET" | "PRESERVE" | "UNKNOWN";
  reason: string;
}

const TEST_EMAIL_PATTERNS = [
  /^test.*@gmail\.com$/i,
  /^admin@gmail\.com$/i,
  /^asha.*@gmail\.com$/i,
  /^citizen.*@gmail\.com$/i,
  /^abc@gmail\.com$/i,
  /^chai@gmail\.com$/i,
];

const TEST_UID_EXACT = [
  "prod-test-citizen-01",
  "test-prod-assistant-citizen",
  "test_probe_uid",
  "test_probe_user_99",
  "EiNs487GCMPXZgQ0rKzQ2j7CjsG3", // old test02 Firestore profile
];

function isIdentifiedTestAccount(uid: string, email?: string | null): boolean {
  if (TEST_UID_EXACT.includes(uid)) return true;
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email.trim()));
}

async function runReset(isDryRun: boolean) {
  console.log("==================================================");
  console.log(`SWASTHYASETU — ${isDryRun ? "DRY RUN AUDIT" : "REAL CONTROLLED RESET"}`);
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

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "swasthyasetu-efd78",
    });
  }

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  const auth = admin.auth();

  console.log(`Connected to Firebase project: ${serviceAccount.project_id}\n`);

  // 1. Audit all root collections
  const collections = await db.listCollections();
  const resetPlan: ResetPlanItem[] = [];

  for (const col of collections) {
    const colName = col.id;
    const snap = await col.get();
    const docCount = snap.size;
    const subcollections: Record<string, number> = {};

    for (const doc of snap.docs) {
      const subCols = await doc.ref.listCollections();
      for (const subCol of subCols) {
        const subSnap = await subCol.get();
        subcollections[subCol.id] = (subcollections[subCol.id] || 0) + subSnap.size;
      }
    }

    let action: "RESET" | "PRESERVE" | "UNKNOWN" = "UNKNOWN";
    let reason = "";

    switch (colName) {
      case "schemes":
        action = "PRESERVE";
        reason = "Authoritative government scheme registry and eligibility versions";
        break;
      case "evidence":
        action = "PRESERVE";
        reason = "Authoritative government guidelines and official evidence library";
        break;
      case "evidence_conflicts":
        action = "PRESERVE";
        reason = "Official conflict resolution rules repository";
        break;
      case "households":
        action = "RESET";
        reason = "Test/demo household profiles and member rosters";
        break;
      case "cases":
        action = "RESET";
        reason = "Field casework, follow-ups, timeline activities, and tasks";
        break;
      case "household_nfc":
        action = "RESET";
        reason = "Runtime NFC credentials and rotation states";
        break;
      case "asha_assistance_requests":
        action = "RESET";
        reason = "Citizen-initiated assistance requests";
        break;
      case "asha_connection_requests":
        action = "RESET";
        reason = "Citizen-to-ASHA connection links";
        break;
      case "asha_leave_requests":
        action = "RESET";
        reason = "ASHA worker leave requests";
        break;
      case "asha_temporary_assignments":
        action = "RESET";
        reason = "Temporary caseload delegations during leave";
        break;
      case "asha_leave_audit_logs":
        action = "RESET";
        reason = "Leave and delegation audit records";
        break;
      case "voice_sessions":
        action = "RESET";
        reason = "Telephony AI helpline session records";
        break;
      case "ai_intelligence_cache":
        action = "RESET";
        reason = "Cached AI explanation and query responses";
        break;
      case "evidence_search_cache":
        action = "RESET";
        reason = "Cached external evidence search queries";
        break;
      case "evidence_audit_logs":
        action = "RESET";
        reason = "Runtime search query audit logs";
        break;
      case "consent_records":
        action = "RESET";
        reason = "Legacy early test consent record";
        break;
      case "users":
        action = "RESET";
        reason = "Test/demo user profiles (clean test accounts will be deleted, unknown preserved)";
        break;
      default:
        action = "UNKNOWN";
        reason = "Unrecognized collection requiring manual verification";
        break;
    }

    resetPlan.push({
      collection: colName,
      docCount,
      subcollections,
      action,
      reason,
    });
  }

  // 2. Audit Firebase Auth Users
  const authUsers = await auth.listUsers(1000);
  const testAuthUsers: admin.auth.UserRecord[] = [];
  const preservedAuthUsers: admin.auth.UserRecord[] = [];

  for (const u of authUsers.users) {
    if (isIdentifiedTestAccount(u.uid, u.email)) {
      testAuthUsers.push(u);
    } else {
      preservedAuthUsers.push(u);
    }
  }

  // 3. Print Dry Run Table
  console.log("==================================================");
  console.log("DRY RUN INVENTORY SUMMARY");
  console.log("==================================================");
  console.log("\nCOLLECTIONS TO RESET:");
  for (const item of resetPlan.filter((p) => p.action === "RESET")) {
    console.log(`  - ${item.collection}: ${item.docCount} docs (subcollections: ${JSON.stringify(item.subcollections)})`);
    console.log(`    Reason: ${item.reason}`);
  }

  console.log("\nCOLLECTIONS TO PRESERVE:");
  for (const item of resetPlan.filter((p) => p.action === "PRESERVE")) {
    console.log(`  - ${item.collection}: ${item.docCount} docs (subcollections: ${JSON.stringify(item.subcollections)})`);
    console.log(`    Reason: ${item.reason}`);
  }

  const unknownCollections = resetPlan.filter((p) => p.action === "UNKNOWN");
  if (unknownCollections.length > 0) {
    console.log("\nUNKNOWN COLLECTIONS FOUND (HALTING DELETION):");
    for (const item of unknownCollections) {
      console.log(`  - ${item.collection}: ${item.docCount} docs`);
    }
    return;
  } else {
    console.log("\nUNKNOWN COLLECTIONS: NONE");
  }

  console.log("\nFIREBASE AUTHENTICATION ACCOUNTS:");
  console.log(`  - Identified Test Accounts to DELETE: ${testAuthUsers.length}`);
  for (const u of testAuthUsers) {
    console.log(`      * ${u.uid} (${u.email || "no email"})`);
  }
  console.log(`  - Preserved/Unknown Accounts to KEEP: ${preservedAuthUsers.length}`);
  for (const u of preservedAuthUsers) {
    console.log(`      * ${u.uid} (${u.email || "no email"})`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN COMPLETE — NO CHANGES COMMITTED]");
    return;
  }

  // ============================================================================
  // EXECUTION PHASE
  // ============================================================================
  console.log("\n==================================================");
  console.log("EXECUTING CONTROLLED RESET");
  console.log("==================================================");

  // Helper to efficiently delete a document and its immediate subcollections
  async function deleteDocWithSubcollections(docRef: FirebaseFirestore.DocumentReference) {
    const subCols = await docRef.listCollections();
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
    await docRef.delete();
  }

  // 1. Reset Cases (with notes, followups, tasks, activities)
  console.log("\n1. Resetting 'cases'...");
  const casesSnap = await db.collection("cases").get();
  for (const doc of casesSnap.docs) {
    await deleteDocWithSubcollections(doc.ref);
  }
  console.log(`   ✓ Deleted ${casesSnap.size} case documents and all nested subcollections.`);

  // 2. Reset Households (with members)
  console.log("\n2. Resetting 'households'...");
  const hhSnap = await db.collection("households").get();
  for (const doc of hhSnap.docs) {
    await deleteDocWithSubcollections(doc.ref);
  }
  console.log(`   ✓ Deleted ${hhSnap.size} household documents and members subcollections.`);

  // 3. Reset Household NFC Credentials
  console.log("\n3. Resetting 'household_nfc'...");
  const nfcSnap = await db.collection("household_nfc").get();
  for (const doc of nfcSnap.docs) {
    await deleteDocWithSubcollections(doc.ref);
  }
  console.log(`   ✓ Deleted ${nfcSnap.size} NFC credentials.`);

  // 4. Reset ASHA Assistance & Connection Requests
  console.log("\n4. Resetting 'asha_assistance_requests' and 'asha_connection_requests'...");
  const asstSnap = await db.collection("asha_assistance_requests").get();
  for (const doc of asstSnap.docs) {
    await doc.ref.delete();
  }
  const connSnap = await db.collection("asha_connection_requests").get();
  for (const doc of connSnap.docs) {
    await doc.ref.delete();
  }
  console.log(`   ✓ Deleted ${asstSnap.size} assistance requests and ${connSnap.size} connection requests.`);

  // 5. Reset ASHA Leave & Temporary Assignments
  console.log("\n5. Resetting 'asha_leave_requests', 'asha_temporary_assignments', 'asha_leave_audit_logs'...");
  const leaveSnap = await db.collection("asha_leave_requests").get();
  for (const doc of leaveSnap.docs) await doc.ref.delete();
  const tasgnSnap = await db.collection("asha_temporary_assignments").get();
  for (const doc of tasgnSnap.docs) await doc.ref.delete();
  const auditSnap = await db.collection("asha_leave_audit_logs").get();
  for (const doc of auditSnap.docs) await doc.ref.delete();
  console.log(`   ✓ Deleted ${leaveSnap.size} leave requests, ${tasgnSnap.size} temporary assignments, and ${auditSnap.size} leave audit logs.`);

  // 6. Reset Voice Sessions & Caches
  console.log("\n6. Resetting 'voice_sessions', 'ai_intelligence_cache', 'evidence_search_cache', 'evidence_audit_logs', 'consent_records'...");
  const vsesSnap = await db.collection("voice_sessions").get();
  for (const doc of vsesSnap.docs) await doc.ref.delete();
  const aiCacheSnap = await db.collection("ai_intelligence_cache").get();
  for (const doc of aiCacheSnap.docs) await doc.ref.delete();
  const evCacheSnap = await db.collection("evidence_search_cache").get();
  for (const doc of evCacheSnap.docs) await doc.ref.delete();
  const evAuditSnap = await db.collection("evidence_audit_logs").get();
  for (const doc of evAuditSnap.docs) await doc.ref.delete();
  const consentSnap = await db.collection("consent_records").get();
  for (const doc of consentSnap.docs) await doc.ref.delete();
  console.log(`   ✓ Deleted caches, voice sessions, and legacy consent records.`);

  // 7. Reset User Profiles in Firestore (only for test accounts)
  console.log("\n7. Resetting test user profiles in 'users'...");
  let deletedUserProfilesCount = 0;
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (isIdentifiedTestAccount(doc.id, data.email)) {
      await deleteDocWithSubcollections(doc.ref);
      deletedUserProfilesCount++;
    }
  }
  console.log(`   ✓ Deleted ${deletedUserProfilesCount} test user profiles and consent histories.`);

  // 8. Delete Identified Test Accounts from Firebase Authentication
  console.log("\n8. Deleting identified test accounts from Firebase Authentication...");
  let deletedAuthCount = 0;
  for (const u of testAuthUsers) {
    await auth.deleteUser(u.uid);
    deletedAuthCount++;
  }
  console.log(`   ✓ Deleted ${deletedAuthCount} test user accounts from Firebase Authentication.`);
  console.log(`   ✓ Preserved ${preservedAuthUsers.length} unknown/team user accounts.`);

  // ============================================================================
  // POST-RESET VERIFICATION PHASE
  // ============================================================================
  console.log("\n==================================================");
  console.log("POST-RESET LIVE QUERY VERIFICATION");
  console.log("==================================================");

  const verifyCollections = [
    "households",
    "household_nfc",
    "cases",
    "asha_assistance_requests",
    "asha_connection_requests",
    "asha_leave_requests",
    "asha_temporary_assignments",
    "asha_leave_audit_logs",
    "voice_sessions",
    "ai_intelligence_cache",
    "evidence_search_cache",
    "evidence_audit_logs",
    "consent_records",
  ];

  console.log("\n--- VERIFYING RESET COLLECTIONS (EXPECTED: 0) ---");
  for (const colName of verifyCollections) {
    const snap = await db.collection(colName).get();
    console.log(`  - ${colName}: ${snap.size} documents (Verified clean: ${snap.size === 0 ? "YES" : "NO"})`);
    if (snap.size > 0) {
      console.error(`    ERROR: ${colName} still contains ${snap.size} documents!`);
    }
  }

  // Verify subcollections of households and cases using collectionGroup or parent check
  const anyCases = await db.collection("cases").get();
  console.log(`  - cases subcollections remaining: ${anyCases.size === 0 ? 0 : "CHECK"}`);
  const anyHh = await db.collection("households").get();
  console.log(`  - households subcollections remaining: ${anyHh.size === 0 ? 0 : "CHECK"}`);

  console.log("\n--- VERIFYING PRESERVED COLLECTIONS ---");
  const schemesSnap = await db.collection("schemes").get();
  console.log(`  - schemes: ${schemesSnap.size} documents (PRESERVED)`);
  for (const sDoc of schemesSnap.docs) {
    const verSnap = await sDoc.ref.collection("versions").get();
    console.log(`      * Scheme ${sDoc.id}: ${verSnap.size} versions intact`);
  }

  const evidenceSnap = await db.collection("evidence").get();
  console.log(`  - evidence: ${evidenceSnap.size} documents (PRESERVED)`);

  const remainingUsersSnap = await db.collection("users").get();
  console.log(`  - users: ${remainingUsersSnap.size} documents (Preserved team profiles only)`);
  for (const uDoc of remainingUsersSnap.docs) {
    const uData = uDoc.data();
    console.log(`      * ${uDoc.id} (${uData.email || "no email"})`);
  }

  const remainingAuthUsers = await auth.listUsers(1000);
  console.log(`\n--- VERIFYING FIREBASE AUTH USERS ---`);
  console.log(`  - Total remaining Auth accounts: ${remainingAuthUsers.users.length}`);
  for (const u of remainingAuthUsers.users) {
    console.log(`      * UID: ${u.uid} | Email: ${u.email || "(no email)"}`);
  }

  console.log("\n==================================================");
  console.log("CONTROLLED RESET & VERIFICATION COMPLETE");
  console.log("==================================================");
}

const isDryRun = !process.argv.includes("--execute");
runReset(isDryRun).catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
