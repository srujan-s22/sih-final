import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Phase 11 — Voice API Endpoints (/api/v1/voice)", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_ashavoice01_asha";
  const adminToken = "test_token_adminvoice01_admin";
  const citizenToken = "test_token_citizenvoice01_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.voiceSessionRepository.clearMemoryStore();

    // Establish consent
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { consentVersion: "1.0", accepted: true },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { consentVersion: "1.0", accepted: true },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: { consentVersion: "1.0", accepted: true },
    });

    // Seed test household with contact phone
    await app.householdRepository.createHousehold({
      id: "hh_route_voice_01",
      ownerUid: "citizenvoice01",
      headOfHouseholdName: "Manjunath",
      rationCardNumber: "KA-06-RC-4321",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Tumakuru",
      village: "Kunigal",
      pincode: "572130",
      contactPhone: "+919988776655",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed test case with follow-up
    await app.caseRepository.createCase({
      id: "case_route_voice_01",
      householdId: "hh_route_voice_01",
      assignedAshaUid: "ashavoice01",
      headOfHouseholdName: "Manjunath",
      district: "Tumakuru",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      schemeId: "ab-pmjay",
      schemeName: "Ayushman Bharat PM-JAY",
      status: "IN_PROGRESS",
      priority: "HIGH",
      detectedGapsCount: 0,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await app.caseRepository.createFollowUp("case_route_voice_01", {
      id: "fup_route_voice_01",
      caseId: "case_route_voice_01",
      title: "PM-JAY e-KYC Card Handover",
      reason: "Deliver verified Ayushman Golden Card",
      status: "PENDING",
      scheduledAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. POST /api/v1/voice/webhooks/exotel/inbound handles Exotel incoming calls", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/webhooks/exotel/inbound",
      payload: {
        CallSid: "exo_test_inbound_001",
        From: "+919988776655",
        To: "080-SWASTHYA",
        CallStatus: "ringing",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("SwasthyaSetu");
  });

  it("2. POST /api/v1/voice/sessions creates a new voice session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/sessions",
      payload: {
        callerPhone: "+919988776655",
        language: "hi-IN",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toMatch(/^vses_/);
    expect(body.data.direction).toBe("INBOUND");
    expect(body.data.verificationStatus).toBe("UNVERIFIED");
  });

  it("3. POST /api/v1/voice/sessions/:id/turn processes turn with privacy protection", async () => {
    // Create session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/voice/sessions",
      payload: { callerPhone: "+919988776655" },
    });
    const sessionId = JSON.parse(createRes.body).data.id;

    // Process turn asking for personal application status while UNVERIFIED
    const turnRes = await app.inject({
      method: "POST",
      url: `/api/v1/voice/sessions/${sessionId}/turn`,
      payload: { transcript: "Check my application status" },
    });

    expect(turnRes.statusCode).toBe(200);
    const turnBody = JSON.parse(turnRes.body);
    expect(turnBody.success).toBe(true);
    expect(turnBody.data.verificationStatus).toBe("UNVERIFIED");
    expect(turnBody.data.textResponse).toContain("verify your identity");
  }, 15000);

  it("4. POST /api/v1/voice/sessions/:id/verify verifies identity with Ration Card code", async () => {
    // Create session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/voice/sessions",
      payload: { callerPhone: "+919988776655" },
    });
    const session = JSON.parse(createRes.body).data;

    // Link household to session in repository
    session.householdId = "hh_route_voice_01";
    await app.voiceSessionRepository.updateSession(session.id, session);

    // Verify identity with last 4 digits "4321" of "KA-06-RC-4321"
    const verifyRes = await app.inject({
      method: "POST",
      url: `/api/v1/voice/sessions/${session.id}/verify`,
      payload: { verificationCode: "4321" },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.verificationStatus).toBe("VERIFIED");
    expect(verifyBody.data.textResponse).toContain("Identity verified for Manjunath's household");
  }, 15000);

  it("5. POST /api/v1/voice/outbound initiates authorized outbound follow-up call", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/outbound",
      headers: {
        "x-swasthya-secret": "swasthyasetu-prod-automation-key-2026",
      },
      payload: {
        followUpId: "fup_route_voice_01",
        caseId: "case_route_voice_01",
        reason: "Automated test reminder",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session.direction).toBe("OUTBOUND");
    expect(body.data.session.relatedFollowUpId).toBe("fup_route_voice_01");
  });

  it("6. POST /api/v1/voice/callbacks/exotel/status records telephony outcome", async () => {
    // Create session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/voice/sessions",
      payload: { callerPhone: "+919988776655" },
    });
    const session = JSON.parse(createRes.body).data;

    const cbRes = await app.inject({
      method: "POST",
      url: "/api/v1/voice/callbacks/exotel/status",
      payload: {
        CallSid: session.callSid,
        Status: "completed",
        Duration: "120",
      },
    });

    expect(cbRes.statusCode).toBe(200);
    const cbBody = JSON.parse(cbRes.body);
    expect(cbBody.success).toBe(true);
  });

  it("7. GET /api/v1/admin/voice/telemetry requires ADMIN authorization and returns metrics", async () => {
    // Unauthenticated -> 401/403
    const unauthRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/voice/telemetry",
    });
    expect(unauthRes.statusCode).toBe(401);

    // Authenticated Admin -> 200 with telemetry metrics
    const adminRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/voice/telemetry",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(adminRes.statusCode).toBe(200);
    const body = JSON.parse(adminRes.body);
    expect(body.success).toBe(true);
    expect(body.data.virtualNumber).toBeDefined();
    expect(body.data.totalCallsToday).toBeGreaterThanOrEqual(0);
  });

  it("8. GET /api/v1/voice/config returns public configuration without exposing secrets", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/voice/config",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.voiceEnabled).toBe(true);
    expect(body.data.supportedLanguages).toBeDefined();
    expect(body.data.supportedLanguages.length).toBeGreaterThan(0);
    expect(body.data.displayHelplineText).toBeDefined();
    expect(body.data.displayHelplineText).not.toContain("1800-SWASTHYA"); // No fake toll-free invention
  });

  it("9. POST /api/v1/voice/citizen/request-call allows authenticated citizen to request voice assistant call", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/citizen/request-call",
      headers: {
        authorization: `Bearer ${citizenToken}`,
      },
      payload: {
        phoneNumber: "+919988776655",
        language: "hi-IN",
        reason: "PM-JAY senior citizen assistance",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session.direction).toBe("OUTBOUND");
    expect(body.data.session.citizenId).toBe("citizenvoice01");
    expect(body.data.session.verificationStatus).toBe("VERIFIED");
  });

  it("10. GET /api/v1/voice/citizen/calls retrieves authenticated citizen call history", async () => {
    // Make a call first
    await app.inject({
      method: "POST",
      url: "/api/v1/voice/citizen/request-call",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { phoneNumber: "+919988776655", language: "kn-IN" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/voice/citizen/calls",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].direction).toBe("OUTBOUND");
  });

  it("11. POST /api/v1/voice/asha/call-citizen allows ASHA to initiate call to beneficiary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/asha/call-citizen",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        caseId: "case_route_voice_01",
        reason: "Document verification visit reminder",
        language: "kn-IN",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.session.direction).toBe("OUTBOUND");
    expect(body.data.session.assignedAshaUid).toBe("ashavoice01");
    expect(body.data.session.relatedCaseId).toBe("case_route_voice_01");
  });

  it("12. GET /api/v1/voice/cases/:caseId/calls retrieves call logs for specific case", async () => {
    // Initiate an ASHA call for the case
    await app.inject({
      method: "POST",
      url: "/api/v1/voice/asha/call-citizen",
      headers: { authorization: `Bearer ${ashaToken}` },
      payload: {
        caseId: "case_route_voice_01",
        reason: "Scheduled follow-up outreach",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/voice/cases/case_route_voice_01/calls",
      headers: { authorization: `Bearer ${ashaToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].relatedCaseId).toBe("case_route_voice_01");
  });

  it("13. Medical Emergency keywords trigger instant 108 / 102 redirection boundary", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/voice/sessions",
      payload: { callerPhone: "+919988776655" },
    });
    const sessionId = JSON.parse(createRes.body).data.id;

    const turnRes = await app.inject({
      method: "POST",
      url: `/api/v1/voice/sessions/${sessionId}/turn`,
      payload: { transcript: "Emergency ambulance chahiye patient ko heart attack aaya hai" },
    });

    expect(turnRes.statusCode).toBe(200);
    const turnBody = JSON.parse(turnRes.body);
    expect(turnBody.success).toBe(true);
    expect(turnBody.data.detectedIntent).toBe("EMERGENCY");
    expect(turnBody.data.textResponse).toContain("108");
    expect(turnBody.data.textResponse).toContain("emergency");
  }, 15000);

  it("14. POST /api/v1/voice/citizen/request-call rejects invalid phone numbers with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/voice/citizen/request-call",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { phoneNumber: "12345", language: "hi-IN" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VOICE_VALIDATION_ERROR");
    expect(body.error.message).toContain("valid 10-digit Indian mobile number");
  });

  it("15. Security verification: credentials never appear in API responses or public config", async () => {
    const configRes = await app.inject({
      method: "GET",
      url: "/api/v1/voice/config",
    });

    expect(configRes.statusCode).toBe(200);
    const rawBody = configRes.body;
    expect(rawBody).not.toContain("EXOTEL_API_KEY");
    expect(rawBody).not.toContain("EXOTEL_API_TOKEN");
    expect(rawBody).not.toContain("EXOTEL_ACCOUNT_SID");
    expect(rawBody).not.toContain("Basic ");
    expect(rawBody).not.toContain("Authorization");

    const parsed = JSON.parse(rawBody);
    expect(parsed.data.accountSid).toBeUndefined();
    expect(parsed.data.apiKey).toBeUndefined();
    expect(parsed.data.apiToken).toBeUndefined();
  });
});
