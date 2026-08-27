import { describe, it, expect } from "vitest";
import {
  evaluateScalarComparison,
  evaluateRule,
  evaluateRuleSet,
  evaluateScheme,
} from "../src/services/eligibility/rule-engine.js";
import {
  RuleDefinition,
  RuleSet,
  Scheme,
  SchemeVersion,
} from "../../shared/types/eligibility.js";
import { Household, Member } from "../../shared/types/household.js";

describe("Deterministic Rule Engine Unit Tests (Phase 4C Comprehensive Suite)", () => {
  // Sample test fixture
  const sampleHousehold: Household = {
    id: "hh_test_101",
    ownerUid: "uid_citizen_101",
    headOfHouseholdName: "Ramesh Kumar",
    rationCardNumber: "RC-BR-12345",
    incomeCategory: "BPL",
    state: "Bihar",
    district: "Patna",
    village: "Bakhtiyarpur",
    pincode: "803212",
    contactPhone: "9876543210",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  const memberGrandfather72: Member = {
    id: "mem_1",
    householdId: "hh_test_101",
    fullName: "Gopal Prasad",
    age: 72,
    gender: "male",
    relationship: "Father",
    disabilityStatus: false,
    chronicConditions: ["Hypertension"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  const memberChild8: Member = {
    id: "mem_2",
    householdId: "hh_test_101",
    fullName: "Amit Kumar",
    age: 8,
    gender: "male",
    relationship: "Son",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  const memberAdult32: Member = {
    id: "mem_3",
    householdId: "hh_test_101",
    fullName: "Ramesh Kumar",
    age: 32,
    gender: "male",
    relationship: "Head",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  describe("Scalar and Array Comparisons", () => {
    it("1. FIELD_EQUALS handles string equality case-insensitively", () => {
      expect(evaluateScalarComparison("BPL", "FIELD_EQUALS", "bpl")).toBe(true);
      expect(evaluateScalarComparison("AAY", "FIELD_EQUALS", "BPL")).toBe(false);
    });

    it("2. FIELD_NOT_EQUALS evaluates correctly", () => {
      expect(evaluateScalarComparison("APL", "FIELD_NOT_EQUALS", "BPL")).toBe(true);
      expect(evaluateScalarComparison("BPL", "FIELD_NOT_EQUALS", "bpl")).toBe(false);
    });

    it("3. FIELD_IN evaluates array membership", () => {
      expect(evaluateScalarComparison("BPL", "FIELD_IN", ["BPL", "AAY"])).toBe(true);
      expect(evaluateScalarComparison("APL", "FIELD_IN", ["BPL", "AAY"])).toBe(false);
    });

    it("4. FIELD_NOT_IN evaluates array exclusion", () => {
      expect(evaluateScalarComparison("APL", "FIELD_NOT_IN", ["BPL", "AAY"])).toBe(true);
      expect(evaluateScalarComparison("BPL", "FIELD_NOT_IN", ["BPL", "AAY"])).toBe(false);
    });

    it("5. Numeric operators evaluate thresholds correctly", () => {
      expect(evaluateScalarComparison(70, "NUMBER_GREATER_THAN_OR_EQUAL", 70)).toBe(true);
      expect(evaluateScalarComparison(72, "NUMBER_GREATER_THAN_OR_EQUAL", 70)).toBe(true);
      expect(evaluateScalarComparison(69, "NUMBER_GREATER_THAN_OR_EQUAL", 70)).toBe(false);
      expect(evaluateScalarComparison(5, "NUMBER_LESS_THAN", 6)).toBe(true);
      expect(evaluateScalarComparison(6, "NUMBER_LESS_THAN", 6)).toBe(false);
      expect(evaluateScalarComparison(6, "NUMBER_LESS_THAN_OR_EQUAL", 6)).toBe(true);
      expect(evaluateScalarComparison(7, "NUMBER_LESS_THAN_OR_EQUAL", 6)).toBe(false);
    });
  });

  describe("Member Scope Operators", () => {
    it("6. MEMBER_EXISTS evaluates presence of matching member", () => {
      const rule: RuleDefinition = {
        id: "r_senior",
        name: "Senior Exists",
        description: "Senior member exists",
        scope: "MEMBER",
        field: "age",
        operator: "MEMBER_EXISTS",
        value: 70,
        requiredField: true,
        subRule: {
          id: "sub_age",
          name: "Age check",
          description: "Age >= 70",
          scope: "MEMBER",
          field: "age",
          operator: "NUMBER_GREATER_THAN_OR_EQUAL",
          value: 70,
          requiredField: true,
          explanations: { matched: "Age match", failed: "Age fail", missing: "Age missing" },
        },
        explanations: { matched: "Senior found", failed: "No senior", missing: "Member age missing" },
      };

      const resultWithSenior = evaluateRule(rule, sampleHousehold, [memberGrandfather72, memberAdult32]);
      expect(resultWithSenior.status).toBe("MATCHED");

      const resultWithoutSenior = evaluateRule(rule, sampleHousehold, [memberAdult32, memberChild8]);
      expect(resultWithoutSenior.status).toBe("FAILED");
    });

    it("7. MEMBER_COUNT evaluates minimum count of matching members", () => {
      const rule: RuleDefinition = {
        id: "r_child_count",
        name: "Children Count",
        description: "At least 1 child under 18",
        scope: "MEMBER",
        field: "age",
        operator: "MEMBER_COUNT",
        value: 1,
        requiredField: false,
        subRule: {
          id: "sub_child_age",
          name: "Child Age",
          description: "Age < 18",
          scope: "MEMBER",
          field: "age",
          operator: "NUMBER_LESS_THAN",
          value: 18,
          requiredField: true,
          explanations: { matched: "Child match", failed: "Not child", missing: "Age missing" },
        },
        explanations: { matched: "Child found", failed: "No child under 18", missing: "Age missing" },
      };

      const result = evaluateRule(rule, sampleHousehold, [memberChild8, memberAdult32]);
      expect(result.status).toBe("MATCHED");
    });
  });

  describe("Phase 4C AB-PMJAY Universal Senior Citizen 70+ Pathway", () => {
    const pmjaySeniorRule: RuleDefinition = {
      id: "rule_pmjay_senior_70plus",
      name: "Senior Citizen 70+ Criterion",
      description: "Household includes at least one senior citizen aged 70 or above",
      scope: "MEMBER",
      field: "age",
      operator: "NUMBER_GREATER_THAN_OR_EQUAL",
      value: 70,
      requiredField: true,
      isVerifiedRule: true,
      sourceEvidence: "NHA AB-PMJAY 70+ Guidelines Sec 2.1",
      pathwayCode: "PM-JAY-SENIOR-CITIZEN-70PLUS",
      explanations: {
        matched: "A family member meets the age-based 70+ eligibility criterion under the universal PM-JAY Senior Citizen pathway. Note: Official Aadhaar-based e-KYC enrollment on the Ayushman App/PM-JAY portal is required to receive benefits.",
        failed: "No household member aged 70 or older was found for the universal Senior Citizen PM-JAY pathway.",
        missing: "Family member age details are required to evaluate PM-JAY senior citizen 70+ support.",
      },
    };

    const pmjayScheme: Scheme = {
      id: "ab-pmjay",
      name: "Ayushman Bharat PM-JAY",
      shortName: "AB-PMJAY",
      description: "Universal senior citizen 70+ coverage",
      category: "SENIOR_CITIZEN",
      level: "CENTRAL",
      status: "ACTIVE",
      authority: "National Health Authority",
      benefitSummary: "₹5,00,000 cover for senior citizens aged 70+",
      eligibilitySummary: "Citizens aged 70 years and above",
      requiredDocuments: [],
      actions: [],
      currentVersion: "2026.2",
      sourceMetadata: {
        sourceOrganization: "National Health Authority",
        officialTitle: "NHA AB-PMJAY 70+ Operational Guidelines",
        sourceUrl: "https://pmjay.gov.in",
        sourceCitation: "NHA Guidelines 2026 Sec 2.1",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };

    const pmjayVersion: SchemeVersion = {
      id: "ver_abpmjay_2026_2",
      schemeId: "ab-pmjay",
      version: "2026.2",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
      ruleSet: {
        id: "rs_pmjay_2026_2",
        name: "PM-JAY 70+ Ruleset",
        combination: "ALL",
        rules: [pmjaySeniorRule],
      },
      requiredDocuments: [],
      actions: [],
      sourceMetadata: pmjayScheme.sourceMetadata,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };

    it("8. evaluates to ELIGIBLE when household has member aged 72 and preserves pathwayCode", () => {
      const result = evaluateScheme(
        pmjayScheme,
        pmjayVersion,
        sampleHousehold,
        [memberGrandfather72, memberAdult32]
      );

      expect(result.status).toBe("ELIGIBLE");
      expect(result.pathwayCode).toBe("PM-JAY-SENIOR-CITIZEN-70PLUS");
      expect(result.matchedRules.length).toBe(1);
      expect(result.matchedRules[0].sourceEvidence).toBe("NHA AB-PMJAY 70+ Guidelines Sec 2.1");
      expect(result.matchedRules[0].explanation).toContain("A family member meets the age-based 70+ eligibility criterion");
      expect(result.matchedRules[0].explanation).toContain("Official Aadhaar-based e-KYC enrollment on the Ayushman App/PM-JAY portal is required");
    });

    it("9. evaluates to NOT_ELIGIBLE when all members are under age 70 (even if BPL)", () => {
      const result = evaluateScheme(
        pmjayScheme,
        pmjayVersion,
        sampleHousehold,
        [memberAdult32, memberChild8]
      );

      expect(result.status).toBe("NOT_ELIGIBLE");
      expect(result.failedRules.length).toBe(1);
      expect(result.failedRules[0].explanation).toContain("No household member aged 70 or older was found");
    });

    it("10. evaluates to NEEDS_INFORMATION when member list is empty and age is required", () => {
      const result = evaluateScheme(pmjayScheme, pmjayVersion, sampleHousehold, []);

      expect(result.status).toBe("NEEDS_INFORMATION");
      expect(result.missingRequirements.length).toBeGreaterThan(0);
    });
  });

  describe("Phase 4C JSY Institutional Delivery Safety", () => {
    const jsyRule: RuleDefinition = {
      id: "rule_jsy_delivery_facility",
      name: "Institutional Delivery Facility Verification",
      description: "Delivery conducted at accredited healthcare facility",
      scope: "HOUSEHOLD",
      field: "institutionalDeliveryFacility",
      operator: "FIELD_EQUALS",
      value: "accredited_facility",
      requiredField: true,
      isVerifiedRule: true,
      sourceEvidence: "NHM JSY Guidelines Sec 4.1",
      pathwayCode: "JSY-INSTITUTIONAL-DELIVERY",
      explanations: {
        matched: "Accredited institutional delivery facility registration verified for JSY financial assistance.",
        failed: "Janani Suraksha Yojana financial assistance applies to deliveries conducted at accredited health institutions.",
        missing: "Additional maternal care details (institutional delivery facility record and ANC registration) are required to determine JSY eligibility. SwasthyaSetu does not assume eligibility without facility verification.",
      },
    };

    const jsyScheme: Scheme = {
      id: "jsy",
      name: "Janani Suraksha Yojana",
      shortName: "JSY",
      description: "Maternal health intervention",
      category: "MATERNAL",
      level: "CENTRAL",
      status: "ACTIVE",
      authority: "MoHFW / NHM",
      benefitSummary: "Cash assistance for institutional delivery",
      eligibilitySummary: "Pregnant women delivering at accredited health centers",
      requiredDocuments: [],
      actions: [],
      currentVersion: "2026.2",
      sourceMetadata: {
        sourceOrganization: "National Health Mission",
        officialTitle: "NHM JSY Operational Guidelines",
        sourceUrl: "https://nhm.gov.in",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };

    const jsyVersion: SchemeVersion = {
      id: "ver_jsy_2026_2",
      schemeId: "jsy",
      version: "2026.2",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
      ruleSet: {
        id: "rs_jsy_2026_2",
        name: "JSY Ruleset",
        combination: "ALL",
        rules: [jsyRule],
      },
      requiredDocuments: [],
      actions: [],
      sourceMetadata: jsyScheme.sourceMetadata,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    };

    it("11. returns NEEDS_INFORMATION for basic onboarding households without facility delivery records", () => {
      const result = evaluateScheme(jsyScheme, jsyVersion, sampleHousehold, [memberAdult32]);

      expect(result.status).toBe("NEEDS_INFORMATION");
      expect(result.missingRequirements.some((m) => m.field === "institutionalDeliveryFacility")).toBe(true);
      expect(result.missingRequirements[0].actionPrompt).toContain("Additional maternal care details (institutional delivery facility record and ANC registration) are required");
    });

    it("12. returns ELIGIBLE when verified institutional delivery facility record is present", () => {
      const householdWithFacility: Household = {
        ...sampleHousehold,
        ...({ institutionalDeliveryFacility: "accredited_facility" } as any),
      };

      const result = evaluateScheme(jsyScheme, jsyVersion, householdWithFacility, [memberAdult32]);
      expect(result.status).toBe("ELIGIBLE");
      expect(result.pathwayCode).toBe("JSY-INSTITUTIONAL-DELIVERY");
    });
  });
});
