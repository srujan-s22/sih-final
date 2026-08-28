import { getFirestoreInstance } from "../src/config/firebase.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { AshaCase, CaseNote, CaseFollowUp, CaseActivity } from "../../shared/types/case.js";

async function runFirestoreCaseSmokeTest() {
  console.log("============================================================");
  console.log("PHASE 9: FIRESTORE CASE MANAGEMENT LIVE SMOKE TEST");
  console.log("============================================================");

  let firestore;
  try {
    firestore = getFirestoreInstance();
  } catch (err: any) {
    console.log("⚠️ Firestore not configured or credentials missing:", err.message);
    console.log("Skipping live Firestore network operations in non-configured environment.");
    return;
  }

  const caseRepo = new CaseRepository(firestore);
  const testAshaUid = `test-asha-smoke-${Date.now()}`;
  const unauthorizedAshaUid = `test-asha-unauth-${Date.now()}`;
  const testCaseId = `case-smoke-${Date.now()}`;
  const testHouseholdId = `hh-smoke-${Date.now()}`;
  const testNoteId = `note-smoke-${Date.now()}`;
  const testFollowUpId = `fu-smoke-${Date.now()}`;
  const testActivityId = `act-smoke-${Date.now()}`;

  console.log(`\n[STEP 1] Creating temporary test case: ${testCaseId}`);
  const now = new Date().toISOString();
  const testCase: AshaCase = {
    id: testCaseId,
    householdId: testHouseholdId,
    assignedAshaUid: testAshaUid,
    headOfHouseholdName: "Smoke Test Beneficiary",
    district: "Bengaluru Rural",
    state: "Karnataka",
    incomeCategory: "BPL",
    memberCount: 3,
    status: "NEW",
    priority: "NORMAL",
    detectedGapsCount: 1,
    eligibleSchemesCount: 1,
    lastContactAt: null,
    nextFollowUpAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await caseRepo.createCase(testCase);
  console.log("✓ Created case in Firestore");

  console.log(`\n[STEP 2] Verifying case retrieval by ID`);
  const fetched = await caseRepo.getCaseById(testCaseId);
  if (!fetched || fetched.id !== testCaseId) {
    throw new Error(`Failed to retrieve created test case ${testCaseId}`);
  }
  console.log(`✓ Retrieved case: ${fetched.headOfHouseholdName}`);

  console.log(`\n[STEP 3] Verifying ASHA assignment query`);
  const ashaCases = await caseRepo.listCasesByAsha(testAshaUid);
  if (ashaCases.length !== 1 || ashaCases[0].id !== testCaseId) {
    throw new Error(`ASHA query did not return expected case.`);
  }
  console.log(`✓ ASHA assigned query verified (1 case returned)`);

  console.log(`\n[STEP 4] Verifying IDOR isolation for unauthorized ASHA`);
  const unauthCases = await caseRepo.listCasesByAsha(unauthorizedAshaUid);
  if (unauthCases.length !== 0) {
    throw new Error(`Unauthorized ASHA query returned unassigned cases!`);
  }
  console.log(`✓ Unauthorized ASHA query returned 0 cases`);

  console.log(`\n[STEP 5] Testing Case Note subcollection`);
  const note: CaseNote = {
    id: testNoteId,
    caseId: testCaseId,
    authorUid: testAshaUid,
    authorName: "Smoke Test ASHA",
    content: "Temporary smoke test observation note.",
    createdAt: now,
  };
  await caseRepo.createNote(testCaseId, note);
  const notes = await caseRepo.getNotes(testCaseId);
  if (notes.length === 0 || notes[0].id !== testNoteId) {
    throw new Error(`Failed to retrieve created case note.`);
  }
  console.log(`✓ Case note subcollection verified`);

  console.log(`\n[STEP 6] Testing Case Follow-Up subcollection`);
  const followUp: CaseFollowUp = {
    id: testFollowUpId,
    caseId: testCaseId,
    scheduledAt: "2026-09-20T10:00:00.000Z",
    reason: "Smoke test follow-up task",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };
  await caseRepo.createFollowUp(testCaseId, followUp);
  const followUps = await caseRepo.getFollowUps(testCaseId);
  if (followUps.length === 0 || followUps[0].id !== testFollowUpId) {
    throw new Error(`Failed to retrieve created follow-up.`);
  }
  console.log(`✓ Case follow-up subcollection verified`);

  console.log(`\n[STEP 7] Testing Case Activity audit subcollection`);
  const activity: CaseActivity = {
    id: testActivityId,
    caseId: testCaseId,
    actorUid: testAshaUid,
    actorRole: "ASHA",
    actorName: "Smoke Test ASHA",
    type: "NOTE_ADDED",
    description: "Smoke test note added",
    timestamp: now,
  };
  await caseRepo.createActivity(testCaseId, activity);
  const activities = await caseRepo.getActivities(testCaseId);
  if (activities.length === 0 || activities[0].id !== testActivityId) {
    throw new Error(`Failed to retrieve created activity audit record.`);
  }
  console.log(`✓ Case activity audit subcollection verified`);

  console.log(`\n[STEP 8] CLEANUP: Deleting temporary test case and subcollections`);
  const deleted = await caseRepo.deleteCase(testCaseId);
  if (!deleted) {
    throw new Error(`Failed to delete temporary test case.`);
  }
  console.log(`✓ Case document and subcollections deleted`);

  console.log(`\n[STEP 9] Verifying cleanup`);
  const reCheck = await caseRepo.getCaseById(testCaseId);
  if (reCheck !== null) {
    throw new Error(`Temporary test case still exists after cleanup!`);
  }
  console.log(`✓ Cleanup verified: test case is completely absent`);

  console.log("\n============================================================");
  console.log("ALL FIRESTORE SMOKE TEST ASSERTIONS PASSED WITH ZERO RESIDUAL DATA");
  console.log("============================================================");
}

runFirestoreCaseSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FIRESTORE SMOKE TEST FAILED:", err);
    process.exit(1);
  });
