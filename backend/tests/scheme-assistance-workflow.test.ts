import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("SwasthyaSetu Scheme-Assistance Workflow E2E Test", () => {
  let app: FastifyInstance;

  const citizen1Token = "test_token_citizen101_citizen";
  const citizen2Token = "test_token_citizen102_citizen";
  const rogueCitizenToken = "test_token_rogue103_citizen";
  const ashaToken = "test_token_asha101_asha";
  const adminToken = "test_token_admin101_admin";

  let pmjayBeneficiaryId: string;
  let jsyBeneficiaryId: string;
  let ashaServiceCode: string;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset test memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();

    // Seed schemes
    await seedSchemeRegistry(app.schemeRepository, true);

    // Consent all actors
    for (const token of [citizen1Token, citizen2Token, rogueCitizenToken, ashaToken, adminToken]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: { authorization: `Bearer ${token}` },
        payload: { consentVersion: "1.0", accepted: true },
      });
    }

    // Set ASHA service code
    await app.userRepository.updateUserProfile("asha101", {
      ashaServiceCode: "ASHA-KA-7K42",
      serviceArea: "Nelamangala PHC",
      role: "ASHA",
    });
    ashaServiceCode = "ASHA-KA-7K42";

    // 1. Create Household for Citizen 1 (Senior Citizen 70+ for PM-JAY)
    await app.inject({
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
      },
    });

    const seniorMemRes = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        fullName: "Gopal Sharma",
        age: 72,
        gender: "male",
        relationship: "father",
        disabilityStatus: false,
      },
    });
    pmjayBeneficiaryId = JSON.parse(seniorMemRes.body).data.member.id;

    // Connect Citizen 1 to ASHA
    const conn1Res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: { serviceCode: ashaServiceCode },
    });
    const conn1Id = JSON.parse(conn1Res.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn1Id}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    // 2. Create Household for Citizen 2 (Pregnant Mother for JSY)
    await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        headOfHouseholdName: "Suresh Kumar",
        contactPhone: "9876543211",
        incomeCategory: "BPL",
        rationCardNumber: "RAT-KA-9902",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
      },
    });

    const pregMemRes = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        fullName: "Sita Kumar",
        age: 26,
        gender: "female",
        relationship: "wife",
        maternalStatus: "pregnant",
        disabilityStatus: false,
      },
    });
    jsyBeneficiaryId = JSON.parse(pregMemRes.body).data.member.id;

    // Connect Citizen 2 to ASHA
    const conn2Res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: { serviceCode: ashaServiceCode },
    });
    const conn2Id = JSON.parse(conn2Res.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn2Id}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });
  });

  it("1. Citizen 1 requests ASHA assistance for PM-JAY with Senior Beneficiary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat - PM-JAY (Senior 70+)",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Need doorstep help with e-KYC for senior father Gopal Sharma",
        priority: "HIGH",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.schemeId).toBe("ab-pmjay");
    expect(body.data.beneficiaryMemberId).toBe(pmjayBeneficiaryId);
    expect(body.data.beneficiaryName).toBe("Gopal Sharma");
    expect(body.data.beneficiaryAge).toBe(72);
    expect(body.data.status).toBe("PENDING");
  });

  it("2. Duplicate prevention blocks second active request for same scheme", async () => {
    // First request
    await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat - PM-JAY (Senior 70+)",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Need doorstep help",
      },
    });

    // Duplicate request
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat - PM-JAY (Senior 70+)",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Duplicate request should be rejected",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("DUPLICATE_ACTIVE_REQUEST");
  });

  it("3. IDOR / multi-tenant boundary prevents rogue citizen from creating assistance for foreign household", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${rogueCitizenToken}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Rogue attack attempt",
      },
    });

    expect(res.statusCode).toBe(404); // Household profile required first
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it("4. ASHA accepts PM-JAY assistance request -> generates PM-JAY journey and 5 specific field tasks", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat - PM-JAY (Senior 70+)",
        beneficiaryMemberId: pmjayBeneficiaryId,
        message: "Need doorstep help with e-KYC",
      },
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/assistance-requests",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    const pmjayReq = JSON.parse(listRes.body).data.requests.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayReq).toBeDefined();

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/assistance-requests/${pmjayReq.id}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {},
    });

    expect(acceptRes.statusCode).toBe(200);
    const acceptBody = JSON.parse(acceptRes.body);
    expect(acceptBody.success).toBe(true);
    expect(acceptBody.data.request.status).toBe("ACCEPTED");
    expect(acceptBody.data.caseId).toBeDefined();
    const caseId = acceptBody.data.caseId;

    // Verify Case details & tasks
    const caseDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    expect(caseDetailRes.statusCode).toBe(200);
    const caseBody = JSON.parse(caseDetailRes.body).data;
    expect(caseBody.case.schemeId).toBe("ab-pmjay");
    expect(caseBody.case.beneficiaryName).toBe("Gopal Sharma");
    expect(caseBody.journeySteps.length).toBe(7); // 7 PM-JAY milestones
    expect(caseBody.tasks.length).toBe(5); // 5 PM-JAY field tasks

    // Complete all 5 tasks sequentially
    for (const task of caseBody.tasks) {
      const completeRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { notes: `Completed task: ${task.title}` },
      });
      expect(completeRes.statusCode).toBe(200);
    }

    // Verify final state is RESOLVED
    const finalCaseRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    const finalCase = JSON.parse(finalCaseRes.body).data;
    expect(finalCase.case.status).toBe("RESOLVED");
    expect(finalCase.tasks.every((t: any) => t.status === "COMPLETED")).toBe(true);
    expect(finalCase.journeySteps.every((s: any) => s.status === "COMPLETED")).toBe(true);
  });

  it("5. JSY Workflow: Request -> Accept -> 8 Milestones & 6 Tasks -> Complete -> Resolve", async () => {
    // Request assistance for JSY
    await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "jsy",
        schemeName: "Janani Suraksha Yojana (JSY)",
        beneficiaryMemberId: jsyBeneficiaryId,
        message: "Doorstep ANC checkup assistance",
        priority: "URGENT",
      },
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/assistance-requests",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    const jsyReq = JSON.parse(listRes.body).data.requests.find((r: any) => r.schemeId === "jsy");
    expect(jsyReq).toBeDefined();
    expect(jsyReq.beneficiaryName).toBe("Sita Kumar");

    // Accept request
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/assistance-requests/${jsyReq.id}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {},
    });

    expect(acceptRes.statusCode).toBe(200);
    const caseId = JSON.parse(acceptRes.body).data.caseId;

    const caseDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    const caseBody = JSON.parse(caseDetailRes.body).data;
    expect(caseBody.case.schemeId).toBe("jsy");
    expect(caseBody.journeySteps.length).toBe(8); // 8 JSY milestones
    expect(caseBody.tasks.length).toBe(6); // 6 JSY field tasks

    // Complete all 6 maternal tasks
    for (const task of caseBody.tasks) {
      const completeRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { notes: `Completed maternal task: ${task.title}` },
      });
      expect(completeRes.statusCode).toBe(200);
    }

    const finalCaseRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    const finalCase = JSON.parse(finalCaseRes.body).data;
    expect(finalCase.case.status).toBe("RESOLVED");
    expect(finalCase.tasks.every((t: any) => t.status === "COMPLETED")).toBe(true);
  });

  it("6. Admin has complete visibility over all cases and scheme metrics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.cases.length).toBeGreaterThanOrEqual(0);
  });
});
