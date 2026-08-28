/**
 * Phase 9.1 — Live Cloud Firestore ASHA Connection Smoke Test
 * 
 * Verifies the end-to-end Citizen <-> ASHA Household Connection workflow on live Cloud Firestore:
 * 1. ASHA profile initialization with unique Service Code (ASHA-KA-XXXX).
 * 2. Public directory resolution (ensures no UID, email, phone leak).
 * 3. Citizen household creation & connection request submission (PENDING).
 * 4. ASHA request queue retrieval & cross-ASHA IDOR defense.
 * 5. ASHA connection acceptance -> automatic Phase 9 AshaCase creation/assignment & audit logging.
 * 6. Citizen status query verification (ACTIVE).
 * 7. Complete teardown & deletion of all test records (leaves 0 artifacts).
 * 
 * Run with: npx tsx backend/scripts/phase9-1-asha-connection-smoke.ts
 */

import admin from "firebase-admin";
import { ConnectionRepository } from "../src/repositories/connection.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { ConnectionService } from "../src/services/connection.service.js";
import { UserProfile } from "../../shared/types/auth.js";
import { Household } from "../../shared/types/household.js";
import { env } from "../src/config/env.js";

async function runSmokeTest() {
  console.log("================================================================================");
  console.log("   SWASTHYASETU: PHASE 9.1 ASHA CONNECTION LIVE FIRESTORE SMOKE TEST           ");
  console.log("================================================================================");

  let app: admin.app.App;
  if (admin.apps.length === 0) {
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      app = admin.initializeApp({ projectId: "swasthyasetu-efd78" });
    }
  } else {
    app = admin.apps[0]!;
  }

  const firestore = admin.firestore(app);
  console.log(`[INFO] Connected to live Cloud Firestore (Project: ${app.options.projectId || "swasthyasetu-efd78"})\n`);

  const connectionRepo = new ConnectionRepository(firestore);
  const userRepo = new UserRepository(firestore);
  const householdRepo = new HouseholdRepository(firestore);
  const caseRepo = new CaseRepository(firestore);

  const connectionService = new ConnectionService(
    connectionRepo,
    userRepo,
    householdRepo,
    caseRepo
  );

  const now = new Date().toISOString();
  const testRunId = `p91_${Date.now()}`;
  const ashaUid = `smoke_asha_${testRunId}`;
  const otherAshaUid = `smoke_other_asha_${testRunId}`;
  const citizenUid = `smoke_citizen_${testRunId}`;
  const householdId = `smoke_hh_${testRunId}`;
  const serviceCode = `ASHA-KA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  let createdRequestId: string | null = null;
  let createdCaseId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Create Live Test ASHA Worker with Service Code
    // -------------------------------------------------------------------------
    console.log(`[STEP 1] Initializing live ASHA worker profile with Service Code: ${serviceCode}...`);
    const ashaProfile: UserProfile = {
      uid: ashaUid,
      email: `asha.${testRunId}@karnataka.gov.in`,
      displayName: "Deepa Hegde",
      phoneNumber: "+919876543210",
      role: "ASHA",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      ashaServiceCode: serviceCode,
      serviceArea: "Doddaballapura Sub-Center",
      createdAt: now,
      updatedAt: now,
    };
    await userRepo.createUserProfile(ashaProfile);

    // Also create another ASHA worker for IDOR testing
    const otherAshaProfile: UserProfile = {
      uid: otherAshaUid,
      email: `other.asha.${testRunId}@karnataka.gov.in`,
      displayName: "Kavita Gowda",
      phoneNumber: "+919876543211",
      role: "ASHA",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      ashaServiceCode: `ASHA-KA-OTHR`,
      serviceArea: "Devanahalli Primary Center",
      createdAt: now,
      updatedAt: now,
    };
    await userRepo.createUserProfile(otherAshaProfile);
    console.log(" -> [PASS] Live ASHA profiles created.\n");

    // -------------------------------------------------------------------------
    // STEP 2: Create Live Citizen User & Household
    // -------------------------------------------------------------------------
    console.log(`[STEP 2] Initializing live Citizen user & household (${householdId})...`);
    const citizenProfile: UserProfile = {
      uid: citizenUid,
      email: `citizen.${testRunId}@test.swasthyasetu.gov.in`,
      displayName: "Venkatesh Prasad",
      phoneNumber: "+919123456789",
      role: "CITIZEN",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await userRepo.createUserProfile(citizenProfile);

    const household: Household = {
      id: householdId,
      ownerUid: citizenUid,
      headOfHouseholdName: "Venkatesh Prasad",
      rationCardNumber: "RC-KA-SMOKE91",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bangalore Rural",
      village: "Doddaballapura",
      pincode: "561203",
      contactPhone: "9123456789",
      members: [],
      createdAt: now,
      updatedAt: now,
    };
    await householdRepo.createHousehold(household);
    console.log(" -> [PASS] Live Citizen user and household profile created.\n");

    // -------------------------------------------------------------------------
    // STEP 3: Verify Public Directory Resolution (Zero UID Leak)
    // -------------------------------------------------------------------------
    console.log(`[STEP 3] Resolving public directory information for Service Code: ${serviceCode}...`);
    const publicInfo = await connectionService.resolveAshaServiceCode(serviceCode);
    console.log("   Directory Info:", JSON.stringify(publicInfo));
    if (publicInfo.displayName !== "Deepa Hegde" || publicInfo.serviceCode !== serviceCode) {
      throw new Error("Directory resolution mismatch!");
    }
    if ((publicInfo as any).uid || (publicInfo as any).email || (publicInfo as any).phoneNumber) {
      throw new Error("SECURITY VIOLATION: Sensitive profile fields leaked in public directory!");
    }
    console.log(" -> [PASS] Public directory verified (100% privacy boundary intact).\n");

    // -------------------------------------------------------------------------
    // STEP 4: Citizen Submits Connection Request
    // -------------------------------------------------------------------------
    console.log(`[STEP 4] Citizen submitting connection request to ASHA ${serviceCode}...`);
    const connRequest = await connectionService.requestConnection(
      citizenProfile,
      serviceCode,
      "Seeking doorstep guidance for Ayushman Bharat enrollment."
    );
    createdRequestId = connRequest.id;
    console.log(`   Request Created: ID = ${connRequest.id}, Status = ${connRequest.status}`);
    if (connRequest.status !== "PENDING" || connRequest.ashaUid !== ashaUid) {
      throw new Error("Invalid connection request state!");
    }
    console.log(" -> [PASS] Connection request successfully created with PENDING status.\n");

    // -------------------------------------------------------------------------
    // STEP 5: ASHA Lists Pending Queue
    // -------------------------------------------------------------------------
    console.log(`[STEP 5] ASHA (${ashaUid}) querying incoming connection requests...`);
    const ashaQueue = await connectionService.listPendingRequestsForAsha(ashaProfile);
    console.log(`   Found ${ashaQueue.length} pending request(s) in queue.`);
    const matchingReq = ashaQueue.find((r) => r.id === createdRequestId);
    if (!matchingReq) {
      throw new Error("Pending connection request not found in ASHA queue!");
    }
    console.log(" -> [PASS] Connection request visible in designated ASHA queue.\n");

    // -------------------------------------------------------------------------
    // STEP 6: Verify IDOR Defense on Request Acceptance
    // -------------------------------------------------------------------------
    console.log(`[STEP 6] Testing cross-ASHA IDOR protection with unauthorized worker (${otherAshaUid})...`);
    try {
      await connectionService.acceptConnectionRequest(createdRequestId, otherAshaProfile);
      throw new Error("SECURITY FAILURE: Unauthorized ASHA worker was able to accept cross-worker request!");
    } catch (err: any) {
      if (err.message && err.message.includes("not found or access denied")) {
        console.log(` -> [PASS] IDOR defense successfully blocked unauthorized acceptance (${err.message})`);
      } else {
        throw err;
      }
    }
    console.log();

    // -------------------------------------------------------------------------
    // STEP 7: Authorized ASHA Accepts Connection Request
    // -------------------------------------------------------------------------
    console.log(`[STEP 7] Authorized ASHA (${ashaUid}) accepting connection request...`);
    const acceptedConn = await connectionService.acceptConnectionRequest(
      createdRequestId,
      ashaProfile,
      "Household location verified. Scheduled for next field visit."
    );
    if (acceptedConn.status !== "ACTIVE") {
      throw new Error("Connection request status failed to transition to ACTIVE!");
    }
    console.log(" -> [PASS] Connection request transitioned to ACTIVE.\n");

    // -------------------------------------------------------------------------
    // STEP 8: Verify Phase 9 AshaCase Automatic Synchronization
    // -------------------------------------------------------------------------
    console.log(`[STEP 8] Verifying authoritative Phase 9 AshaCase integration for household ${householdId}...`);
    const authoritativeCase = await caseRepo.getCaseByHouseholdId(householdId);
    if (!authoritativeCase) {
      throw new Error("AshaCase was not created upon connection acceptance!");
    }
    createdCaseId = authoritativeCase.id;
    console.log(`   Authoritative Case: ID = ${authoritativeCase.id}, Assigned ASHA = ${authoritativeCase.assignedAshaUid}`);
    if (authoritativeCase.assignedAshaUid !== ashaUid) {
      throw new Error("AshaCase assignedAshaUid does not match accepting ASHA worker!");
    }

    const activities = await caseRepo.getActivities(authoritativeCase.id);
    console.log(`   Found ${activities.length} audit activity record(s) on case.`);
    if (activities.length === 0) {
      throw new Error("No audit activity logged for connection acceptance!");
    }
    console.log(" -> [PASS] Phase 9 AshaCase model automatically synchronized and audit logged.\n");

    // -------------------------------------------------------------------------
    // STEP 9: Citizen Queries Connection Status
    // -------------------------------------------------------------------------
    console.log(`[STEP 9] Citizen querying household connection status...`);
    const citizenStatus = await connectionService.getCitizenConnectionStatus(citizenProfile);
    console.log(`   Citizen Connection Status: ${citizenStatus.status}, ASHA: ${citizenStatus.asha?.displayName}`);
    if (citizenStatus.status !== "ACTIVE" || citizenStatus.asha?.serviceCode !== serviceCode) {
      throw new Error("Citizen connection status does not reflect ACTIVE state!");
    }
    console.log(" -> [PASS] Citizen dashboard receives authoritative ACTIVE status.\n");

    console.log("================================================================================");
    console.log("   SMOKE TEST VERIFICATION SUCCESSFUL (100% CHECKS PASSED)                      ");
    console.log("================================================================================");
  } finally {
    // -------------------------------------------------------------------------
    // STEP 10: Complete Teardown & Cleanup
    // -------------------------------------------------------------------------
    console.log("\n[CLEANUP] Tearing down test records on live Firestore...");
    if (createdRequestId) {
      await connectionRepo.deleteRequest(createdRequestId);
      console.log(` - Deleted connection request: ${createdRequestId}`);
    }
    if (createdCaseId) {
      await caseRepo.deleteCase(createdCaseId);
      console.log(` - Deleted case: ${createdCaseId}`);
    }
    await householdRepo.deleteHousehold(householdId);
    console.log(` - Deleted household: ${householdId}`);
    await firestore.collection("users").doc(ashaUid).delete();
    await firestore.collection("users").doc(otherAshaUid).delete();
    await firestore.collection("users").doc(citizenUid).delete();
    console.log(` - Deleted test users: ${ashaUid}, ${otherAshaUid}, ${citizenUid}`);
    console.log("[CLEANUP] Cleanup complete. 0 residual test documents remain.");
  }
}

runSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[FATAL] Smoke test failed:", err);
    process.exit(1);
  });
