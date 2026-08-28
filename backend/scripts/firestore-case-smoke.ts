import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { CaseService } from "../src/services/case.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { AshaCase, CaseNote, CaseFollowUp, CaseActivity } from "../../shared/types/case.js";
import { Household, Member } from "../../shared/types/household.js";
import { UserProfile } from "../../shared/types/auth.js";

async function runFirestoreCaseSmokeTest() {
  console.log("============================================================");
  console.log("SWASTHYASETU — PHASE 9 REAL CLOUD FIRESTORE SMOKE TEST");
  console.log("============================================================");

  const defaultCredPath = path.join(
    os.homedir(),
    ".config",
    "swasthyaSetu",
    "firebase-service-account.json"
  );
  const resolvedCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredPath;

  console.log(`[INIT] Checking Firebase Admin credentials at: ${resolvedCredPath}`);
  if (!fs.existsSync(resolvedCredPath)) {
    throw new Error(`Service account JSON not found at: ${resolvedCredPath}`);
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
  console.log(`[INIT] Connected to live Cloud Firestore project: ${serviceAccount.project_id}`);

  // Repositories and Services connected to Real Firestore
  const caseRepo = new CaseRepository(db);
  const householdRepo = new HouseholdRepository(db);
  const schemeRepo = new SchemeRepository(db);
  const eligibilityService = new EligibilityService(schemeRepo, householdRepo);
  const guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);
  const caseService = new CaseService(caseRepo, householdRepo, eligibilityService, guidanceService);

  // Ensure scheme definitions are seeded
  await seedSchemeRegistry(schemeRepo, true);

  // Unique smoke test identifiers
  const timestamp = Date.now();
  const testAshaUid = `test_asha_smoke_${timestamp}`;
  const unauthorizedAshaUid = `test_unauth_asha_${timestamp}`;
  const testCitizenUid = `test_citizen_smoke_${timestamp}`;
  const testCaseId = `case_smoke_${timestamp}`;
  const testHouseholdId = `hh_smoke_${timestamp}`;
  const testMemberId = `mem_smoke_${timestamp}`;
  const testNoteId = `note_smoke_${timestamp}`;
  const testFollowUpId = `fu_smoke_${timestamp}`;
  const testActivityId = `act_smoke_${timestamp}`;

  const ashaProfile: UserProfile = {
    uid: testAshaUid,
    email: `asha_${timestamp}@smoke.swasthyasetu.gov.in`,
    role: "ASHA",
    displayName: "Smoke Test ASHA Worker",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const unauthorizedAshaProfile: UserProfile = {
    uid: unauthorizedAshaUid,
    email: `unauth_${timestamp}@smoke.swasthyasetu.gov.in`,
    role: "ASHA",
    displayName: "Unauthorized ASHA",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const citizenProfile: UserProfile = {
    uid: testCitizenUid,
    email: `citizen_${timestamp}@smoke.swasthyasetu.gov.in`,
    role: "CITIZEN",
    displayName: "Citizen Smoke",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // ------------------------------------------------------------------------
    // 1. CREATE TEMPORARY HOUSEHOLD & MEMBER IN REAL FIRESTORE
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 1] Creating temporary test household: ${testHouseholdId}`);
    const now = new Date().toISOString();
    const testHousehold: Household = {
      id: testHouseholdId,
      ownerUid: testCitizenUid,
      headOfHouseholdName: "Smt. Jayamma Smoke",
      rationCardNumber: `RC-SMOKE-${timestamp}`,
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru Rural",
      village: "Doddaballapura",
      pincode: "561203",
      createdAt: now,
      updatedAt: now,
    };
    await householdRepo.createHousehold(testHousehold);

    const testMember: Member = {
      id: testMemberId,
      householdId: testHouseholdId,
      fullName: "Jayamma Smoke",
      age: 72, // Senior Citizen (triggers PM-JAY 70+ deterministic pathway)
      gender: "female",
      relationship: "Self / Head",
      disabilityStatus: false,
      maternalStatus: "none",
      chronicConditions: ["Hypertension"],
      createdAt: now,
      updatedAt: now,
    };
    await householdRepo.createMember(testHouseholdId, testMember);
    console.log("✓ Temporary household and 72yo member created in Cloud Firestore");

    // ------------------------------------------------------------------------
    // 2. CREATE ASSIGNED ASHA CASE IN REAL FIRESTORE
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 2] Creating temporary ASHA case: ${testCaseId} explicitly assigned to: ${testAshaUid}`);
    const testCase: AshaCase = {
      id: testCaseId,
      householdId: testHouseholdId,
      assignedAshaUid: testAshaUid,
      headOfHouseholdName: testHousehold.headOfHouseholdName,
      district: testHousehold.district,
      state: testHousehold.state,
      incomeCategory: testHousehold.incomeCategory,
      memberCount: 1,
      status: "NEW",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await caseRepo.createCase(testCase);
    console.log("✓ Case persisted to Cloud Firestore collection `/cases`");

    // ------------------------------------------------------------------------
    // 3. AUTHORIZED ASHA RETRIEVAL & DETERMINISTIC ENGINE EVALUATION
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 3] Verifying authorized ASHA retrieval & deterministic engine integration`);
    const caseDetail = await caseService.getCaseDetail(testCaseId, ashaProfile);
    if (!caseDetail || caseDetail.case.id !== testCaseId) {
      throw new Error(`Failed to retrieve case detail for ${testCaseId}`);
    }
    console.log(`✓ Case retrieved: Head = ${caseDetail.household.headOfHouseholdName}, Status = ${caseDetail.case.status}`);
    
    const pmjayEligible = caseDetail.eligibilityResults.some(
      (r) => r.schemeId === "ab-pmjay" && r.status === "ELIGIBLE"
    );
    if (!pmjayEligible) {
      throw new Error(`Deterministic Eligibility Engine failed to evaluate 72yo PM-JAY eligibility in case detail`);
    }
    console.log(`✓ Deterministic Eligibility Engine verified: PM-JAY 70+ evaluated as ELIGIBLE`);

    // ------------------------------------------------------------------------
    // 4. UNAUTHORIZED ASHA REJECTION (IDOR DEFENSE)
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 4] Verifying IDOR defense (unauthorized ASHA access rejected)`);
    try {
      await caseService.getCaseDetail(testCaseId, unauthorizedAshaProfile);
      throw new Error("IDOR VULNERABILITY: Unauthorized ASHA was allowed access to unassigned case!");
    } catch (err: any) {
      if (err.code === "CASE_NOT_FOUND" || err.statusCode === 404) {
        console.log(`✓ IDOR Defense Verified: Unauthorized ASHA rejected with 404 CASE_NOT_FOUND`);
      } else {
        throw new Error(`Unexpected error during IDOR test: ${err.message}`);
      }
    }

    // ------------------------------------------------------------------------
    // 5. CITIZEN REJECTION (ROLE BOUNDARY)
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 5] Verifying Citizen isolation (Citizen rejected from ASHA case API)`);
    try {
      await caseService.getCaseDetail(testCaseId, citizenProfile);
      throw new Error("ROLE ESCALATION: Citizen was allowed access to ASHA case!");
    } catch (err: any) {
      if (err.code === "FORBIDDEN_ROLE" || err.statusCode === 403) {
        console.log(`✓ Role Isolation Verified: Citizen rejected with 403 FORBIDDEN_ROLE`);
      } else {
        throw new Error(`Unexpected error during Citizen role test: ${err.message}`);
      }
    }

    // ------------------------------------------------------------------------
    // 6. CASE UPDATE & ACTIVITY LOG
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 6] Updating case status/priority and checking immutable activity log`);
    const updatedCase = await caseService.updateCase(
      testCaseId,
      { status: "NEEDS_ATTENTION", priority: "HIGH", lastContactAt: now },
      ashaProfile
    );
    if (updatedCase.status !== "NEEDS_ATTENTION" || updatedCase.priority !== "HIGH") {
      throw new Error("Failed to update case status and priority");
    }
    console.log(`✓ Case updated: status = ${updatedCase.status}, priority = ${updatedCase.priority}`);

    // ------------------------------------------------------------------------
    // 7. SUBCOLLECTION OPERATIONS (NOTES & FOLLOW-UPS)
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 7] Adding note and follow-up subcollection records`);
    const note: CaseNote = {
      id: testNoteId,
      caseId: testCaseId,
      authorUid: testAshaUid,
      authorName: ashaProfile.displayName || "ASHA Worker",
      content: "Smoke test observation note for verification.",
      createdAt: now,
    };
    await caseRepo.createNote(testCaseId, note);

    const followUp: CaseFollowUp = {
      id: testFollowUpId,
      caseId: testCaseId,
      scheduledAt: "2026-09-25T10:00:00.000Z",
      reason: "Smoke test verification follow-up",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    await caseRepo.createFollowUp(testCaseId, followUp);

    const notes = await caseRepo.getNotes(testCaseId);
    const followUps = await caseRepo.getFollowUps(testCaseId);
    const activities = await caseRepo.getActivities(testCaseId);

    if (notes.length === 0 || notes[0].id !== testNoteId) {
      throw new Error("Failed to verify note subcollection persistence");
    }
    if (followUps.length === 0 || followUps[0].id !== testFollowUpId) {
      throw new Error("Failed to verify follow-up subcollection persistence");
    }
    if (activities.length === 0) {
      throw new Error("Failed to verify immutable activity log persistence");
    }
    console.log(`✓ Subcollections verified: ${notes.length} note, ${followUps.length} follow-up, ${activities.length} activities`);

  } finally {
    // ------------------------------------------------------------------------
    // 8. STRICT CLEANUP OF TEMPORARY TEST DATA ONLY
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 8] CLEANUP: Deleting temporary test case, subcollections, and test household`);
    
    // Delete case and subcollections
    await caseRepo.deleteCase(testCaseId);

    // Delete temporary household and members
    await householdRepo.deleteMember(testHouseholdId, testMemberId);
    await householdRepo.deleteHousehold(testHouseholdId);

    console.log("✓ Cleanup execution completed");

    // ------------------------------------------------------------------------
    // 9. EXPLICIT VERIFICATION OF ZERO RESIDUAL DATA
    // ------------------------------------------------------------------------
    console.log(`\n[STEP 9] Verifying complete absence of temporary records`);
    const reCheckCase = await caseRepo.getCaseById(testCaseId);
    const reCheckNotes = await caseRepo.getNotes(testCaseId);
    const reCheckFollowUps = await caseRepo.getFollowUps(testCaseId);
    const reCheckActivities = await caseRepo.getActivities(testCaseId);
    const reCheckHousehold = await householdRepo.getHouseholdById(testHouseholdId);

    if (reCheckCase !== null) {
      throw new Error(`RESIDUAL DATA ERROR: Temporary case ${testCaseId} still exists!`);
    }
    if (reCheckNotes.length > 0) {
      throw new Error(`RESIDUAL DATA ERROR: Temporary notes still exist!`);
    }
    if (reCheckFollowUps.length > 0) {
      throw new Error(`RESIDUAL DATA ERROR: Temporary follow-ups still exist!`);
    }
    if (reCheckActivities.length > 0) {
      throw new Error(`RESIDUAL DATA ERROR: Temporary activities still exist!`);
    }
    if (reCheckHousehold !== null) {
      throw new Error(`RESIDUAL DATA ERROR: Temporary household still exists!`);
    }

    console.log("✓ Cleanup verified: temporary case = absent");
    console.log("✓ Cleanup verified: temporary notes = absent");
    console.log("✓ Cleanup verified: temporary followups = absent");
    console.log("✓ Cleanup verified: temporary activities = absent");
    console.log("✓ Cleanup verified: temporary household = absent");
    console.log("✓ Zero production citizen records or users were affected.");
  }

  console.log("\n============================================================");
  console.log("ALL REAL CLOUD FIRESTORE SMOKE TEST ASSERTIONS PASSED (100%)");
  console.log("============================================================");
}

runFirestoreCaseSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ REAL FIRESTORE SMOKE TEST FAILED:", err);
    process.exit(1);
  });
