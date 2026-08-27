import { describe, it, expect } from "vitest";
import { ActionPlanService } from "../src/services/guidance/action-plan.service.js";
import { Gap, OverallDocumentReadiness } from "../../shared/types/guidance.js";
import { EligibilityResult, SchemeVersion } from "../../shared/types/eligibility.js";

describe("ActionPlanService Unit Tests (Phase 5 Deterministic Prioritization)", () => {
  const service = new ActionPlanService();

  const pmjayVersion: SchemeVersion = {
    id: "ver_abpmjay_2026_2",
    schemeId: "ab-pmjay",
    version: "2026.2",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    ruleSet: { id: "rs_1", name: "Ruleset", combination: "ALL", rules: [] },
    requiredDocuments: [],
    actions: [
      {
        id: "action-abpmjay-70-ekyc",
        title: "Complete 70+ Senior Citizen e-KYC on Ayushman App",
        description: "Download official Ayushman App or visit kiosk.",
        actionType: "DOCUMENT_VERIFICATION",
        priority: "HIGH",
      },
    ],
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

  it("1. generates ordered action plan with sequential stepNumber (1, 2, 3...)", () => {
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

    const gaps: Gap[] = [
      {
        id: "gap_ab-pmjay_enrolment_ekyc",
        schemeId: "ab-pmjay",
        schemeName: "AB-PMJAY",
        type: "ENROLMENT_REQUIRED",
        priority: "REQUIRED",
        title: "Complete Official 70+ Senior Citizen e-KYC Enrolment",
        description: "Aadhaar e-KYC required on Ayushman App.",
        reason: "Official enrolment required.",
        officialSource: pmjayVersion.sourceMetadata,
      },
    ];

    const docReadiness: OverallDocumentReadiness = {
      status: "UNKNOWN",
      totalRequired: 1,
      readyCount: 0,
      unknownCount: 1,
      missingCount: 0,
      items: [
        {
          id: "aadhaar-card-senior",
          name: "Aadhaar Card of Senior Citizen (Age 70+)",
          required: true,
          description: "Age verification",
          status: "UNKNOWN",
          relatedSchemeId: "ab-pmjay",
          relatedSchemeName: "AB-PMJAY",
        },
      ],
    };

    const actions = service.generateActionPlan(results, gaps, docReadiness, versionsMap);
    expect(actions.length).toBeGreaterThan(0);

    // Step numbers must be strictly sequential starting at 1
    actions.forEach((act, idx) => {
      expect(act.stepNumber).toBe(idx + 1);
    });

    // REQUIRED actions must come before IMPORTANT actions
    const requiredAction = actions.find((a) => a.priority === "REQUIRED");
    const importantAction = actions.find((a) => a.priority === "IMPORTANT");
    expect(requiredAction).toBeDefined();
    expect(importantAction).toBeDefined();
    expect(requiredAction!.stepNumber).toBeLessThan(importantAction!.stepNumber);
  });

  it("2. places missing information / ASHA actions before enrolment and document actions", () => {
    const gaps: Gap[] = [
      {
        id: "gap_jsy_facility",
        schemeId: "jsy",
        schemeName: "JSY",
        type: "FACILITY_REQUIREMENT",
        priority: "REQUIRED",
        title: "Connect with Local ASHA for Facility Registration",
        description: "Institutional delivery facility verification needed.",
        reason: "Required under NHM guidelines.",
      },
      {
        id: "gap_ab-pmjay_ekyc",
        schemeId: "ab-pmjay",
        schemeName: "AB-PMJAY",
        type: "ENROLMENT_REQUIRED",
        priority: "REQUIRED",
        title: "Complete 70+ e-KYC Enrolment",
        description: "Aadhaar e-KYC required.",
        reason: "Required before hospital claim.",
      },
    ];

    const docReadiness: OverallDocumentReadiness = {
      status: "READY",
      totalRequired: 0,
      readyCount: 0,
      unknownCount: 0,
      missingCount: 0,
      items: [],
    };

    const actions = service.generateActionPlan([], gaps, docReadiness, new Map());
    expect(actions.length).toBe(2);
    expect(actions[0].actionType).toBe("CONTACT_ASHA");
    expect(actions[1].actionType).toBe("COMPLETE_EKYC");
  });
});
