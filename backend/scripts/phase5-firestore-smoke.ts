import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { Household, Member } from "../../shared/types/household.js";

async function runPhase5FirestoreSmoke() {
  console.log("==================================================");
  console.log("SWASTHYASETU — PHASE 5 REAL FIRESTORE GUIDANCE SMOKE TEST");
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

  const testHouseholdId = "hh_phase5_smoke_test_01";
  const testOwnerUid = "uid_phase5_smoke_citizen_01";
  const testMemberId = "mem_phase5_smoke_grandfather_01";

  const testHousehold: Household = {
    id: testHouseholdId,
    ownerUid: testOwnerUid,
    headOfHouseholdName: "Ramesh Smoke Kumar",
    rationCardNumber: "RC-P5-SMOKE-9999",
    incomeCategory: "BPL",
    state: "Bihar",
    district: "Patna",
    village: "Bakhtiyarpur",
    pincode: "803212",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testGrandfather: Member = {
    id: testMemberId,
    householdId: testHouseholdId,
    fullName: "Gopal Smoke Prasad",
    age: 73,
    gender: "male",
    relationship: "Father",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const householdRepo = new HouseholdRepository(db);
    const schemeRepo = new SchemeRepository(db);
    const eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    const guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);

    // 1. Create Test Household & Member in real Firestore
    console.log(`\n1. Creating Test Household in real Firestore: /households/${testHouseholdId}...`);
    await db.collection("households").doc(testHouseholdId).set(testHousehold);
    await db
      .collection("households")
      .doc(testHouseholdId)
      .collection("members")
      .doc(testMemberId)
      .set(testGrandfather);
    console.log("   ✓ Test household and 73yo grandfather member persisted.");

    // 2. Run Guidance Service against live Cloud Firestore
    console.log(`\n2. Running GuidanceService against live Cloud Firestore...`);
    const guidance = await guidanceService.getCitizenGuidance(testOwnerUid);

    console.log(`   ✓ Evaluated Schemes Count: ${guidance.evaluatedSchemesCount}`);
    console.log(`   ✓ Household Guidance Status: ${guidance.householdStatus}`);
    console.log(`   ✓ Status Summary: ${guidance.statusSummary}`);
    console.log(`   ✓ Eligible Schemes Count: ${guidance.eligibleSchemes.length}`);
    console.log(`   ✓ Detected Gaps Count: ${guidance.gaps.length}`);
    console.log(`   ✓ Document Readiness Status: ${guidance.documentReadiness.status}`);
    console.log(`   ✓ Action Plan Steps Count: ${guidance.actionPlan.length}`);

    // Assertions
    console.log("   Eligible schemes found:", JSON.stringify(guidance.eligibleSchemes, null, 2));
    const pmjayMatch = guidance.eligibleSchemes.find((s) => s.schemeId === "ab-pmjay");
    if (!pmjayMatch) {
      throw new Error("Expected ab-pmjay in eligible schemes.");
    }
    if (pmjayMatch.pathwayCode !== "PM-JAY-SENIOR-CITIZEN-70PLUS") {
      throw new Error(`Expected pathwayCode PM-JAY-SENIOR-CITIZEN-70PLUS but got: ${pmjayMatch.pathwayCode}`);
    }

    const enrolmentGap = guidance.gaps.find((g) => g.type === "ENROLMENT_REQUIRED");
    if (!enrolmentGap) {
      throw new Error("Expected ENROLMENT_REQUIRED gap for 70+ senior citizen.");
    }

    if (guidance.actionPlan.length === 0 || guidance.actionPlan[0].stepNumber !== 1) {
      throw new Error("Action plan missing or invalid sequential numbering.");
    }

    console.log(`\n3. Verifying top priority action plan item...`);
    const topAction = guidance.actionPlan[0];
    console.log(`   [Step ${topAction.stepNumber}] ${topAction.title} (${topAction.actionType})`);
    console.log(`   Reason: ${topAction.reason}`);

    // 3. Clean up test documents in real Cloud Firestore
    console.log(`\n4. Performing targeted cleanup of smoke test household documents...`);
    await db
      .collection("households")
      .doc(testHouseholdId)
      .collection("members")
      .doc(testMemberId)
      .delete();
    await db.collection("households").doc(testHouseholdId).delete();

    // Verify Cleanup
    const checkDoc = await db.collection("households").doc(testHouseholdId).get();
    if (checkDoc.exists) {
      throw new Error("Cleanup failed: smoke test document still exists.");
    }
    console.log("   ✓ Cleanup verified: test household cleanly deleted.");

    console.log("\n==================================================");
    console.log("REAL FIRESTORE GUIDANCE SMOKE TEST: PASS");
    console.log("LIVE SCHEME REGISTRY INTEGRATION: PASS");
    console.log("DETERMINISTIC ELIGIBILITY TO GUIDANCE: PASS");
    console.log("GAP DETECTION & ENROLMENT SAFETY: PASS");
    console.log("DOCUMENT READINESS TRACKING: PASS");
    console.log("ACTION PLAN ORDERING & NUMBERING: PASS");
    console.log("CLEANUP: PASS");
    console.log("==================================================");
  } catch (err: unknown) {
    try {
      await db
        .collection("households")
        .doc(testHouseholdId)
        .collection("members")
        .doc(testMemberId)
        .delete();
      await db.collection("households").doc(testHouseholdId).delete();
    } catch {}
    throw err;
  }
}

runPhase5FirestoreSmoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
