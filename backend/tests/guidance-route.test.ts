import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Citizen Healthcare Guidance API Endpoints (/api/v1/guidance/me)", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_citizen501_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset test memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();

    // Seed test schemes
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

  it("1. blocks unauthenticated requests with 401 AUTH_TOKEN_MISSING", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/guidance/me",
    });

    expect(response.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("AUTH_TOKEN_MISSING");
  });

  it("2. blocks unconsented requests with 403 CONSENT_REQUIRED", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/guidance/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(response.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("CONSENT_REQUIRED");
  });

  it("3. returns MORE_INFORMATION_NEEDED when authenticated & consented citizen has no household", async () => {
    await establishConsent(citizenToken);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/guidance/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(response.statusCode).toBe(HTTP_STATUS.OK);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.householdStatus).toBe("MORE_INFORMATION_NEEDED");
    expect(body.data.actionPlan.length).toBe(1);
    expect(body.data.actionPlan[0].actionType).toBe("COMPLETE_MISSING_INFORMATION");
  });

  it("4. evaluates complete guidance response for household with 72-year-old grandfather", async () => {
    await establishConsent(citizenToken);

    // Create household
    await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        headOfHouseholdName: "Ramesh Kumar",
        rationCardNumber: "RC-BR-9999",
        incomeCategory: "BPL",
        state: "Bihar",
        district: "Patna",
        village: "Bakhtiyarpur",
        pincode: "803212",
      },
    });

    // Add grandfather aged 72
    await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        fullName: "Gopal Prasad",
        age: 72,
        gender: "male",
        relationship: "Father",
        disabilityStatus: false,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/guidance/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(response.statusCode).toBe(HTTP_STATUS.OK);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const guidance = body.data;
    expect(guidance.householdStatus).toBe("ACTION_NEEDED");
    expect(guidance.eligibleSchemes.some((s: any) => s.schemeId === "ab-pmjay")).toBe(true);
    expect(guidance.gaps.some((g: any) => g.type === "ENROLMENT_REQUIRED")).toBe(true);
    expect(guidance.documentReadiness.items.length).toBeGreaterThan(0);
    expect(guidance.actionPlan.length).toBeGreaterThan(0);

    // Step numbers must be sequential
    guidance.actionPlan.forEach((act: any, idx: number) => {
      expect(act.stepNumber).toBe(idx + 1);
    });
  });
});
