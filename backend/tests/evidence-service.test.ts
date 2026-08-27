import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvidenceService } from "../src/services/evidence/evidence.service.js";
import { EvidenceRepository } from "../src/repositories/evidence.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { TavilyService } from "../src/services/evidence/tavily.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

describe("EvidenceService Integration Tests (Phase 6 Evidence Caching & Workflow)", () => {
  let evidenceRepo: EvidenceRepository;
  let schemeRepo: SchemeRepository;
  let tavilyService: TavilyService;
  let evidenceService: EvidenceService;

  beforeEach(async () => {
    evidenceRepo = new EvidenceRepository();
    schemeRepo = new SchemeRepository();
    tavilyService = new TavilyService("tvly-test-key");
    evidenceService = new EvidenceService(evidenceRepo, schemeRepo, tavilyService);

    await seedSchemeRegistry(schemeRepo, true);
  });

  it("1. caches searches and returns cacheHit: true on repeated identical or normalized queries", async () => {
    const mockCandidates = [
      {
        url: "https://pmjay.gov.in/guidelines/70plus",
        title: "PM-JAY 70+ Operational Guidelines",
        content: "Universal coverage for senior citizens aged 70 years and above.",
        rawHostname: "pmjay.gov.in",
      },
    ];

    vi.spyOn(tavilyService, "search").mockResolvedValue(mockCandidates);

    // First search: Cache Miss -> calls Tavily
    const res1 = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "70+ senior citizen eligibility" },
      "admin_1"
    );
    expect(res1.cacheHit).toBe(false);
    expect(res1.evidence.length).toBe(1);
    expect(res1.evidence[0].verificationStatus).toBe("PENDING_REVIEW"); // Discovered government source starts PENDING_REVIEW

    // Second search: Cache Hit -> skips Tavily
    const res2 = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "70+ senior citizen eligibility" },
      "admin_1"
    );
    expect(res2.cacheHit).toBe(true);
    expect(res2.evidence.length).toBe(1);
    expect(res2.queryHash).toBe(res1.queryHash);
  });

  it("2. allows explicit admin status update to VERIFIED with audit tracking", async () => {
    const mockCandidates = [
      {
        url: "https://nha.gov.in/guidelines/senior-70",
        title: "NHA AB-PMJAY 70+ Notification",
        content: "Cabinet approved universal coverage for age 70+.",
        rawHostname: "nha.gov.in",
      },
    ];

    vi.spyOn(tavilyService, "search").mockResolvedValue(mockCandidates);

    const searchRes = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "Universal senior citizen coverage" },
      "admin_1"
    );

    const evidenceId = searchRes.evidence[0].id;
    expect(searchRes.evidence[0].verificationStatus).toBe("PENDING_REVIEW");

    // Admin verifies the evidence
    const verified = await evidenceService.updateVerificationStatus(
      evidenceId,
      "VERIFIED",
      "admin_1",
      "Audited against official NHA Gazette notification."
    );

    expect(verified?.verificationStatus).toBe("VERIFIED");
    expect(verified?.verifiedBy).toBe("admin_1");

    // Now it appears in public verified evidence view
    const publicView = await evidenceService.getVerifiedSchemeEvidence("ab-pmjay");
    expect(publicView.some((e) => e.id === evidenceId)).toBe(true);
  });
});
