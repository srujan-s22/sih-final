import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { UserProfile } from "../../shared/types/auth.js";
import { AshaCase } from "../../shared/types/case.js";
import { Household } from "../../shared/types/household.js";

describe("ASHA Leave Request + Temporary Reassignment (Production Safety & Judge Scenarios)", () => {
  let app: FastifyInstance;

  const ashaAToken = "test_token_ashaA_asha";
  const ashaBToken = "test_token_ashaB_asha";
  const ashaCToken = "test_token_ashaC_asha";
  const adminToken = "test_token_admin1_admin";
  const citizenToken = "test_token_citizen1_citizen";

  const ashaAProfile: UserProfile = {
    uid: "ashaA",
    email: "anjali.asha@karnataka.gov.in",
    displayName: "Anjali Devi",
    phoneNumber: "+919876543201",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-09-01T00:00:00Z",
    ashaServiceCode: "ASHA-KA-1001",
    serviceArea: "Ward 12, Doddaballapura",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  const ashaBProfile: UserProfile = {
    uid: "ashaB",
    email: "meera.asha@karnataka.gov.in",
    displayName: "Meera Bai",
    phoneNumber: "+919876543202",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-09-01T00:00:00Z",
    ashaServiceCode: "ASHA-KA-1002",
    serviceArea: "Ward 14, Doddaballapura",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  const ashaCProfile: UserProfile = {
    uid: "ashaC",
    email: "radha.asha@karnataka.gov.in",
    displayName: "Radha Kumari",
    phoneNumber: "+919876543203",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-09-01T00:00:00Z",
    ashaServiceCode: "ASHA-KA-1003",
    serviceArea: "Ward 15, Doddaballapura",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  const adminProfile: UserProfile = {
    uid: "admin1",
    email: "admin@swasthyasetu.gov.in",
    displayName: "Dr. Vikram Admin",
    phoneNumber: "+919876543299",
    role: "ADMIN",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-09-01T00:00:00Z",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  const establishConsent = async (token: string) => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${token}` },
      payload: { consentVersion: "1.0", accepted: true },
    });
  };

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.leaveRepository.clearMemoryStore();

    await app.userRepository.createUserProfile(ashaAProfile);
    await app.userRepository.createUserProfile(ashaBProfile);
    await app.userRepository.createUserProfile(ashaCProfile);
    await app.userRepository.createUserProfile(adminProfile);

    await establishConsent(ashaAToken);
    await establishConsent(ashaBToken);
    await establishConsent(ashaCToken);
    await establishConsent(adminToken);
    await establishConsent(citizenToken);
  });

  const createSampleCase = async (caseId: string, householdId: string, ashaUid: string): Promise<AshaCase> => {
    const household: Household = {
      id: householdId,
      ownerUid: `cit_${householdId}`,
      headOfHouseholdName: `Family Head of ${householdId}`,
      rationCardNumber: `RC-${householdId}`,
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bangalore Rural",
      village: "Doddaballapura",
      pincode: "561203",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await app.householdRepository.createHousehold(household);

    const newCase: AshaCase = {
      id: caseId,
      householdId,
      assignedAshaUid: ashaUid,
      headOfHouseholdName: household.headOfHouseholdName,
      district: household.district,
      state: household.state,
      incomeCategory: household.incomeCategory,
      memberCount: 4,
      status: "IN_PROGRESS",
      priority: "HIGH",
      detectedGapsCount: 2,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await app.caseRepository.createCase(newCase);
    return newCase;
  };

  // --------------------------------------------------------------------------
  // TEST 1: ASHA can create own leave request with valid dates and reason
  // --------------------------------------------------------------------------
  it("1. ASHA can create own leave request with valid dates and reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Attending annual PHC community healthcare training program.",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.leaveRequest.ashaId).toBe("ashaA");
    expect(body.data.leaveRequest.status).toBe("PENDING");
    expect(body.data.leaveRequest.startDate).toBe("2026-09-10");
    expect(body.data.leaveRequest.endDate).toBe("2026-09-14");
    expect(body.data.leaveRequest.effectiveUntil).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // TEST 2: ASHA cannot create leave request for another ASHA (derived server-side)
  // --------------------------------------------------------------------------
  it("2. ASHA cannot spoof identity; ashaId is strictly derived from authenticated token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        ashaId: "ashaB", // Malicious spoof attempt in payload
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Spoofing attempt for other worker",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
    const body = res.json();
    // Must strictly be ashaA, ignoring payload ashaId
    expect(body.data.leaveRequest.ashaId).toBe("ashaA");
  });

  // --------------------------------------------------------------------------
  // TEST 3: Non-ASHA (CITIZEN) cannot create ASHA leave request
  // --------------------------------------------------------------------------
  it("3. Non-ASHA (CITIZEN) cannot create ASHA leave request (403 Forbidden)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Citizen trying to submit ASHA leave",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    const body = res.json();
    expect(body.code).toBe("INSUFFICIENT_ROLE");
  });

  // --------------------------------------------------------------------------
  // TEST 4: Admin can view all requests; ASHA can only view own (IDOR prevention)
  // --------------------------------------------------------------------------
  it("4. Admin can view all requests; ASHA can only view own (IDOR protection)", async () => {
    // A creates a leave request
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Family wedding in home district.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    // ASHA B tries to view ASHA A's leave request by ID -> 403 Forbidden
    const idorRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/leave-requests/${leaveId}`,
      headers: { authorization: `Bearer ${ashaBToken}` },
    });
    expect(idorRes.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // Admin views ASHA A's leave request -> 200 OK
    const adminRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/leave-requests/${leaveId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminRes.statusCode).toBe(HTTP_STATUS.OK);

    // Admin lists all leave requests -> 200 OK
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/leave-requests",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(listRes.json().data.leaveRequests.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Non-admin cannot approve requests
  // --------------------------------------------------------------------------
  it("5. Non-admin cannot approve leave requests (403 Forbidden)", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical checkup and recovery.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${ashaBToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(approveRes.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Admin cannot approve already approved request
  // --------------------------------------------------------------------------
  it("6. Admin cannot approve an already approved request (400 LEAVE_NOT_PENDING)", async () => {
    await createSampleCase("case_1", "hh_1", "ashaA");

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical recovery.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    // First approval
    const appRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(appRes1.statusCode).toBe(HTTP_STATUS.OK);

    // Second approval attempt -> 400 Bad Request
    const appRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(appRes2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(appRes2.json().code).toBe("LEAVE_NOT_PENDING");
  });

  // --------------------------------------------------------------------------
  // TEST 7: Admin must select a valid replacement
  // --------------------------------------------------------------------------
  it("7. Admin approval requires selecting a replacement ASHA", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical leave.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Replacement cannot equal original ASHA
  // --------------------------------------------------------------------------
  it("8. Replacement ASHA cannot equal the original ASHA taking leave", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical leave.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaA" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(res.json().code).toBe("REPLACEMENT_CANNOT_BE_SELF");
  });

  // --------------------------------------------------------------------------
  // TEST 9: Inactive / non-existent user cannot be selected as replacement
  // --------------------------------------------------------------------------
  it("9. Non-existent or non-ASHA user cannot be selected as replacement", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical leave.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    // Non-existent user
    const res1 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "non_existent_uid" },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // Citizen user
    const res2 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "citizen1" },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(res2.json().code).toBe("INVALID_REPLACEMENT_ROLE");
  });

  // --------------------------------------------------------------------------
  // TEST 10, 11, 12: Approval reassigns affected households, preserves metadata and case data
  // --------------------------------------------------------------------------
  it("10-12. Approval reassigns affected households; case history, tasks & notes remain intact", async () => {
    const c1 = await createSampleCase("case_101", "hh_101", "ashaA");
    await app.caseRepository.createTask("case_101", {
      id: "task_1",
      caseId: "case_101",
      type: "ENROLLMENT",
      title: "Ayushman Card e-KYC Verification",
      description: "Verify Aadhaar biometric",
      status: "IN_PROGRESS",
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await app.caseRepository.createNote("case_101", {
      id: "note_1",
      caseId: "case_101",
      authorUid: "ashaA",
      authorName: "Anjali Devi",
      content: "Family contacted, documents ready.",
      createdAt: new Date().toISOString(),
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Family emergency in Mysore.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    // Approve with replacement ASHA B
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(approveRes.statusCode).toBe(HTTP_STATUS.OK);
    const approveBody = approveRes.json().data;
    expect(approveBody.reassignedCount).toBe(1);
    expect(approveBody.requiresReview).toBe(false);

    // Verify case in database
    const freshCase = await app.caseRepository.getCaseById("case_101");
    expect(freshCase?.assignedAshaUid).toBe("ashaB"); // Reassigned to B
    expect(freshCase?.temporaryAssignment).toBeDefined();
    expect(freshCase?.temporaryAssignment?.originalAshaUid).toBe("ashaA");
    expect(freshCase?.temporaryAssignment?.temporaryAshaUid).toBe("ashaB");
    expect(freshCase?.temporaryAssignment?.leaveRequestId).toBe(leaveId);
    expect(freshCase?.temporaryAssignment?.status).toBe("ACTIVE");

    // Existing tasks and notes must be completely intact!
    const tasks = await app.caseRepository.getTasks("case_101");
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Ayushman Card e-KYC Verification");

    const notes = await app.caseRepository.getNotes("case_101");
    expect(notes.length).toBe(1);
    expect(notes[0].content).toBe("Family contacted, documents ready.");

    // ASHA B now sees this case in their caseload
    const bCases = await app.caseRepository.listCasesByAsha("ashaB");
    expect(bCases.some((c) => c.id === "case_101")).toBe(true);

    // ASHA A does not see this case in their active caseload during leave
    const aCases = await app.caseRepository.listCasesByAsha("ashaA");
    expect(aCases.some((c) => c.id === "case_101")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 13: Expired temporary assignment restores original ASHA
  // --------------------------------------------------------------------------
  it("13. Expired temporary assignment automatically restores to original ASHA", async () => {
    await createSampleCase("case_201", "hh_201", "ashaA");

    // Create a leave request with effectiveUntil in the past
    const pastEffectiveUntil = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_past_001",
      ashaId: "ashaA",
      ashaName: "Anjali Devi",
      ashaServiceCode: "ASHA-KA-1001",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      effectiveUntil: pastEffectiveUntil,
      reason: "Completed past leave.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Meera Bai",
      reviewedBy: "admin1",
      reviewedByName: "Dr. Vikram Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: "Approved",
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    // Case is currently assigned to ashaB with active temporary metadata
    await app.caseRepository.updateCase("case_201", {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-01",
        effectiveUntil: pastEffectiveUntil,
        reason: "Past leave",
        assignedAt: "2026-09-01T08:00:00Z",
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_201",
      leaveRequestId: leaveReq.id,
      caseId: "case_201",
      householdId: "hh_201",
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-01",
      effectiveUntil: pastEffectiveUntil,
      reason: "Past leave",
      status: "ACTIVE",
      createdAt: "2026-09-01T08:00:00Z",
      createdBy: "admin1",
    });

    // Run lazy restoration evaluation
    const restoreRes = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(restoreRes.evaluatedLeavesCount).toBe(1);
    expect(restoreRes.restoredCount).toBe(1);
    expect(restoreRes.completedLeavesCount).toBe(1);

    // Verify case is restored to ashaA
    const restoredCase = await app.caseRepository.getCaseById("case_201");
    expect(restoredCase?.assignedAshaUid).toBe("ashaA");
    expect(restoredCase?.temporaryAssignment?.status).toBe("COMPLETED");

    // Verify leave request is marked COMPLETED / RESTORED
    const updatedLeave = await app.leaveRepository.getLeaveRequestById(leaveReq.id);
    expect(updatedLeave?.status).toBe("COMPLETED");
    expect(updatedLeave?.restorationStatus).toBe("RESTORED");
  });

  // --------------------------------------------------------------------------
  // TEST 14: Inactive original ASHA does not get automatic restoration
  // --------------------------------------------------------------------------
  it("14. Inactive original ASHA does not get automatic restoration (requires admin review)", async () => {
    await createSampleCase("case_301", "hh_301", "ashaA");

    // Deactivate original ASHA A by changing role or removing
    await app.userRepository.updateUserProfile("ashaA", { role: "CITIZEN" });

    const pastEffectiveUntil = new Date(Date.now() - 3600000).toISOString();
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_inactive_001",
      ashaId: "ashaA",
      ashaName: "Anjali Devi",
      ashaServiceCode: "ASHA-KA-1001",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      effectiveUntil: pastEffectiveUntil,
      reason: "Past leave before retirement.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Meera Bai",
      reviewedBy: "admin1",
      reviewedByName: "Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: null,
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    await app.caseRepository.updateCase("case_301", {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-01",
        effectiveUntil: pastEffectiveUntil,
        reason: "Past leave",
        assignedAt: "2026-09-01T08:00:00Z",
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_301",
      leaveRequestId: leaveReq.id,
      caseId: "case_301",
      householdId: "hh_301",
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-01",
      effectiveUntil: pastEffectiveUntil,
      reason: "Past leave",
      status: "ACTIVE",
      createdAt: "2026-09-01T08:00:00Z",
      createdBy: "admin1",
    });

    const restoreRes = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(restoreRes.restoredCount).toBe(0);
    expect(restoreRes.reviewRequiredLeavesCount).toBe(1);

    // Case must remain with replacement ASHA B
    const caseAfter = await app.caseRepository.getCaseById("case_301");
    expect(caseAfter?.assignedAshaUid).toBe("ashaB");

    // Leave request is flagged REQUIRES_REVIEW
    const updatedLeave = await app.leaveRepository.getLeaveRequestById(leaveReq.id);
    expect(updatedLeave?.restorationStatus).toBe("REQUIRES_REVIEW");
  });

  // --------------------------------------------------------------------------
  // TEST 15: Manual reassignment during leave prevents automatic restoration
  // --------------------------------------------------------------------------
  it("15. Manual reassignment during leave supersedes temporary assignment and prevents restoration", async () => {
    await createSampleCase("case_401", "hh_401", "ashaA");

    const pastEffectiveUntil = new Date(Date.now() - 3600000).toISOString();
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_manual_override_001",
      ashaId: "ashaA",
      ashaName: "Anjali Devi",
      ashaServiceCode: "ASHA-KA-1001",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      effectiveUntil: pastEffectiveUntil,
      reason: "Past leave.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Meera Bai",
      reviewedBy: "admin1",
      reviewedByName: "Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: null,
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    // Household temporarily assigned to ASHA B
    await app.caseRepository.updateCase("case_401", {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-01",
        effectiveUntil: pastEffectiveUntil,
        reason: "Past leave",
        assignedAt: "2026-09-01T08:00:00Z",
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_401",
      leaveRequestId: leaveReq.id,
      caseId: "case_401",
      householdId: "hh_401",
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-01",
      effectiveUntil: pastEffectiveUntil,
      reason: "Past leave",
      status: "ACTIVE",
      createdAt: "2026-09-01T08:00:00Z",
      createdBy: "admin1",
    });

    // During leave, administrator manually moves this case to ASHA C via assignCaseToAsha!
    const assignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        householdId: "hh_401",
        ashaUid: "ashaC",
      },
    });
    expect(assignRes.statusCode).toBe(HTTP_STATUS.OK);

    // Verify case now has temporaryAssignment status SUPERSEDED_BY_MANUAL
    const overriddenCase = await app.caseRepository.getCaseById("case_401");
    expect(overriddenCase?.assignedAshaUid).toBe("ashaC");
    expect(overriddenCase?.temporaryAssignment?.status).toBe("SUPERSEDED_BY_MANUAL");

    // When leave expires and restoration runs:
    const restoreRes = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(restoreRes.skippedCount).toBe(1);

    // Case MUST REMAIN with ASHA C! Never restored back to ASHA A
    const finalCase = await app.caseRepository.getCaseById("case_401");
    expect(finalCase?.assignedAshaUid).toBe("ashaC");

    // Leave request is flagged as REQUIRES_REVIEW
    const finalLeave = await app.leaveRepository.getLeaveRequestById(leaveReq.id);
    expect(finalLeave?.restorationStatus).toBe("REQUIRES_REVIEW");
  });

  // --------------------------------------------------------------------------
  // TEST 16: Duplicate approval is safe / idempotent
  // --------------------------------------------------------------------------
  it("16. Duplicate approval submission is safely rejected and does not duplicate state", async () => {
    await createSampleCase("case_501", "hh_501", "ashaA");

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Medical treatment.",
      },
    });
    const leaveId = createRes.json().data.leaveRequest.id;

    // Send first approval
    const res1 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.OK);

    // Immediate second approval attempt
    const res2 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaC" },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

    // Verify case was assigned to B and not corrupted to C
    const c = await app.caseRepository.getCaseById("case_501");
    expect(c?.assignedAshaUid).toBe("ashaB");
  });

  // --------------------------------------------------------------------------
  // TEST 17: Overlapping active leave requests for same ASHA are rejected
  // --------------------------------------------------------------------------
  it("17. Overlapping active leave requests for the same ASHA are rejected (409 Conflict)", async () => {
    // Submit first leave: Sep 10 - Sep 15
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        reason: "First sanctioned leave block.",
      },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.CREATED);

    // Overlap attempt 1: Sep 12 - Sep 18
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-12",
        endDate: "2026-09-18",
        reason: "Overlapping leave block.",
      },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.CONFLICT);
    expect(res2.json().code).toBe("OVERLAPPING_LEAVE_REQUEST");

    // Exact duplicate attempt
    const res3 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        reason: "Duplicate leave block.",
      },
    });
    expect(res3.statusCode).toBe(HTTP_STATUS.CONFLICT);
  });

  // --------------------------------------------------------------------------
  // TEST 18: Invalid dates are rejected
  // --------------------------------------------------------------------------
  it("18. Invalid date ranges (startDate > endDate, malformed strings) are rejected", async () => {
    // Start date after end date
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-20",
        endDate: "2026-09-15",
        reason: "Backwards date test.",
      },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

    // Malformed date
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "not-a-date",
        endDate: "2026-09-15",
        reason: "Invalid format test.",
      },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  // --------------------------------------------------------------------------
  // TEST 19: Invalid / oversized reason is rejected
  // --------------------------------------------------------------------------
  it("19. Reason too short (< 5 chars) or too long (> 1000 chars) is rejected", async () => {
    // Too short
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        reason: "Sick",
      },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

    // Oversized > 1000 chars
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        reason: "A".repeat(1001),
      },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  // --------------------------------------------------------------------------
  // TEST 20: Unauthorized household reassignment outside admin approval is rejected
  // --------------------------------------------------------------------------
  it("20. Non-admin cannot trigger case reassignment", async () => {
    await createSampleCase("case_unauth", "hh_unauth", "ashaA");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        householdId: "hh_unauth",
        ashaUid: "ashaB",
      },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
  });

  // --------------------------------------------------------------------------
  // TEST 21: THE REAL JUDGE SCENARIO (UPGRADE 22)
  // --------------------------------------------------------------------------
  it("21. Judge Scenario: 3 households, reassigned to B, Household 2 manually moved to C during leave -> on expiry, 1 & 3 restore to A, 2 remains C", async () => {
    // 1. ASHA A has 3 households
    await createSampleCase("case_j1", "hh_j1", "ashaA");
    await createSampleCase("case_j2", "hh_j2", "ashaA");
    await createSampleCase("case_j3", "hh_j3", "ashaA");

    const initialCases = await app.caseRepository.listCasesByAsha("ashaA");
    expect(initialCases.length).toBe(3);

    // 2. ASHA A requests leave
    const leaveRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/leave-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        startDate: "2026-09-01",
        endDate: "2026-09-05",
        reason: "National rural health capacity conference.",
      },
    });
    expect(leaveRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const leaveId = leaveRes.json().data.leaveRequest.id;

    // 3. Admin approves and selects ASHA B
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { replacementAshaId: "ashaB" },
    });
    expect(approveRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(approveRes.json().data.reassignedCount).toBe(3);

    // 4. All 3 move to B; existing cases remain the same
    const bCases = await app.caseRepository.listCasesByAsha("ashaB");
    expect(bCases.length).toBe(3);

    const aCases = await app.caseRepository.listCasesByAsha("ashaA");
    expect(aCases.length).toBe(0);

    // 5. During leave, Admin manually moves Household 2 to ASHA C!
    const manualAssignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        householdId: "hh_j2",
        ashaUid: "ashaC",
      },
    });
    expect(manualAssignRes.statusCode).toBe(HTTP_STATUS.OK);

    // Household 2 is now assigned to C
    const c2 = await app.caseRepository.getCaseById("case_j2");
    expect(c2?.assignedAshaUid).toBe("ashaC");
    expect(c2?.temporaryAssignment?.status).toBe("SUPERSEDED_BY_MANUAL");

    // 6. Fast-forward: Leave period expires
    const pastEffectiveUntil = new Date(Date.now() - 60000).toISOString();
    await app.leaveRepository.updateLeaveRequest(leaveId, {
      effectiveUntil: pastEffectiveUntil,
    });

    // 7. Restoration runs
    const restoreRes = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(restoreRes.evaluatedLeavesCount).toBe(1);
    expect(restoreRes.restoredCount).toBe(2); // Cases 1 and 3 restored
    expect(restoreRes.skippedCount).toBe(1);  // Case 2 skipped!
    expect(restoreRes.reviewRequiredLeavesCount).toBe(1);

    // 8. Verify individual household assignments:
    // Household 1 -> restored to ASHA A
    const final1 = await app.caseRepository.getCaseById("case_j1");
    expect(final1?.assignedAshaUid).toBe("ashaA");
    expect(final1?.temporaryAssignment?.status).toBe("COMPLETED");

    // Household 2 -> REMAINS ASHA C!
    const final2 = await app.caseRepository.getCaseById("case_j2");
    expect(final2?.assignedAshaUid).toBe("ashaC");

    // Household 3 -> restored to ASHA A
    const final3 = await app.caseRepository.getCaseById("case_j3");
    expect(final3?.assignedAshaUid).toBe("ashaA");
    expect(final3?.temporaryAssignment?.status).toBe("COMPLETED");

    // 9. Leave request status is COMPLETED with restorationStatus = REQUIRES_REVIEW
    const finalLeave = await app.leaveRepository.getLeaveRequestById(leaveId);
    expect(finalLeave?.status).toBe("COMPLETED");
    expect(finalLeave?.restorationStatus).toBe("REQUIRES_REVIEW");
  });

  // --------------------------------------------------------------------------
  // TEST 22: Duplicate restoration is completely safe and idempotent
  // --------------------------------------------------------------------------
  it("22. Duplicate restoration runs are idempotent and perform zero additional mutations", async () => {
    await createSampleCase("case_idem", "hh_idem", "ashaA");

    const pastEffectiveUntil = new Date(Date.now() - 3600000).toISOString();
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_idem_001",
      ashaId: "ashaA",
      ashaName: "Anjali Devi",
      ashaServiceCode: "ASHA-KA-1001",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      effectiveUntil: pastEffectiveUntil,
      reason: "Idempotency test.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Meera Bai",
      reviewedBy: "admin1",
      reviewedByName: "Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: null,
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    await app.caseRepository.updateCase("case_idem", {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-01",
        effectiveUntil: pastEffectiveUntil,
        reason: "Idempotency test",
        assignedAt: "2026-09-01T08:00:00Z",
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_idem",
      leaveRequestId: leaveReq.id,
      caseId: "case_idem",
      householdId: "hh_idem",
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-01",
      effectiveUntil: pastEffectiveUntil,
      reason: "Idempotency test",
      status: "ACTIVE",
      createdAt: "2026-09-01T08:00:00Z",
      createdBy: "admin1",
    });

    // Run 1
    const run1 = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(run1.restoredCount).toBe(1);

    // Run 2: immediately afterwards
    const run2 = await app.leaveService.evaluateAndRestoreExpiredLeaves();
    expect(run2.restoredCount).toBe(0);
    expect(run2.evaluatedLeavesCount).toBe(0); // Already COMPLETED, not active APPROVED

    const c = await app.caseRepository.getCaseById("case_idem");
    expect(c?.assignedAshaUid).toBe("ashaA");
  });

  // --------------------------------------------------------------------------
  // DUAL SELECTION & AVAILABLE REPLACEMENT ASHA DISCOVERY (10 VERIFICATION POINTS)
  // --------------------------------------------------------------------------
  describe("Admin Replacement-ASHA Selection & Stale Availability Protection", () => {
    it("1-3. Admin can see available ASHA count and populated worker list corresponding to backend dataset", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/ashas",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(typeof body.data.count).toBe("number");
      expect(body.data.ashas).toBeInstanceOf(Array);
      expect(body.data.count).toBe(body.data.ashas.length);

      // Verify each worker contains minimal safe details
      const worker = body.data.ashas.find((w: any) => w.uid === "ashaB");
      expect(worker).toBeDefined();
      expect(worker.displayName).toBe("Meera Bai");
      expect(worker.ashaServiceCode).toBe("ASHA-KA-1002");
      expect(worker.serviceArea).toBe("Ward 14, Doddaballapura");
      expect(typeof worker.activeCaseCount).toBe("number");
    });

    it("4. Ineligible/inactive workers and non-ASHA users are excluded from list and count", async () => {
      // Add inactive ASHA
      const inactiveAsha: UserProfile = {
        uid: "ashaInactive",
        email: "inactive.asha@karnataka.gov.in",
        displayName: "Inactive Worker",
        phoneNumber: "+919876543290",
        role: "ASHA",
        isActive: false,
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: "2026-09-01T00:00:00Z",
        ashaServiceCode: "ASHA-KA-9999",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      };
      await app.userRepository.createUserProfile(inactiveAsha);

      // Add non-ASHA citizen
      const officerProfile: UserProfile = {
        uid: "officer1",
        email: "officer@karnataka.gov.in",
        displayName: "Citizen User",
        phoneNumber: "+919876543291",
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: "2026-09-01T00:00:00Z",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      };
      await app.userRepository.createUserProfile(officerProfile);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/ashas",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const uids = body.data.ashas.map((w: any) => w.uid);
      expect(uids).not.toContain("ashaInactive");
      expect(uids).not.toContain("officer1");
      expect(uids).not.toContain("admin1");
      expect(body.data.count).toBe(body.data.ashas.length);
    });

    it("5. Leave-requesting ASHA is not shown in available list", async () => {
      // Create leave request for ashaA
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-15",
          endDate: "2026-09-18",
          reason: "Health camp duty.",
        },
      });
      const leaveId = createRes.json().data.leaveRequest.id;

      // Query with leaveRequestId
      const res1 = await app.inject({
        method: "GET",
        url: `/api/v1/admin/ashas?leaveRequestId=${leaveId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body1 = res1.json();
      const uids1 = body1.data.ashas.map((w: any) => w.uid);
      expect(uids1).not.toContain("ashaA");

      // Query with excludeAshaId param
      const res2 = await app.inject({
        method: "GET",
        url: `/api/v1/admin/ashas?excludeAshaId=ashaA`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body2 = res2.json();
      const uids2 = body2.data.ashas.map((w: any) => w.uid);
      expect(uids2).not.toContain("ashaA");
    });

    it("Workers on approved overlapping leave are excluded from available list and count", async () => {
      // 1. Put ashaC on approved leave for 2026-09-10 to 2026-09-15
      const createLeaveC = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaCToken}` },
        payload: {
          startDate: "2026-09-10",
          endDate: "2026-09-15",
          reason: "Attending state maternal care workshop.",
        },
      });
      const leaveCId = createLeaveC.json().data.leaveRequest.id;
      await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveCId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ashaB" },
      });

      // 2. Now ashaA creates leave for overlapping dates 2026-09-11 to 2026-09-14
      const createLeaveA = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-11",
          endDate: "2026-09-14",
          reason: "Emergency leave.",
        },
      });
      const leaveAId = createLeaveA.json().data.leaveRequest.id;

      // 3. Admin queries available ASHAs for leaveAId
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/ashas?leaveRequestId=${leaveAId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const uids = body.data.ashas.map((w: any) => w.uid);
      // ashaA is requesting leave -> excluded
      expect(uids).not.toContain("ashaA");
      // ashaC has approved overlapping leave -> excluded
      expect(uids).not.toContain("ashaC");
      // ashaB is available
      expect(uids).toContain("ashaB");
      expect(body.data.count).toBe(1);
    });

    it("Zero available workers returns count 0 and empty list", async () => {
      // Exclude both ashaB and ashaC
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/ashas?excludeAshaId=ashaA",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      // Now put both B and C on approved leaves
      await app.leaveRepository.createLeaveRequest({
        id: "leave_b_full",
        ashaId: "ashaB",
        ashaName: "Meera Bai",
        ashaServiceCode: "ASHA-KA-1002",
        startDate: "2026-09-10",
        endDate: "2026-09-20",
        effectiveUntil: "2026-09-20T18:29:59.999Z",
        reason: "Full leave",
        status: "APPROVED",
        affectedHouseholdCount: 0,
        replacementAshaId: "ashaC",
        replacementAshaName: "Radha Kumari",
        reviewedBy: "admin1",
        reviewedByName: "Admin",
        reviewedAt: "2026-09-01T08:00:00Z",
        reviewNotes: null,
        restorationStatus: "PENDING",
        restorationNotes: null,
        restoredAt: null,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      });
      await app.leaveRepository.createLeaveRequest({
        id: "leave_c_full",
        ashaId: "ashaC",
        ashaName: "Radha Kumari",
        ashaServiceCode: "ASHA-KA-1003",
        startDate: "2026-09-10",
        endDate: "2026-09-20",
        effectiveUntil: "2026-09-20T18:29:59.999Z",
        reason: "Full leave",
        status: "APPROVED",
        affectedHouseholdCount: 0,
        replacementAshaId: "ashaB",
        replacementAshaName: "Meera Bai",
        reviewedBy: "admin1",
        reviewedByName: "Admin",
        reviewedAt: "2026-09-01T08:00:00Z",
        reviewNotes: null,
        restorationStatus: "PENDING",
        restorationNotes: null,
        restoredAt: null,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      });

      const createLeaveA = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-12",
          endDate: "2026-09-16",
          reason: "Emergency",
        },
      });
      const leaveAId = createLeaveA.json().data.leaveRequest.id;

      const resZero = await app.inject({
        method: "GET",
        url: `/api/v1/admin/ashas?leaveRequestId=${leaveAId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const bodyZero = resZero.json();
      expect(bodyZero.data.count).toBe(0);
      expect(bodyZero.data.ashas).toHaveLength(0);
    });

    it("6 & 8. Admin selects worker from available list (using UID) -> succeeds and sets authoritative assignment", async () => {
      await createSampleCase("case_sel_uid", "hh_sel_uid", "ashaA");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-22",
          endDate: "2026-09-25",
          reason: "Family event.",
        },
      });
      const leaveId = createRes.json().data.leaveRequest.id;

      // Method 1: List selection sends replacement UID
      const approveRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ashaB" },
      });

      expect(approveRes.statusCode).toBe(HTTP_STATUS.OK);
      const approveData = approveRes.json().data;
      expect(approveData.leaveRequest.replacementAshaId).toBe("ashaB");
      expect(approveData.leaveRequest.replacementAshaName).toBe("Meera Bai");

      // Verify case reassignment
      const updatedCase = await app.caseRepository.getCaseById("case_sel_uid");
      expect(updatedCase?.assignedAshaUid).toBe("ashaB");
      expect(updatedCase?.temporaryAssignment?.originalAshaUid).toBe("ashaA");
      expect(updatedCase?.temporaryAssignment?.temporaryAshaUid).toBe("ashaB");
      expect(updatedCase?.temporaryAssignment?.status).toBe("ACTIVE");
    });

    it("7 & 8. Existing manual ASHA-code entry works and converges to identical validation and reassignment path", async () => {
      await createSampleCase("case_manual_code", "hh_manual_code", "ashaA");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-26",
          endDate: "2026-09-28",
          reason: "Personal leave.",
        },
      });
      const leaveId = createRes.json().data.leaveRequest.id;

      // Method 2: Manual ASHA code entry (e.g. "ASHA-KA-1002" or lowercase "asha-ka-1002")
      const approveRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ASHA-KA-1002" },
      });

      expect(approveRes.statusCode).toBe(HTTP_STATUS.OK);
      const approveData = approveRes.json().data;
      // Authoritative UID is resolved and saved
      expect(approveData.leaveRequest.replacementAshaId).toBe("ashaB");
      expect(approveData.leaveRequest.replacementAshaName).toBe("Meera Bai");

      // Verify case reassignment converges to identical structure
      const updatedCase = await app.caseRepository.getCaseById("case_manual_code");
      expect(updatedCase?.assignedAshaUid).toBe("ashaB");
      expect(updatedCase?.temporaryAssignment?.originalAshaUid).toBe("ashaA");
      expect(updatedCase?.temporaryAssignment?.temporaryAshaUid).toBe("ashaB");
      expect(updatedCase?.temporaryAssignment?.status).toBe("ACTIVE");
    });

    it("9. Stale availability protection: worker becoming unavailable after list loads is rejected during approval", async () => {
      await createSampleCase("case_stale", "hh_stale", "ashaA");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-10",
          endDate: "2026-09-14",
          reason: "Conference attendance.",
        },
      });
      const leaveId = createRes.json().data.leaveRequest.id;

      // 1. Admin sees ashaB is available
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/ashas?leaveRequestId=${leaveId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.json().data.ashas.some((w: any) => w.uid === "ashaB")).toBe(true);

      // 2. In the meantime, another admin approves leave for ashaB covering overlapping dates
      await app.leaveRepository.createLeaveRequest({
        id: "leave_concurrent_b",
        ashaId: "ashaB",
        ashaName: "Meera Bai",
        ashaServiceCode: "ASHA-KA-1002",
        startDate: "2026-09-12",
        endDate: "2026-09-16",
        effectiveUntil: "2026-09-16T18:29:59.999Z",
        reason: "Urgent medical leave",
        status: "APPROVED",
        affectedHouseholdCount: 0,
        replacementAshaId: "ashaC",
        replacementAshaName: "Radha Kumari",
        reviewedBy: "admin1",
        reviewedByName: "Admin",
        reviewedAt: "2026-09-01T08:00:00Z",
        reviewNotes: null,
        restorationStatus: "PENDING",
        restorationNotes: null,
        restoredAt: null,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      });

      // 3. Admin tries to approve with ashaB (either via UID or manual code)
      const approveRes1 = await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ashaB" },
      });
      expect(approveRes1.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(approveRes1.json().code).toBe("REPLACEMENT_ON_LEAVE");

      const approveRes2 = await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ASHA-KA-1002" },
      });
      expect(approveRes2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(approveRes2.json().code).toBe("REPLACEMENT_ON_LEAVE");

      // Verify case was NOT reassigned
      const c = await app.caseRepository.getCaseById("case_stale");
      expect(c?.assignedAshaUid).toBe("ashaA");
      expect(c?.temporaryAssignment).toBeUndefined();
    });

    it("Stale availability protection: worker deactivated after list loads is rejected during approval", async () => {
      await createSampleCase("case_stale_inact", "hh_stale_inact", "ashaA");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/asha/leave-requests",
        headers: { authorization: `Bearer ${ashaAToken}` },
        payload: {
          startDate: "2026-09-10",
          endDate: "2026-09-14",
          reason: "Conference attendance.",
        },
      });
      const leaveId = createRes.json().data.leaveRequest.id;

      // Deactivate ashaB
      await app.userRepository.updateUserProfile("ashaB", { isActive: false });

      // Approval rejected
      const approveRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/leave-requests/${leaveId}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { replacementAshaId: "ashaB" },
      });
      expect(approveRes.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(approveRes.json().code).toBe("REPLACEMENT_INACTIVE");
    });
  });
});
