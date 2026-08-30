import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("SwasthyaSetu — Scheme Journey Resolution & Stale Action Prevention Regression Test Suite", () => {
  let app: FastifyInstance;

  const citizen1Token = "test_token_citizen101_citizen";
  const asha1Token = "test_token_asha101_asha";
  const asha2Token = "test_token_asha102_asha";

  let seniorMemberId: string;
  let pregnantMemberId: string;
  let household1Id: string;
  let caseId: string;

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
    for (const token of [citizen1Token, asha1Token, asha2Token]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: { authorization: `Bearer ${token}` },
        payload: { consentVersion: "1.0", accepted: true },
      });
    }

    // Set ASHA 1 profile & service code
    await app.userRepository.updateUserProfile("asha101", {
      displayName: "Sunita Devi ASHA",
      ashaServiceCode: "ASHA-KA-7K42",
      serviceArea: "Nelamangala PHC",
      role: "ASHA",
    });

    // Set ASHA 2 profile & service code
    await app.userRepository.updateUserProfile("asha102", {
      displayName: "Priya Sharma ASHA",
      ashaServiceCode: "ASHA-KA-8M19",
      serviceArea: "Doddaballapura PHC",
      role: "ASHA",
    });

    // Setup Household 1 (Citizen 1 - Ramesh with Grandfather Kumar, 71 for PM-JAY)
    const hhRes = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        headOfHouseholdName: "Ramesh Gupta",
        contactPhone: "9876543210",
        incomeCategory: "BPL",
        rationCardNumber: "RAT-KA-9901",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
        addressLine1: "Village Road 4",
      },
    });
    household1Id = JSON.parse(hhRes.body).data.household.id;

    // Add Grandfather Kumar (71, Senior 70+)
    const mem1Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        fullName: "Kumar Gupta",
        age: 71,
        gender: "male",
        relationship: "father",
      },
    });
    seniorMemberId = JSON.parse(mem1Res.body).data.member.id;

    // Add Pregnant member Anita (24)
    const mem2Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        fullName: "Anita Gupta",
        age: 24,
        gender: "female",
        relationship: "daughter_in_law",
        maternalStatus: "pregnant",
      },
    });
    pregnantMemberId = JSON.parse(mem2Res.body).data.member.id;

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

    // Retrieve case ID from assigned cases list
    const casesRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const cases = JSON.parse(casesRes.body).data.cases;
    const c1 = cases.find((c: any) => c.householdId === household1Id);
    caseId = c1.id;
  });

  it("1. Eligible senior citizen with no assistance -> surfaces START_ASSISTANCE signal", async () => {
    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    expect(sigRes.statusCode).toBe(200);
    const body = JSON.parse(sigRes.body).data;
    const pmjaySig = body.signals.find(
      (s: any) => s.schemeId === "ab-pmjay" && s.beneficiaryMemberId === seniorMemberId
    );
    expect(pmjaySig).toBeDefined();
    expect(pmjaySig.priority).toBe("HIGH");
    expect(pmjaySig.actionType).toBe("INITIATE_SCHEME");
    expect(pmjaySig.recommendedAction).toBe("Start PM-JAY Doorstep Assistance");
  });

  it("2. ASHA initiates PM-JAY assistance -> active journey created with 5 tasks", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    expect(initRes.statusCode).toBe(201);
    const data = JSON.parse(initRes.body).data;
    expect(data.tasks.length).toBe(5);
    expect(data.case.schemeId).toBe("ab-pmjay");
    expect(data.case.status).toBe("IN_PROGRESS");
  });

  it("3. Eligible senior citizen with active PM-JAY journey -> no duplicate START_ASSISTANCE signal", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });

    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const body = JSON.parse(sigRes.body).data;
    const pmjaySig = body.signals.find(
      (s: any) => s.schemeId === "ab-pmjay" && s.beneficiaryMemberId === seniorMemberId
    );
    expect(pmjaySig).toBeUndefined();
    expect(body.summary.activeSchemeJourneys).toBe(1);
  });

  it("4. Duplicate initiation during active journey is rejected with 409 Conflict", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });

    const dupRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    expect(dupRes.statusCode).toBe(409);
    const body = JSON.parse(dupRes.body);
    expect(body.code || body.error?.code || body.error).toBeDefined();
  });

  it("5. ASHA completes all 5 PM-JAY tasks -> case status becomes RESOLVED & milestone is CASE_RESOLVED", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    expect(tasks.length).toBe(5);

    for (const task of tasks) {
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: `Completed ${task.title}` },
      });
      expect(compRes.statusCode).toBe(200);
    }

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const c = JSON.parse(detailRes.body).data.case;
    expect(c.status).toBe("RESOLVED");
    expect(c.currentJourneyStep).toBe("CASE_RESOLVED");
  });

  it("6. Completed PM-JAY journey -> active scheme journey count decreases to 0 and resolved count increases", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    for (const task of tasks) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Completed" },
      });
    }

    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const body = JSON.parse(sigRes.body).data;
    expect(body.summary.activeSchemeJourneys).toBe(0);

    const summaryRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases/summary",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const summary = JSON.parse(summaryRes.body).data;
    expect(summary.resolvedCount).toBe(1);
    expect(summary.needsAttentionCount).toBe(0);
  });

  it("7. Completed PM-JAY journey -> PM-JAY START_ASSISTANCE signal remains ABSENT", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    for (const task of tasks) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Completed" },
      });
    }

    const sigRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/intelligence/attention-signals",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const body = JSON.parse(sigRes.body).data;
    const pmjaySig = body.signals.find(
      (s: any) => s.schemeId === "ab-pmjay" && s.beneficiaryMemberId === seniorMemberId
    );
    expect(pmjaySig).toBeUndefined();
  });

  it("8. Eligibility remains true (ELIGIBLE) independently of assistance lifecycle completion", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    for (const task of tasks) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Completed" },
      });
    }

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const eligibilityResults = JSON.parse(detailRes.body).data.eligibilityResults;
    const pmjayElig = eligibilityResults.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayElig).toBeDefined();
    expect(pmjayElig.status).toBe("ELIGIBLE");
  });

  it("9. Citizen sees assistance request status as RESOLVED", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    for (const task of tasks) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Completed" },
      });
    }

    const citRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizen1Token}` },
    });
    expect(citRes.statusCode).toBe(200);
    const requests = JSON.parse(citRes.body).data.requests;
    const pmjayReq = requests.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayReq).toBeDefined();
    expect(pmjayReq.status).toBe("RESOLVED");
    expect(pmjayReq.initiatedBy).toBe("ASHA");
  });

  it("10. Re-initiating PM-JAY assistance on completed journey is rejected with 409 Conflict", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    const tasks = JSON.parse(initRes.body).data.tasks;
    for (const task of tasks) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${caseId}/tasks/${task.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Completed" },
      });
    }

    const reInitRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha1Token}` },
      payload: {
        schemeId: "ab-pmjay",
        beneficiaryMemberId: seniorMemberId,
      },
    });
    expect(reInitRes.statusCode).toBe(409);
  });

  it("11. IDOR security: ASHA 2 cannot initiate scheme assistance on ASHA 1's case", async () => {
    const idorRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${asha2Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: pregnantMemberId,
      },
    });
    expect(idorRes.statusCode).toBe(404);
  });

  it("12. Citizen is forbidden from calling ASHA proactive initiation endpoint", async () => {
    const citInitRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/initiate-scheme`,
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        schemeId: "jsy",
        beneficiaryMemberId: pregnantMemberId,
      },
    });
    expect(citInitRes.statusCode).toBe(403);
  });
});
