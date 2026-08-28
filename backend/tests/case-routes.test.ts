import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Phase 9: Case Management API Endpoints (/api/v1/asha/cases)", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_asha901_asha";
  const otherAshaToken = "test_token_asha902_asha";
  const citizenToken = "test_token_citizen903_citizen";
  const adminToken = "test_token_admin904_admin";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();

    await seedSchemeRegistry(app.schemeRepository, true);
  });

  const establishConsent = async (token: string) => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentVersion: "1.0",
        accepted: true,
      },
    });
  };

  it("1. blocks unauthenticated requests to case endpoints with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
    });
    expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. blocks Citizen from accessing ASHA case endpoints with 403", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("3. allows ASHA worker to list assigned cases and fetch summary metrics", async () => {
    await establishConsent(ashaToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.cases)).toBe(true);

    const summaryRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases/summary",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(summaryRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(summaryRes.json().data.totalAssigned).toBe(0);
  });

  it("4. performs field registration, creates case, and retrieves case detail", async () => {
    await establishConsent(ashaToken);

    // Field Registration
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        headOfHouseholdName: "Lakshmi Devi",
        rationCardNumber: "RC-KA-9901",
        headAge: 40,
        headGender: "female",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Kadugodi",
        pincode: "560067",
      },
    });

    expect(regRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const regBody = regRes.json();
    expect(regBody.success).toBe(true);
    const createdCaseId = regBody.data.case.id;

    // Retrieve Case Detail
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${createdCaseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    expect(detailRes.statusCode).toBe(HTTP_STATUS.OK);
    const detailBody = detailRes.json();
    expect(detailBody.data.case.id).toBe(createdCaseId);
    expect(detailBody.data.household.headOfHouseholdName).toBe("Lakshmi Devi");
  });

  it("5. IDOR DEFENSE: prevents another ASHA worker from accessing unassigned case", async () => {
    await establishConsent(ashaToken);
    await establishConsent(otherAshaToken);

    // ASHA 1 registers case
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        headOfHouseholdName: "Private Household",
        rationCardNumber: "RC-KA-9902",
        headAge: 45,
        headGender: "male",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Bengaluru South",
        pincode: "560001",
      },
    });
    const caseId = regRes.json().data.case.id;

    // ASHA 2 tries to access ASHA 1's case
    const forbiddenRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${otherAshaToken}` },
    });

    expect(forbiddenRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
  });

  it("6. updates case status, adds note, schedules follow-up, and retrieves activities", async () => {
    await establishConsent(ashaToken);

    // Create case
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        headOfHouseholdName: "Raju Kumar",
        rationCardNumber: "RC-KA-9903",
        headAge: 38,
        headGender: "male",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Bengaluru North",
        pincode: "560001",
      },
    });
    const caseId = regRes.json().data.case.id;

    // 1. Update status to NEEDS_ATTENTION
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/cases/${caseId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: { status: "NEEDS_ATTENTION", priority: "HIGH" },
    });
    expect(patchRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(patchRes.json().data.case.status).toBe("NEEDS_ATTENTION");

    // 2. Add Note
    const noteRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/notes`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: { content: "Visited family and scheduled document pickup." },
    });
    expect(noteRes.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(noteRes.json().data.note.content).toContain("Visited family");

    // 3. Schedule Follow-Up
    const fuRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/follow-ups`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        scheduledAt: "2026-09-15T09:00:00.000Z",
        reason: "Check ration card verification",
      },
    });
    expect(fuRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const fuId = fuRes.json().data.followUp.id;

    // 4. Complete Follow-Up
    const compFuRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/cases/${caseId}/follow-ups/${fuId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: { status: "COMPLETED" },
    });
    expect(compFuRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(compFuRes.json().data.followUp.status).toBe("COMPLETED");

    // 5. Activity Log
    const actRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseId}/activities`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(actRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(actRes.json().data.activities.length).toBeGreaterThan(0);
  });

  it("7. allows Admin to inspect all platform cases and assign cases to ASHAs", async () => {
    await establishConsent(adminToken);
    await establishConsent(ashaToken);

    // Create case
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        headOfHouseholdName: "Sunitha Rao",
        rationCardNumber: "RC-KA-9904",
        headAge: 29,
        headGender: "female",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Bengaluru Central",
        pincode: "560001",
      },
    });
    const householdId = regRes.json().data.household.id;

    // Admin lists all platform cases
    const adminListRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminListRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(adminListRes.json().data.cases.length).toBeGreaterThan(0);

    // Admin reassigns case
    const assignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        householdId,
        ashaUid: "new-asha-uid-999",
      },
    });
    expect(assignRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(assignRes.json().data.case.assignedAshaUid).toBe("new-asha-uid-999");
  });
});
