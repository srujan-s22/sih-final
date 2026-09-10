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

  const seedAssignedCase = async (
    householdId: string,
    headName: string,
    ashaUid: string,
    state = "Karnataka",
    district = "Bengaluru",
  ) => {
    const { household } = await app.householdRepository.createHouseholdWithMembers(
      {
        id: householdId,
        ownerUid: `citizen_owner_${householdId}`,
        headOfHouseholdName: headName,
        rationCardNumber: `RC-${householdId}`,
        incomeCategory: "BPL",
        state,
        district,
        village: "Bengaluru Central",
        pincode: "560001",
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        {
          id: `m_${householdId}_head`,
          householdId,
          fullName: headName,
          relationship: "Head",
          age: 40,
          gender: "female",
          disabilityStatus: false,
          chronicConditions: [],
          maternalStatus: "none",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    );

    const now = new Date().toISOString();
    const caseId = `case_${householdId}`;
    const ashaCase = await app.caseRepository.createCase({
      id: caseId,
      householdId: household.id,
      assignedAshaUid: ashaUid,
      headOfHouseholdName: household.headOfHouseholdName,
      district: household.district,
      state: household.state,
      incomeCategory: household.incomeCategory,
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return { household, case: ashaCase };
  };

  it("4. rejects ASHA field registration with 403 FORBIDDEN_ROLE and retrieves case detail for assigned case", async () => {
    await establishConsent(ashaToken);

    // Field Registration attempt by ASHA is rejected with 403 FORBIDDEN_ROLE
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

    expect(regRes.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    const regBody = regRes.json();
    expect(regBody.success).toBe(false);
    expect(regBody.code).toBe("FORBIDDEN_ROLE");

    // Seed assigned case via citizen creation and assignment model
    const { case: createdCase } = await seedAssignedCase("hh_9901", "Lakshmi Devi", "asha901");
    const createdCaseId = createdCase.id;

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

    // Seed case assigned to ASHA 1 (asha901)
    const { case: asha1Case } = await seedAssignedCase("hh_9902", "Private Household", "asha901");
    const caseId = asha1Case.id;

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

    // Seed case assigned to asha901
    const { case: seededCase } = await seedAssignedCase("hh_9903", "Raju Kumar", "asha901");
    const caseId = seededCase.id;

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

    // Seed assigned case
    const { household } = await seedAssignedCase("hh_9904", "Sunitha Rao", "asha901");
    const householdId = household.id;

    // Seed target ASHA worker in userRepository
    await app.userRepository.createUserProfile({
      uid: "new-asha-uid-999",
      email: "newasha999@test.gov.in",
      role: "ASHA",
      displayName: "ASHA Meena",
      phoneNumber: null,
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Admin lists all platform cases
    const adminListRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminListRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(adminListRes.json().data.cases.length).toBeGreaterThan(0);

    // Admin cannot assign to non-existent user
    const badAssignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        householdId,
        ashaUid: "completely-nonexistent-user",
      },
    });
    expect(badAssignRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // Admin reassigns case to valid ASHA
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
