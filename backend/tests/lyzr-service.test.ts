import { describe, it, expect, vi, beforeEach } from "vitest";
import { LyzrService } from "../src/services/ai/lyzr.service.js";

describe("LyzrService Unit Tests (Phase 7 Provider & Validation)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. throws AI_PROVIDER_UNCONFIGURED when API key is missing or empty", async () => {
    const service = new LyzrService({ apiKey: "" });
    await expect(
      service.generateIntelligence("Test Prompt", "anon_user_1")
    ).rejects.toThrow("AI_PROVIDER_UNCONFIGURED");
  });

  it("2. parses and validates valid JSON response conforming to AIIntelligenceResponseSchema", async () => {
    const service = new LyzrService({ apiKey: "lyzr-test-key" });

    const mockResponsePayload = {
      capability: "EXPLAIN_ELIGIBILITY",
      contextVersion: "1.0",
      language: "en",
      certainty: "GROUNDED",
      explanation:
        "Your household has a member aged 70 or above, matching the PM-JAY senior citizen pathway.",
      evidenceReferences: [
        {
          evidenceId: "ev_1",
          sourceTitle: "NHA Guidelines",
          sourceOrganization: "NHA",
          sourceUrl: "https://pmjay.gov.in/guidelines",
        },
      ],
      disclaimer: "Official enrollment required.",
      generatedAt: new Date().toISOString(),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: JSON.stringify(mockResponsePayload) }),
    } as unknown as Response);

    const result = await service.generateIntelligence("Test Prompt", "anon_user_1");

    expect(result.capability).toBe("EXPLAIN_ELIGIBILITY");
    expect(result.certainty).toBe("GROUNDED");
    expect(result.explanation).toContain("PM-JAY senior citizen pathway");
    expect(result.evidenceReferences.length).toBe(1);
  });

  it("3. handles markdown code fences in Lyzr text output safely", async () => {
    const service = new LyzrService({ apiKey: "lyzr-test-key" });

    const mockResponsePayload = {
      capability: "PRIORITIZE_GAPS",
      contextVersion: "1.0",
      language: "en",
      certainty: "GROUNDED",
      prioritizedGaps: [
        {
          gapId: "gap_1",
          priority: "P1",
          reason: "Required for PM-JAY enrollment",
          recommendedNextStep: "Complete Aadhaar e-KYC",
        },
      ],
      evidenceReferences: [],
      disclaimer: "Official enrollment required.",
      generatedAt: new Date().toISOString(),
    };

    const fencedText = `\`\`\`json\n${JSON.stringify(mockResponsePayload)}\n\`\`\``;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: fencedText }),
    } as unknown as Response);

    const result = await service.generateIntelligence("Test Prompt", "anon_user_1");

    expect(result.capability).toBe("PRIORITIZE_GAPS");
    expect(result.prioritizedGaps?.length).toBe(1);
    expect(result.prioritizedGaps?.[0].priority).toBe("P1");
  });

  it("4. handles HTTP 429 rate limiting with AI_PROVIDER_RATE_LIMITED", async () => {
    const service = new LyzrService({ apiKey: "lyzr-test-key" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    } as unknown as Response);

    await expect(
      service.generateIntelligence("Test Prompt", "anon_user_1")
    ).rejects.toThrow("AI_PROVIDER_RATE_LIMITED");
  });

  it("5. rejects malformed responses with AI_INVALID_RESPONSE", async () => {
    const service = new LyzrService({ apiKey: "lyzr-test-key" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: "Hello I am an AI without JSON format" }),
    } as unknown as Response);

    await expect(
      service.generateIntelligence("Test Prompt", "anon_user_1")
    ).rejects.toThrow("AI_INVALID_RESPONSE");
  });
});
