import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Phase 9.1: Connection API Endpoints", () => {
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

  it("1. blocks unauthenticated requests to directory and connection endpoints with 401", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: "/api/v1/asha/directory/ASHA-KA-7K42",
    });
    expect(res1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    expect(res2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. resolves safe public ASHA directory info without leaking internal UIDs or secrets", async () => {
    await establishConsent(ashaToken);

    // Get ASHA user profile to retrieve the auto-generated service code
    const ashaProfile = await app.userRepository.getUserById("asha901");
    expect(ashaProfile).toBeDefined();
    const serviceCode = ashaProfile!.ashaServiceCode;
    expect(serviceCode).toBeDefined();

    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/asha/directory/${serviceCode}`,
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.serviceCode).toBe(serviceCode);
    expect(json.data.displayName).toBeDefined();

    // Verify security invariant: no UID, email, or phone
    expect(json.data.uid).toBeUndefined();
    expect(json.data.email).toBeUndefined();
    expect(json.data.phoneNumber).toBeUndefined();
  });

  it("3. validates service code format and returns 400 for invalid format", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/directory/INVALID_CODE_123",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it("4. handles complete Citizen -> ASHA connection lifecycle end-to-end", async () => {
    // Step A: Setup ASHA
    await establishConsent(ashaToken);
    const ashaProfile = await app.userRepository.getUserById("asha901");
    const serviceCode = ashaProfile!.ashaServiceCode!;

    // Step B: Setup Citizen Household
    await establishConsent(citizenToken);
    const hhRes = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        headOfHouseholdName: "Siddharth Verma",
        rationCardNumber: "RC-KA-441122",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bangalore Rural",
        village: "Doddaballapura",
        pincode: "561203",
        contactPhone: "9888877777",
      },
    });
    expect(hhRes.statusCode).toBe(HTTP_STATUS.CREATED);

    // Step C: Citizen initial status is NONE
    const initialStatusRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/asha-connection",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(initialStatusRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(initialStatusRes.body).data.status).toBe("NONE");

    // Step D: Citizen submits connection request
    const requestRes = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        serviceCode,
        notes: "Family has elderly senior citizen who needs health scheme verification.",
      },
    });
    expect(requestRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const requestJson = JSON.parse(requestRes.body);
    expect(requestJson.data.status).toBe("PENDING");
    expect(requestJson.data.headOfHouseholdName).toBe("Siddharth Verma");
    const requestId = requestJson.data.id;

    // Step E: Citizen status now returns PENDING
    const pendingStatusRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/asha-connection",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(pendingStatusRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(pendingStatusRes.body).data.status).toBe("PENDING");

    // Step F: ASHA inspects pending requests queue
    const ashaQueueRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/connection-requests",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(ashaQueueRes.statusCode).toBe(HTTP_STATUS.OK);
    const queueJson = JSON.parse(ashaQueueRes.body);
    expect(queueJson.data.requests.length).toBe(1);
    expect(queueJson.data.requests[0].id).toBe(requestId);

    // Step G: Unassigned / different ASHA worker is blocked by IDOR protection
    await establishConsent(otherAshaToken);
    const idorRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${otherAshaToken}` },
      payload: { note: "Attempting unauthorized cross-worker acceptance" },
    });
    expect(idorRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // Step H: Assigned ASHA worker accepts connection request
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: { note: "Verified household in Doddaballapura. Accepted into caseload." },
    });
    expect(acceptRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(JSON.parse(acceptRes.body).data.status).toBe("ACTIVE");

    // Step I: Citizen status now returns ACTIVE
    const activeStatusRes = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/asha-connection",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(activeStatusRes.statusCode).toBe(HTTP_STATUS.OK);
    const activeJson = JSON.parse(activeStatusRes.body);
    expect(activeJson.data.status).toBe("ACTIVE");
    expect(activeJson.data.asha.serviceCode).toBe(serviceCode);

    // Step J: Verify that authoritative Phase 9 AshaCase was created and assigned to asha901
    const casesRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaToken}` },
    });
    expect(casesRes.statusCode).toBe(HTTP_STATUS.OK);
    const casesJson = JSON.parse(casesRes.body);
    expect(casesJson.data.cases.length).toBe(1);
    expect(casesJson.data.cases[0].headOfHouseholdName).toBe("Siddharth Verma");
  });

  it("5. returns application-level 404 when looking up a validly formatted but non-existent Service Code", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/asha/directory/ASHA-KA-ZZ99",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
    expect(json.code).toBe("ASHA_NOT_FOUND");
    expect(json.message).toContain("ASHA worker not found");
  });

  it("6. verifies Fastify route table exposes canonical /api/v1/asha/directory/:serviceCode", () => {
    const routeTree = app.printRoutes({ commonPrefix: false });
    expect(routeTree).toContain("/api/v1/asha/directory/:serviceCode");
    expect(routeTree).toContain("/api/v1/citizen/asha-connection");
    expect(routeTree).toContain("/api/v1/asha/connection-requests");
  });
});
