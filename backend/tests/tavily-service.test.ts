import { describe, it, expect, vi, beforeEach } from "vitest";
import { TavilyService } from "../src/services/evidence/tavily.service.js";

describe("TavilyService Unit Tests (Phase 6 Integration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. throws EVIDENCE_PROVIDER_UNCONFIGURED when API key is missing", async () => {
    const service = new TavilyService("");
    await expect(service.search("PM-JAY eligibility")).rejects.toThrow(
      "EVIDENCE_PROVIDER_UNCONFIGURED"
    );
  });

  it("2. strictly normalizes search queries and rejects citizen PII (phone, email, ration card)", () => {
    const service = new TavilyService("tvly-test-key");

    // Valid query
    const clean = service.normalizeQuery("  PM-JAY   senior citizen 70+   guidelines  ");
    expect(clean).toBe("PM-JAY senior citizen 70+ guidelines");

    // Email rejection
    expect(() =>
      service.normalizeQuery("Check eligibility for user@example.com under PMJAY")
    ).toThrow("EVIDENCE_PII_REJECTED");

    // Phone number rejection
    expect(() =>
      service.normalizeQuery("Check eligibility for mobile 9876543210 under PMJAY")
    ).toThrow("EVIDENCE_PII_REJECTED");

    // Ration card number rejection
    expect(() =>
      service.normalizeQuery("Check ration card RC-BR-123456 under PMJAY")
    ).toThrow("EVIDENCE_PII_REJECTED");
  });

  it("3. normalizes successful Tavily REST API responses into EvidenceCandidate objects", async () => {
    const service = new TavilyService("tvly-test-key");

    const mockResponse = {
      query: "PM-JAY senior citizen 70+ guidelines",
      results: [
        {
          url: "https://pmjay.gov.in/guidelines/70plus",
          title: "PM-JAY 70+ Operational Guidelines",
          content: "Universal coverage for senior citizens aged 70 years and above.",
          score: 0.96,
          published_date: "2024-09-15",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const candidates = await service.search("PM-JAY senior citizen 70+ guidelines");
    expect(candidates.length).toBe(1);
    expect(candidates[0].url).toBe("https://pmjay.gov.in/guidelines/70plus");
    expect(candidates[0].rawHostname).toBe("pmjay.gov.in");
    expect(candidates[0].title).toBe("PM-JAY 70+ Operational Guidelines");
  });

  it("4. handles HTTP 429 rate limiting with EVIDENCE_RATE_LIMITED", async () => {
    const service = new TavilyService("tvly-test-key");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    } as unknown as Response);

    await expect(service.search("PM-JAY guidelines")).rejects.toThrow(
      "EVIDENCE_RATE_LIMITED"
    );
  });
});
