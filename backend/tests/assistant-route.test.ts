import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("Phase 8: Assistant API Endpoints (/api/v1/assistant)", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_asstcitizen_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
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

  it("1. GET /api/v1/assistant/status blocks unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assistant/status",
    });
    expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("2. GET /api/v1/assistant/status returns status for authenticated user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assistant/status",
      headers: { authorization: `Bearer ${citizenToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("CITIZEN");
    expect(body.data.supportedLanguages).toContain("en");
    expect(body.data.supportedLanguages).toContain("hi");
    expect(body.data.supportedLanguages).toContain("kn");
  });

  it("3. POST /api/v1/assistant/chat blocks unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      payload: { message: "What schemes can I get?" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("4. POST /api/v1/assistant/chat requires active consent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { message: "What schemes can I get?" },
    });
    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    const body = res.json();
    expect(body.code).toBe("CONSENT_REQUIRED");
  });

  it("5. POST /api/v1/assistant/chat returns 400 on invalid empty message", async () => {
    await establishConsent(citizenToken);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { message: "" },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it("6. POST /api/v1/assistant/chat processes authenticated message and returns grounded reply", async () => {
    await establishConsent(citizenToken);

    // Mock geminiService generateContent
    vi.spyOn(app.geminiService, "isConfigured").mockReturnValue(true);
    vi.spyOn(app.geminiService, "generateContent").mockResolvedValue(
      "Ayushman Bharat PM-JAY is an active health scheme providing Rs. 5 Lakh coverage for eligible families."
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        message: "What is PM-JAY?",
        language: "en",
      },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reply).toContain("Ayushman Bharat PM-JAY");
    expect(body.data.disclaimer).toContain("SwasthyaSetu Assistant");
    expect(body.data.conversationId).toBeDefined();
    expect(body.data.groundingData).toBeDefined();
  });

  it("7. POST /api/v1/assistant/chat returns 503 when Gemini service is unconfigured", async () => {
    await establishConsent(citizenToken);

    // Force unconfigured
    vi.spyOn(app.geminiService, "isConfigured").mockReturnValue(false);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: {
        message: "What is PM-JAY?",
      },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("GEMINI_UNCONFIGURED");
    expect(body.message).toContain("The conversational assistant is currently unavailable");
  });
});
