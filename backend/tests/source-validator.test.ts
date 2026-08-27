import { describe, it, expect } from "vitest";
import { SourceValidator } from "../src/services/evidence/source-validator.js";
import { EvidenceCandidate } from "../../shared/types/evidence.js";

describe("SourceValidator Unit Tests (Phase 6 Domain & Authority Validation)", () => {
  const validator = new SourceValidator();

  it("1. classifies official central government domains with OFFICIAL_GOVERNMENT and high authority score", () => {
    const candidate: EvidenceCandidate = {
      url: "https://nha.gov.in/PM-JAY/guidelines-70plus.pdf",
      title: "NHA AB PM-JAY Operational Guidelines 70+",
      content: "All senior citizens aged 70 years and above are eligible for up to ₹5 lakh cover.",
      rawHostname: "nha.gov.in",
    };

    const result = validator.validateCandidate(candidate, "PM-JAY 70+ senior citizen eligibility");
    expect(result.sourceType).toBe("OFFICIAL_GOVERNMENT");
    expect(result.sourceDomain).toBe("nha.gov.in");
    expect(result.sourceOrganization).toContain("National Health Authority");
    expect(result.authorityScore).toBe(95);
    expect(result.isAuthoritative).toBe(true);
  });

  it("2. safely rejects spoofed or fake domains (e.g. pmjay.gov.in.fake.com)", () => {
    const candidate: EvidenceCandidate = {
      url: "https://pmjay.gov.in.fake-domain.com/phishing",
      title: "Fake PMJAY Guidelines",
      content: "Free insurance click here.",
      rawHostname: "pmjay.gov.in.fake-domain.com",
    };

    const result = validator.validateCandidate(candidate, "PM-JAY eligibility");
    expect(result.sourceType).toBe("UNVERIFIED");
    expect(result.isAuthoritative).toBe(false);
  });

  it("3. explicitly classifies commercial insurance aggregators and social media as REJECTED", () => {
    const candidate: EvidenceCandidate = {
      url: "https://policybazaar.com/health-insurance/pmjay-details/",
      title: "Everything you need to know about Ayushman Bharat",
      content: "Buy insurance online with top discounts.",
      rawHostname: "policybazaar.com",
    };

    const result = validator.validateCandidate(candidate, "Ayushman Bharat eligibility");
    expect(result.sourceType).toBe("REJECTED");
    expect(result.authorityScore).toBe(0);
    expect(result.isAuthoritative).toBe(false);
  });

  it("4. generates deterministic contentHash for change detection", () => {
    const hash1 = validator.computeContentHash(
      "https://pmjay.gov.in/guidelines",
      "PM-JAY Guidelines",
      "Exact excerpt A"
    );
    const hash2 = validator.computeContentHash(
      "https://pmjay.gov.in/guidelines",
      "PM-JAY Guidelines",
      "Exact excerpt A"
    );
    const hash3 = validator.computeContentHash(
      "https://pmjay.gov.in/guidelines",
      "PM-JAY Guidelines",
      "Changed excerpt B"
    );

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });
});
