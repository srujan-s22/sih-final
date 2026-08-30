import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("SwasthyaSetu Proactive ASHA Household Intelligence Test Suite", () => {
  let app: FastifyInstance;

  const citizen1Token = "test_token_citizen101_citizen"; // Senior 70+ household
  const citizen2Token = "test_token_citizen102_citizen"; // Pregnant mother household
  const citizen3Token = "test_token_citizen103_citizen"; // Incomplete household
  const asha1Token = "test_token_asha101_asha";
  const asha2Token = "test_token_asha102_asha"; // Second ASHA for IDOR test
  const adminToken = "test_token_admin101_admin";

  let pmjayBeneficiaryId: string;
  let jsyBeneficiaryId: string;
  let case1Id: string;
  let case2Id: string;
  let household1Id: string;
  let household2Id: string;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();

    // Seed scheme registry
    await seedSchemeRegistry(app.schemeRepository, true);

    // Consent all actors
    for (const token of [citizen1Token, citizen2Token, citizen3Token, asha1Token, asha2Token, adminToken]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: { authorization: `Bearer ${token}` },
        payload: { consentVersion: "1.0", accepted: true },
      });
    }

    // Set ASHA 1 profile & service code
    await app.userRepository.updateUserProfile("asha101", {
      displayName: "Priya Sharma",
      ashaServiceCode: "ASHA-KA-7K42",
      serviceArea: "Nelamangala PHC",
      role: "ASHA",
    });

    // Set ASHA 2 profile & service code
    await app.userRepository.updateUserProfile("asha102", {
      displayName: "Sunita Rao",
      ashaServiceCode: "ASHA-KA-8M19",
      serviceArea: "Doddaballapura PHC",
      role: "ASHA",
    });

    // Setup Household 1 (Citizen 1 - Ramesh with Grandfather Gopal, 72 for PM-JAY)
    const hh1Res = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        headOfHouseholdName: "Ramesh Sharma",
        contactPhone: "9876543210",
        incomeCategory: "APL",
        rationCardNumber: "RAT-KA-9901",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
        addressLine1: "Village Road 4",
      },
    });
    household1Id = JSON.parse(hh1Res.body).data.household.id;

    // Add Grandfather Gopal (72, Senior 70+)
    const mem1Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        fullName: "Gopal Sharma",
        age: 72,
        gender: "male",
        relationship: "father",
      },
    });
    pmjayBeneficiaryId = JSON.parse(mem1Res.body).data.member.id;

    // Connect Household 1 to ASHA 1
    const conn1Req = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    const conn1Id = JSON.parse(conn1Req.body).data.id;

    // ASHA 1 accepts connection 1 -> creates Case 1
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn1Id}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    // Setup Household 2 (Citizen 2 - Anita Devi, pregnant for JSY)
    const hh2Res = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        headOfHouseholdName: "Anita Devi",
        contactPhone: "9876543222",
        incomeCategory: "BPL",
        rationCardNumber: "BPL-KA-88321",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
        addressLine1: "Ward 2 House 10",
      },
    });
    household2Id = JSON.parse(hh2Res.body).data.household.id;

    // Add Pregnant member Anita (24)
    const mem2Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        fullName: "Anita Devi",
        age: 24,
        gender: "female",
        relationship: "self",
        maternalStatus: "pregnant",
      },
    });
    jsyBeneficiaryId = JSON.parse(mem2Res.body).data.member.id;

    // Connect Household 2 to ASHA 1
    const conn2Req = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    const conn2Id = JSON.parse(conn2Req.body).data.id;

    // ASHA 1 accepts connection 2 -> creates Case 2
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn2Id}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    // Retrieve case IDs from assigned cases list
    const casesRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const cases = JSON.parse(casesRes.body).data.cases;
    const c1 = cases.find((c: any) => c.householdId === household1Id);
    case1Id = c1.id;
    const c2 = cases.find((c: any) => c.householdId === household2Id);
    case2Id = c2.id;
  });

  // 1. ASHA gets only assigned household signals
  it("1. ASHA retrieves attention signals only for their assigned households", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.success).toBe(true);
    expect(body1.data.summary.totalAssignedHouseholds).toBe(2);

    // ASHA 2 has 0 assigned households
    const res2 = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha2Token}` },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.data.summary.totalAssignedHouseholds).toBe(0);
    expect(body2.data.signals.length).toBe(0);
  });

  // 2. ASHA sees PM-JAY 70+ signal
  it("2. ASHA sees high-priority PM-JAY senior citizen 70+ attention signal", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const body = JSON.parse(res.body);
    const pmjaySig = body.data.signals.find(
      (s: any) => s.category === "SENIOR_CITIZEN_PMJAY" && s.householdId === household1Id
    );

    expect(pmjaySig).toBeDefined();
    expect(pmjaySig.priority).toBe("HIGH");
    expect(pmjaySig.schemeId).toBe("ab-pmjay");
    expect(pmjaySig.beneficiaryName).toBe("Gopal Sharma");
    expect(pmjaySig.beneficiaryMemberId).toBe(pmjayBeneficiaryId);
    expect(pmjaySig.actionType).toBe("INITIATE_SCHEME");
  });

  // 3. ASHA sees JSY signal when actual eligibility exists
  it("3. ASHA sees high-priority JSY pregnancy care attention signal", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const body = JSON.parse(res.body);
    const jsySig = body.data.signals.find(
      (s: any) => s.category === "PREGNANCY_CARE" && s.householdId === household2Id
    );

    expect(jsySig).toBeDefined();
    expect(jsySig.priority).toBe("HIGH");
    expect(jsySig.schemeId).toBe("jsy");
    expect(jsySig.beneficiaryName).toBe("Anita Devi");
    expect(jsySig.beneficiaryMemberId).toBe(jsyBeneficiaryId);
    expect(jsySig.actionType).toBe("INITIATE_SCHEME");
  });

  // 4. ASHA sees overdue follow-up
  it("4. ASHA sees urgent attention signal for overdue follow-up visit", async () => {
    // Schedule an overdue follow-up on Case 1
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        scheduledAt: pastDate,
        reason: "Check biometric device readiness",
        beneficiaryName: "Gopal Sharma",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const body = JSON.parse(res.body);
    const overdueSig = body.data.signals.find(
      (s: any) => s.category === "OVERDUE_FOLLOWUP" && s.caseId === case1Id
    );

    expect(overdueSig).toBeDefined();
    expect(overdueSig.priority).toBe("URGENT");
    expect(overdueSig.actionType).toBe("COMPLETE_FOLLOWUP");
  });

  // 5. ASHA sees blocked task
  it("5. ASHA sees urgent attention signal when a task is marked blocked", async () => {
    // Create a task and mark it BLOCKED
    const taskRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/tasks`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        title: "Aadhaar e-KYC Verification",
        description: "Fingerprint scanner mismatch",
        type: "VERIFICATION",
        order: 1,
      },
    });
    const taskId = JSON.parse(taskRes.body).data.task.id;

    await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/cases/${case1Id}/tasks/${taskId}`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        status: "BLOCKED",
        notes: "Biometric authentication failed due to worn fingerprints; Iris scan needed.",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const body = JSON.parse(res.body);
    const blockedSig = body.data.signals.find(
      (s: any) => s.category === "BLOCKED_TASK" && s.caseId === case1Id
    );

    expect(blockedSig).toBeDefined();
    expect(blockedSig.priority).toBe("URGENT");
    expect(blockedSig.actionType).toBe("UNBLOCK_TASK");
  });

  // 6. ASHA sees missing-information signal
  it("6. ASHA sees missing information signal when incomplete household data is present", async () => {
    // Setup Household with no members
    const hh3Res = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen3Token}` },
      payload: {
        headOfHouseholdName: "Suresh Kumar",
        contactPhone: "9876543333",
        incomeCategory: "BPL",
        rationCardNumber: "BPL-KA-55112",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
      },
    });
    const hh3Id = JSON.parse(hh3Res.body).data.household.id;

    const conn3 = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen3Token}` },
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    const conn3Id = JSON.parse(conn3.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn3Id}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const body = JSON.parse(res.body);
    const missingSig = body.data.signals.find(
      (s: any) => s.householdId === hh3Id && s.category === "MISSING_DOCUMENTS"
    );
    expect(missingSig).toBeDefined();
    expect(missingSig.priority).toBe("MEDIUM");
  });

  // 7. ASHA can initiate PM-JAY
  it("7. ASHA proactively initiates PM-JAY scheme assistance successfully", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
        priority: "HIGH",
        notes: "Proactively initiated during doorstep survey",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.case.schemeId).toBe("ab-pmjay");
    expect(body.data.case.status).toBe("IN_PROGRESS");
    expect(body.data.tasks.length).toBe(5); // 5 PM-JAY tasks seeded
    expect(body.data.journeySteps.length).toBe(7); // 7 PM-JAY milestones seeded
  });

  // 8. ASHA can initiate JSY
  it("8. ASHA proactively initiates JSY scheme assistance successfully", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case2Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: jsyBeneficiaryId,
        priority: "HIGH",
        notes: "Proactively initiated for first trimester ANC",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.case.schemeId).toBe("jsy");
    expect(body.data.case.status).toBe("IN_PROGRESS");
    expect(body.data.tasks.length).toBe(6); // 6 JSY tasks seeded
    expect(body.data.journeySteps.length).toBe(8); // 8 JSY milestones seeded
  });

  // 9. Invalid beneficiary rejected
  it("9. Rejects scheme initiation if beneficiary member is not in the household", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: "fake_non_existent_member_999",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("BENEFICIARY_NOT_FOUND");
  });

  // 10. Ineligible scheme rejected
  it("10. Rejects scheme initiation if household/member is not eligible", async () => {
    // Attempt JSY for Household 1 (where there are no pregnant members)
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("NOT_ELIGIBLE");
  });

  // 11. ASHA B cannot initiate on ASHA A case
  it("11. ASHA B cannot initiate assistance on ASHA A's assigned case (IDOR)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha2Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    expect(res.statusCode).toBe(404); // Case not found or unauthorized
  });

  // 12. Citizen cannot call ASHA initiation endpoint
  it("12. Citizen is forbidden from calling ASHA proactive initiation endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        schemeId: "ab-pmjay",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  // 13. Duplicate proactive assistance returns 409
  it("13. Prevents duplicate active scheme journey creation returning 409 Conflict", async () => {
    // First initiation
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    // Second duplicate initiation
    const dupRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    expect(dupRes.statusCode).toBe(409);
    const body = JSON.parse(dupRes.body);
    expect(body.code).toBe("DUPLICATE_ACTIVE_REQUEST");
  });

  // 14. Citizen-requested assistance still works
  it("14. Preserves citizen-initiated assistance request flow", async () => {
    const reqRes = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Citizen requested doorstep help",
      },
    });

    expect(reqRes.statusCode).toBe(201);
    const reqId = JSON.parse(reqRes.body).data.id;

    // ASHA accepts
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/assistance-requests/${reqId}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    expect(acceptRes.statusCode).toBe(200);
  });

  // 15. ASHA-requested assistance reaches citizen
  it("15. ASHA-initiated assistance is visible to the citizen via citizen assistance API", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    const citizenRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizen1Token}` },
    });

    expect(citizenRes.statusCode).toBe(200);
    const requests = JSON.parse(citizenRes.body).data.requests;
    const proactiveReq = requests.find((r: any) => r.schemeId === "ab-pmjay");
    expect(proactiveReq).toBeDefined();
    expect(proactiveReq.status).toBe("ACCEPTED");
  });

  // 16. initiatedBy is persisted correctly
  it("16. Distinguishes initiatedBy = 'ASHA' vs initiatedBy = 'CITIZEN'", async () => {
    // ASHA initiates
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    const citizenRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizen1Token}` },
    });

    const requests = JSON.parse(citizenRes.body).data.requests;
    const ashaReq = requests.find((r: any) => r.schemeId === "ab-pmjay");
    expect(ashaReq.initiatedBy).toBe("ASHA");
  });

  // 17. Audit activity is created
  it("17. Records immutable CASE_SCHEME_INITIATED activity log in case audit trail", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    const actRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${case1Id}/activities`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    expect(actRes.statusCode).toBe(200);
    const activities = JSON.parse(actRes.body).data.activities;
    const initiatedAct = activities.find((a: any) => a.type === "CASE_SCHEME_INITIATED");
    expect(initiatedAct).toBeDefined();
    expect(initiatedAct.actorRole).toBe("ASHA");
    expect(initiatedAct.metadata.initiationSource).toBe("ASHA");
  });

  // 18. Case tasks are initialized exactly once
  it("18. Case tasks are initialized with exact order and dependencies", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    const tasks = JSON.parse(initRes.body).data.tasks;
    expect(tasks.length).toBe(5);
    expect(tasks[0].order).toBe(1);
    expect(tasks[0].status).toBe("PENDING");
    expect(tasks[1].status).toBe("PENDING");
  });

  // 19. Existing PM-JAY workflow remains functional and completed journey clears attention signals
  it("19. Completing proactive PM-JAY tasks sequentially advances journey milestones to resolution and clears attention signals", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });

    const tasks = JSON.parse(initRes.body).data.tasks;

    // Complete all 5 tasks sequentially
    for (const task of tasks) {
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Verified in field" },
      });
      expect(compRes.statusCode).toBe(200);
    }

    // Verify case is RESOLVED
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${case1Id}`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const c = JSON.parse(detailRes.body).data.case;
    expect(c.status).toBe("RESOLVED");
    expect(c.currentJourneyStep).toBe("CASE_RESOLVED");

    // Verify eligibility remains ELIGIBLE independently of journey completion
    const eligibilityResults = JSON.parse(detailRes.body).data.eligibilityResults;
    const pmjayElig = eligibilityResults.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayElig.status).toBe("ELIGIBLE");

    // Verify ASHA attention signals do NOT expose PM-JAY START_ASSISTANCE for this completed case
    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const signals = JSON.parse(sigRes.body).data.signals;
    const pmjaySig = signals.find((s: any) => s.schemeId === "ab-pmjay" && s.caseId === case1Id);
    expect(pmjaySig).toBeUndefined();

    // Verify summary counters reflect resolution
    const summary = JSON.parse(sigRes.body).data.summary;
    expect(summary.activeSchemeJourneys).toBe(0);

    // Verify Citizen sees RESOLVED assistance request
    const citRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizen1Token}` },
    });
    const requests = JSON.parse(citRes.body).data.requests;
    const pmjayReq = requests.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayReq).toBeDefined();
    expect(pmjayReq.status).toBe("RESOLVED");

    // Verify calling initiate-scheme again after completion is safely rejected with 409 Conflict
    const reInitRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
      },
    });
    expect(reInitRes.statusCode).toBe(409);
  });

  // 20. Existing JSY workflow remains functional and completed journey clears attention signals
  it("20. Completing proactive JSY tasks sequentially advances maternal care journey to resolution and clears attention signals", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case2Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: jsyBeneficiaryId,
      },
    });

    const tasks = JSON.parse(initRes.body).data.tasks;
    expect(tasks.length).toBe(6);

    // Complete all 6 tasks sequentially
    for (const task of tasks) {
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Maternal checkpoint recorded" },
      });
      expect(compRes.statusCode).toBe(200);
    }

    // Verify case is RESOLVED
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${case2Id}`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    const c = JSON.parse(detailRes.body).data.case;
    expect(c.status).toBe("RESOLVED");
    expect(c.currentJourneyStep).toBe("CASE_RESOLVED");

    // Verify ASHA attention signals do NOT expose JSY START_ASSISTANCE for this completed case
    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const signals = JSON.parse(sigRes.body).data.signals;
    const jsySig = signals.find((s: any) => s.schemeId === "jsy" && s.caseId === case2Id);
    expect(jsySig).toBeUndefined();

    // Verify summary counters reflect resolution
    const summary = JSON.parse(sigRes.body).data.summary;
    expect(summary.activeSchemeJourneys).toBe(0);

    // Verify Citizen sees RESOLVED assistance request
    const citRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizen2Token}` },
    });
    const requests = JSON.parse(citRes.body).data.requests;
    const jsyReq = requests.find((r: any) => r.schemeId === "jsy");
    expect(jsyReq).toBeDefined();
    expect(jsyReq.status).toBe("RESOLVED");

    // Verify calling initiate-scheme again after completion is safely rejected with 409 Conflict
    const reInitRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${case2Id}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: jsyBeneficiaryId,
      },
    });
    expect(reInitRes.statusCode).toBe(409);
  });
});
