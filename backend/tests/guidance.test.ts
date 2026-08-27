import { describe, it, expect, beforeEach } from "vitest";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household, Member } from "../../shared/types/household.js";

describe("GuidanceService Integration Tests (Phase 5 Full Pipeline)", () => {
  let householdRepo: HouseholdRepository;
  let schemeRepo: SchemeRepository;
  let eligibilityService: EligibilityService;
  let guidanceService: GuidanceService;

  beforeEach(async () => {
    householdRepo = new HouseholdRepository();
    schemeRepo = new SchemeRepository();
    eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);

    // Seed verified schemes
    await seedSchemeRegistry(schemeRepo, true);
  });

  it("1. handles citizen without household gracefully (MORE_INFORMATION_NEEDED)", async () => {
    const guidance = await guidanceService.getCitizenGuidance("uid_no_household");
    expect(guidance.householdStatus).toBe("MORE_INFORMATION_NEEDED");
    expect(guidance.evaluatedSchemesCount).toBe(0);
    expect(guidance.actionPlan.length).toBe(1);
    expect(guidance.actionPlan[0].actionType).toBe("COMPLETE_MISSING_INFORMATION");
  });

  it("2. produces ACTION_NEEDED and ENROLMENT_REQUIRED for household with 72yo grandfather", async () => {
    const household: Household = {
      id: "hh_guidance_101",
      ownerUid: "uid_citizen_grandfather",
      headOfHouseholdName: "Ramesh Kumar",
      rationCardNumber: "RC-BR-9999",
      incomeCategory: "BPL",
      state: "Bihar",
      district: "Patna",
      village: "Bakhtiyarpur",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const grandfather: Member = {
      id: "mem_g1",
      householdId: "hh_guidance_101",
      fullName: "Gopal Prasad",
      age: 72,
      gender: "male",
      relationship: "Father",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await householdRepo.createHousehold(household);
    await householdRepo.createMember(household.id, grandfather);

    const guidance = await guidanceService.getCitizenGuidance("uid_citizen_grandfather");

    expect(guidance.householdStatus).toBe("ACTION_NEEDED");
    expect(guidance.eligibleSchemes.length).toBe(1);
    expect(guidance.eligibleSchemes[0].schemeId).toBe("ab-pmjay");
    expect(guidance.eligibleSchemes[0].pathwayCode).toBe("PM-JAY-SENIOR-CITIZEN-70PLUS");

    // Must have enrolment gap
    const enrolmentGap = guidance.gaps.find((g) => g.type === "ENROLMENT_REQUIRED");
    expect(enrolmentGap).toBeDefined();

    // Must have action plan with sequential step numbers
    expect(guidance.actionPlan.length).toBeGreaterThan(0);
    expect(guidance.actionPlan[0].stepNumber).toBe(1);
  });

  it("3. produces MORE_INFORMATION_NEEDED and FACILITY_REQUIREMENT gap for JSY when facility is unrecorded", async () => {
    const household: Household = {
      id: "hh_guidance_102",
      ownerUid: "uid_citizen_adult_only",
      headOfHouseholdName: "Ramesh Kumar",
      rationCardNumber: "RC-BR-8888",
      incomeCategory: "BPL",
      state: "Bihar",
      district: "Patna",
      village: "Bakhtiyarpur",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const adultHead: Member = {
      id: "mem_a1",
      householdId: "hh_guidance_102",
      fullName: "Ramesh Kumar",
      age: 32,
      gender: "male",
      relationship: "Head",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await householdRepo.createHousehold(household);
    await householdRepo.createMember(household.id, adultHead);

    const guidance = await guidanceService.getCitizenGuidance("uid_citizen_adult_only");

    expect(guidance.householdStatus).toBe("MORE_INFORMATION_NEEDED");
    expect(guidance.informationNeededSchemes.some((s) => s.schemeId === "jsy")).toBe(true);

    const facilityGap = guidance.gaps.find((g) => g.type === "FACILITY_REQUIREMENT");
    expect(facilityGap).toBeDefined();
  });
});
