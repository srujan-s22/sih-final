import { describe, it, expect } from "vitest";
import { GapDetectionService } from "../src/services/guidance/gap-detection.service.js";
import { EligibilityResult, SchemeVersion } from "../../shared/types/eligibility.js";

describe("GapDetectionService Unit Tests (Phase 5 Deterministic Gaps)", () => {
  const service = new GapDetectionService();

  const pmjayVersion: SchemeVersion = {
    id: "ver_abpmjay_2026_2",
    schemeId: "ab-pmjay",
    version: "2026.2",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ruleSet: { id: "rs_1", name: "Ruleset", combination: "ALL", rules: [] },
    requiredDocuments: [],
    actions: [],
    sourceMetadata: {
      sourceOrganization: "National Health Authority",
      officialTitle: "NHA AB-PMJAY 70+ Operational Guidelines",
      sourceUrl: "https://pmjay.gov.in",
      sourceCitation: "NHA 70+ Guidelines Sec 2.1",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      isVerified: true,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  const versionsMap = new Map<string, SchemeVersion>([["ab-pmjay", pmjayVersion]]);

  it("1. generates ENROLMENT_REQUIRED gap for ELIGIBLE PM-JAY 70+ pathway", () => {
    const results: EligibilityResult[] = [
      {
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        schemeShortName: "AB-PMJAY",
        schemeVersion: "2026.2",
        category: "SENIOR_CITIZEN",
        level: "CENTRAL",
        benefitSummary: "₹5,00,000 cover for senior citizens aged 70+",
        status: "ELIGIBLE",
        pathwayCode: "PM-JAY-SENIOR-CITIZEN-70PLUS",
        isVerifiedScheme: true,
        matchedRules: [],
        failedRules: [],
        missingRequirements: [],
        requiredDocuments: [],
        nextActions: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const gaps = service.detectGaps(results, versionsMap);
    expect(gaps.length).toBe(1);
    expect(gaps[0].type).toBe("ENROLMENT_REQUIRED");
    expect(gaps[0].priority).toBe("REQUIRED");
    expect(gaps[0].title).toContain("70+ Senior Citizen e-KYC Enrolment");
    expect(gaps[0].reason).toContain("Meets the age-based 70+ eligibility criterion under AB PM-JAY");
    expect(gaps[0].officialSource).toBeDefined();
  });

  it("2. generates MISSING_INFORMATION / FACILITY_REQUIREMENT gaps for NEEDS_INFORMATION results", () => {
    const results: EligibilityResult[] = [
      {
        schemeId: "jsy",
        schemeName: "Janani Suraksha Yojana",
        schemeShortName: "JSY",
        schemeVersion: "2026.2",
        category: "MATERNAL",
        level: "CENTRAL",
        benefitSummary: "Cash assistance for institutional delivery",
        status: "NEEDS_INFORMATION",
        isVerifiedScheme: true,
        matchedRules: [],
        failedRules: [],
        missingRequirements: [
          {
            field: "institutionalDeliveryFacility",
            scope: "HOUSEHOLD",
            description: "Institutional delivery facility verification",
            actionPrompt:
              "Additional maternal care details (institutional delivery facility record and ANC registration) are required to determine JSY eligibility.",
          },
        ],
        requiredDocuments: [],
        nextActions: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const gaps = service.detectGaps(results, new Map());
    expect(gaps.length).toBe(1);
    expect(gaps[0].type).toBe("FACILITY_REQUIREMENT");
    expect(gaps[0].priority).toBe("REQUIRED");
    expect(gaps[0].targetField).toBe("institutionalDeliveryFacility");
  });

  it("3. produces ZERO gaps for NOT_ELIGIBLE results (never creates misleading actions)", () => {
    const results: EligibilityResult[] = [
      {
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat PM-JAY",
        schemeShortName: "AB-PMJAY",
        schemeVersion: "2026.2",
        category: "SENIOR_CITIZEN",
        level: "CENTRAL",
        benefitSummary: "₹5,00,000 cover",
        status: "NOT_ELIGIBLE",
        isVerifiedScheme: true,
        matchedRules: [],
        failedRules: [],
        missingRequirements: [],
        requiredDocuments: [],
        nextActions: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const gaps = service.detectGaps(results, versionsMap);
    expect(gaps.length).toBe(0);
  });

  it("4. strictly excludes DRAFT / unverified schemes from producing gaps", () => {
    const results: EligibilityResult[] = [
      {
        schemeId: "state-health-assurance",
        schemeName: "State Universal Health Assurance",
        schemeShortName: "State Health",
        schemeVersion: "2026.1",
        category: "STATE",
        level: "STATE",
        benefitSummary: "Cashless coverage",
        status: "NEEDS_INFORMATION",
        isVerifiedScheme: false, // DRAFT / unverified
        matchedRules: [],
        failedRules: [],
        missingRequirements: [
          {
            field: "state",
            scope: "HOUSEHOLD",
            description: "State",
            actionPrompt: "State required",
          },
        ],
        requiredDocuments: [],
        nextActions: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const gaps = service.detectGaps(results, new Map());
    expect(gaps.length).toBe(0);
  });
});
