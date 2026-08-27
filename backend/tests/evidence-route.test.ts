import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Evidence API Endpoints (/api/v1/evidence)", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_citizen601_citizen";
  const adminToken = "test_token_admin601_admin";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.evidenceRepository.clearMemoryStore();

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

  it("1. blocks unauthenticated requests to evidence endpoints", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/evidence/schemes/ab-pmjay",
    });
    expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. allows authenticated citizen to view verified evidence for active scheme", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/evidence/schemes/ab-pmjay",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("3. strictly rejects citizen role from POST /api/v1/evidence/search with 403 INSUFFICIENT_ROLE", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evidence/search",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        schemeId: "ab-pmjay",
        claim: "70+ senior citizen eligibility",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("INSUFFICIENT_ROLE");
  });

  it("4. allows admin role to execute controlled claim search via Tavily", async () => {
    await establishConsent(adminToken);

    // Pre-seed ADMIN role for admin601
    await app.userRepository.createUserProfile({
      uid: "admin601",
      email: "admin601@gov.in",
      displayName: "Admin User",
      phoneNumber: null,
      role: "ADMIN",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    vi.spyOn(app.evidenceService["tavilyService"], "search").mockResolvedValue([
      {
        url: "https://pmjay.gov.in/guidelines/70plus",
        title: "NHA 70+ Operational Guidelines",
        content: "Universal coverage for 70+ senior citizens.",
        rawHostname: "pmjay.gov.in",
      },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evidence/search",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        schemeId: "ab-pmjay",
        claim: "70+ senior citizen eligibility",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.evidence.length).toBe(1);
    expect(body.data.evidence[0].sourceDomain).toBe("pmjay.gov.in");
    expect(body.data.evidence[0].verificationStatus).toBe("PENDING_REVIEW");
  });
});
