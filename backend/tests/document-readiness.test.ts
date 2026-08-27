import { describe, it, expect } from "vitest";
import { DocumentReadinessService } from "../src/services/guidance/document-readiness.service.js";
import { EligibilityResult } from "../../shared/types/eligibility.js";
import { Household } from "../../shared/types/household.js";

describe("DocumentReadinessService Unit Tests (Phase 5 Document Readiness)", () => {
  const service = new DocumentReadinessService();

  const sampleHousehold: Household = {
    id: "hh_test",
    ownerUid: "uid_test",
    headOfHouseholdName: "Ramesh Kumar",
    rationCardNumber: "RC-BR-12345",
    incomeCategory: "BPL",
    state: "Bihar",
    district: "Patna",
    village: "Bakhtiyarpur",
    pincode: "803212",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleResults: EligibilityResult[] = [
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
      requiredDocuments: [
        {
          id: "aadhaar-card-senior",
          name: "Aadhaar Card of Senior Citizen (Age 70+)",
          required: true,
          description: "Used for age verification and distinct Ayushman Vay Vandana card generation.",
          issuingAuthority: "UIDAI",
        },
        {
          id: "ration-card",
          name: "Ration Card",
          required: true,
          description: "Household verification.",
          issuingAuthority: "Food Dept",
        },
      ],
      nextActions: [],
      evaluatedAt: new Date().toISOString(),
    },
  ];

  it("1. defaults unconfirmed document possession to UNKNOWN (never assumes missing without confirmation)", () => {
    const readiness = service.evaluateReadiness(sampleResults, null, {});
    expect(readiness.items.length).toBe(2);
    expect(readiness.items[0].status).toBe("UNKNOWN");
    expect(readiness.status).toBe("UNKNOWN");
  });

  it("2. detects READY status when household has confirmed ration card or explicitly provided document", () => {
    const readiness = service.evaluateReadiness(sampleResults, sampleHousehold, {
      "aadhaar-card-senior": true,
    });

    const aadhaar = readiness.items.find((d) => d.id === "aadhaar-card-senior");
    const ration = readiness.items.find((d) => d.id === "ration-card");

    expect(aadhaar?.status).toBe("READY");
    expect(ration?.status).toBe("READY");
    expect(readiness.status).toBe("READY");
    expect(readiness.readyCount).toBe(2);
  });

  it("3. produces PARTIALLY_READY when some documents are known missing or some are unknown", () => {
    const readiness = service.evaluateReadiness(sampleResults, sampleHousehold, {
      "aadhaar-card-senior": false, // known missing
    });

    expect(readiness.status).toBe("PARTIALLY_READY");
    expect(readiness.missingCount).toBe(1);
  });

  it("4. excludes documents from NOT_ELIGIBLE or unverified schemes", () => {
    const ineligibleResults: EligibilityResult[] = [
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
        requiredDocuments: [
          {
            id: "aadhaar-card-senior",
            name: "Aadhaar Card",
            required: true,
            description: "Age verification",
          },
        ],
        nextActions: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const readiness = service.evaluateReadiness(ineligibleResults, sampleHousehold);
    expect(readiness.items.length).toBe(0);
    expect(readiness.status).toBe("READY");
  });
});
