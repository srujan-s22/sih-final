import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Phase 9: Citizen to ASHA Assistance Request API Endpoints", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_asha901_asha";
  const otherAshaToken = "test_token_asha902_asha";
  const citizenToken = "test_token_citizen903_citizen";
  const otherCitizenToken = "test_token_citizen905_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();

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

  it("1. blocks unauthenticated requests to assistance endpoints with 401", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      payload: {
        category: "SCHEME_ENROLLMENT",
        message: "Need help with AB-PMJAY",
      },
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    const res2 = await app.inject({
      method: "GET",
      url: "/api/v1/asha/assistance-requests",
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. rejects assistance request if citizen has no active ASHA connection", async () => {
    await establishConsent(citizenToken);

    // Create household
    await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        headOfHouseholdName: "Siddharth Verma",
        rationCardNumber: "RC-KA-9921",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Ward 4",
        pincode: "560001",
      },
    });

    // Attempt assistance request without ASHA connection
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        message: "Please help our family enroll in PM-JAY",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    const json = JSON.parse(res.body);
    expect(json.code).toBe("NO_ACTIVE_ASHA_CONNECTION");
  });

  it("3. executes complete Assistance Request workflow end-to-end with audit logging", async () => {
    // Step A: Setup ASHA
    await establishConsent(ashaToken);
    const ashaProfile = await app.userRepository.getUserById("asha901");
    const serviceCode = ashaProfile!.ashaServiceCode!;

    // Step B: Setup Citizen & Household
    await establishConsent(citizenToken);
    await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        headOfHouseholdName: "Siddharth Verma",
        rationCardNumber: "RC-KA-9921",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Ward 4",
        pincode: "560001",
      },
    });

    // Step C: Connect Citizen to ASHA
    const connReqRes = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { serviceCode },
    });
    expect(connReqRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const connectionId = JSON.parse(connReqRes.body).data.id;

    // Step D: ASHA accepts connection
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${connectionId}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(acceptRes.statusCode).toBe(HTTP_STATUS.OK);

    // Step E: Citizen submits Assistance Request
    const astRes = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/assistance/request",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        category: "SCHEME_ENROLLMENT",
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        message: "Need assistance with PM-JAY e-Card generation for senior family member.",
      },
    });

    expect(astRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const astJson = JSON.parse(astRes.body);
    expect(astJson.success).toBe(true);
    expect(astJson.data.id).toBeDefined();
    expect(astJson.data.status).toBe("PENDING");
    expect(astJson.data.ashaUid).toBe("asha901");
    const assistanceId = astJson.data.id;

    // Step F: Citizen views submitted requests
    const citizenListRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(citizenListRes.statusCode).toBe(HTTP_STATUS.OK);
    const citizenListJson = JSON.parse(citizenListRes.body);
    expect(citizenListJson.data.requests).toHaveLength(1);
    expect(citizenListJson.data.requests[0].id).toBe(assistanceId);

    // Step G: ASHA checks incoming assistance requests
    const ashaListRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/assistance-requests",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(ashaListRes.statusCode).toBe(HTTP_STATUS.OK);
    const ashaListJson = JSON.parse(ashaListRes.body);
    expect(ashaListJson.data.requests).toHaveLength(1);
    expect(ashaListJson.data.requests[0].id).toBe(assistanceId);

    // Step H: Other ASHA checks queue -> 0 requests (IDOR defense)
    await establishConsent(otherAshaToken);
    const otherAshaListRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/assistance-requests",
      headers: { authorization: `Bearer ${otherAshaToken}` },
    });
    expect(otherAshaListRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(otherAshaListRes.body).data.requests).toHaveLength(0);

    // Step I: Unauthorized ASHA attempts to update request -> 404
    const badUpdateRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/assistance-requests/${assistanceId}`,
      headers: { authorization: `Bearer ${otherAshaToken}` },
      payload: {
        status: "RESOLVED",
        responseNote: "Unauthorized resolve attempt",
      },
    });
    expect(badUpdateRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // Step J: Authorized ASHA updates status to IN_PROGRESS
    const progressRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/assistance-requests/${assistanceId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        status: "IN_PROGRESS",
        responseNote: "Acknowledged. Visiting tomorrow with registration forms.",
      },
    });
    expect(progressRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(progressRes.body).data.status).toBe("IN_PROGRESS");

    // Step K: Authorized ASHA resolves request
    const resolveRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/assistance-requests/${assistanceId}`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        status: "RESOLVED",
        responseNote: "Doorstep visit completed. Family PM-JAY e-Cards generated.",
      },
    });
    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(resolveRes.body).data.status).toBe("RESOLVED");
    expect(JSON.parse(resolveRes.body).data.resolvedAt).toBeDefined();

    // Step L: Verify citizen sees resolved status and response note
    const updatedCitizenRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/assistance",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    const updatedCitizenJson = JSON.parse(updatedCitizenRes.body);
    expect(updatedCitizenJson.data.requests[0].status).toBe("RESOLVED");
    expect(updatedCitizenJson.data.requests[0].responseNote).toContain("e-Cards generated");

    // Step M: Verify audit log on authoritative case
    const cases = await app.caseRepository.listCasesByAsha("asha901");
    expect(cases).toHaveLength(1);
    const activities = await app.caseRepository.getActivities(cases[0].id);
    expect(activities.length).toBeGreaterThanOrEqual(2); // CASE_CREATED/ASSIGNED + ASSISTANCE_UPDATED/RESOLVED
  });
});
