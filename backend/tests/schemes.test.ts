import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Scheme Registry & Deterministic Eligibility API (Phase 4C Honest Evaluation)", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_citizen201_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset test memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();

    // Seed test schemes (includes verified production schemes + draft fixtures)
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

  describe("Scheme Registry Endpoints (/api/v1/schemes)", () => {
    it("1. lists only ACTIVE verified healthcare schemes (excludes DRAFT fixtures)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schemes",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verified schemes must be present
      expect(body.data.schemes.some((s: any) => s.id === "ab-pmjay")).toBe(true);
      expect(body.data.schemes.some((s: any) => s.id === "jsy")).toBe(true);

      // Unverified DRAFT schemes must NOT be in public active list
      expect(body.data.schemes.some((s: any) => s.id === "state-health-assurance")).toBe(false);
      expect(body.data.schemes.some((s: any) => s.id === "jssk")).toBe(false);
      expect(body.data.schemes.some((s: any) => s.id === "ab-ark-karnataka")).toBe(false);
    });

    it("2. retrieves verified scheme details with source metadata and citation", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schemes/ab-pmjay",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.scheme.id).toBe("ab-pmjay");
      expect(body.data.activeVersion).toBeDefined();
      expect(body.data.activeVersion.version).toBe("2026.2");
      expect(body.data.activeVersion.sourceMetadata.isVerified).toBe(true);
      expect(body.data.activeVersion.sourceMetadata.sourceUrl).toBe("https://pmjay.gov.in");
      expect(body.data.activeVersion.sourceMetadata.sourceCitation).toBeDefined();
    });

    it("3. allows inspecting DRAFT scheme directly by ID but reports its DRAFT status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schemes/state-health-assurance",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.scheme.status).toBe("DRAFT");
      expect(body.data.activeVersion.status).toBe("DRAFT");
      expect(body.data.activeVersion.sourceMetadata.isVerified).toBe(false);
    });

    it("4. returns 404 for an unknown scheme ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/schemes/unknown-scheme-id",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("SCHEME_NOT_FOUND");
    });
  });

  describe("Deterministic Eligibility Evaluation Endpoints (/api/v1/eligibility/me)", () => {
    it("5. blocks unauthenticated requests with 401 AUTH_TOKEN_MISSING", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/eligibility/me",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_TOKEN_MISSING");
    });

    it("6. blocks unconsented requests with 403 CONSENT_REQUIRED", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/eligibility/me",
        headers: { authorization: `Bearer ${citizenToken}` },
      });

      expect(response.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("CONSENT_REQUIRED");
    });

    it("7. evaluates citizen household with adult member (< 70): PM-JAY is NOT_ELIGIBLE (not falsely claimed)", async () => {
      await establishConsent(citizenToken);

      // Create BPL household
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

      // Add a 32-year old adult member
      await app.inject({
        method: "POST",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizenToken}` },
        payload: {
          fullName: "Ramesh Kumar",
          age: 32,
          gender: "male",
          relationship: "Head",
          disabilityStatus: false,
        },
      });

      const evalResponse = await app.inject({
        method: "GET",
        url: "/api/v1/eligibility/me",
        headers: { authorization: `Bearer ${citizenToken}` },
      });

      expect(evalResponse.statusCode).toBe(HTTP_STATUS.OK);
      const evalBody = JSON.parse(evalResponse.body);
      expect(evalBody.success).toBe(true);

      // PM-JAY 70+ pathway is NOT_ELIGIBLE because member is 32 (BPL alone does NOT make them eligible)
      const abpmjay = evalBody.data.results.find((r: any) => r.schemeId === "ab-pmjay");
      expect(abpmjay).toBeDefined();
      expect(abpmjay.status).toBe("NOT_ELIGIBLE");

      // JSY: institutionalDeliveryFacility is absent -> returns NEEDS_INFORMATION
      const jsy = evalBody.data.results.find((r: any) => r.schemeId === "jsy");
      expect(jsy).toBeDefined();
      expect(jsy.status).toBe("NEEDS_INFORMATION");

      // DRAFT unverified schemes (state-health-assurance, jssk, ab-ark) are NOT returned
      expect(evalBody.data.results.some((r: any) => r.schemeId === "state-health-assurance")).toBe(false);
      expect(evalBody.data.results.some((r: any) => r.schemeId === "jssk")).toBe(false);
    });

    it("8. evaluates citizen household with 72-year-old grandfather: PM-JAY returns ELIGIBLE under 70+ pathway", async () => {
      await establishConsent(citizenToken);

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

      // Add a 72-year-old grandfather member
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

      const evalResponse = await app.inject({
        method: "GET",
        url: "/api/v1/eligibility/me",
        headers: { authorization: `Bearer ${citizenToken}` },
      });

      const evalBody = JSON.parse(evalResponse.body);
      const abpmjay = evalBody.data.results.find((r: any) => r.schemeId === "ab-pmjay");
      expect(abpmjay).toBeDefined();
      expect(abpmjay.status).toBe("ELIGIBLE");
      expect(abpmjay.pathwayCode).toBe("PM-JAY-SENIOR-CITIZEN-70PLUS");
      expect(abpmjay.matchedRules[0].explanation).toContain("A family member meets the age-based 70+ eligibility criterion");
      expect(abpmjay.matchedRules[0].explanation).toContain("Official Aadhaar-based e-KYC enrollment on the Ayushman App/PM-JAY portal is required");
    });

    it("9. prevents single scheme evaluation of DRAFT unverified schemes via /me/:schemeId", async () => {
      await establishConsent(citizenToken);

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

      // Attempting to evaluate DRAFT scheme returns 404
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/eligibility/me/state-health-assurance",
        headers: { authorization: `Bearer ${citizenToken}` },
      });

      expect(response.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("SCHEME_NOT_FOUND");
    });
  });
});
