import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household, Member } from "../../shared/types/household.js";

describe("AI Intelligence API Endpoints (/api/v1/ai)", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_citizen701_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.aiCacheRepository.clearMemoryStore();

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
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/intelligence",
      payload: { capability: "EXPLAIN_ELIGIBILITY" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. blocks unconsented requests with 403 CONSENT_REQUIRED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/intelligence",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { capability: "EXPLAIN_ELIGIBILITY" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("3. generates AI intelligence for authenticated citizen", async () => {
    await establishConsent(citizenToken);

    // Create household for citizen701
    const household: Household = {
      id: "hh_c701",
      ownerUid: "citizen701",
      headOfHouseholdName: "Citizen 701",
      rationCardNumber: "RC-BR-70101",
      incomeCategory: "BPL",
      state: "Bihar",
      district: "Patna",
      village: "City",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const seniorMember: Member = {
      id: "mem_701",
      householdId: "hh_c701",
      fullName: "Senior 701",
      age: 72,
      gender: "male",
      relationship: "Grandfather",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await app.householdRepository.createHousehold(household);
    await app.householdRepository.createMember(household.id, seniorMember);

    vi.spyOn(app.intelligenceService["lyzrService"], "generateIntelligence").mockResolvedValue({
      capability: "EXPLAIN_ELIGIBILITY",
      contextVersion: "1.0",
      language: "en",
      certainty: "GROUNDED",
      explanation: "Your household matches the PM-JAY senior citizen pathway.",
      evidenceReferences: [],
      disclaimer: "Official enrollment required.",
      generatedAt: new Date().toISOString(),
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/intelligence",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { capability: "EXPLAIN_ELIGIBILITY" },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.capability).toBe("EXPLAIN_ELIGIBILITY");
    expect(body.data.explanation).toContain("PM-JAY senior citizen pathway");
  });
});
