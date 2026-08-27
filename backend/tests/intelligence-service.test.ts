import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntelligenceService } from "../src/services/ai/intelligence.service.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { EvidenceRepository } from "../src/repositories/evidence.repository.js";
import { AICacheRepository } from "../src/repositories/ai-cache.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { AIContextBuilder } from "../src/services/ai/ai-context-builder.js";
import { LyzrService } from "../src/services/ai/lyzr.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household, Member } from "../../shared/types/household.js";

describe("IntelligenceService Integration Tests (Phase 7 Orchestration & Caching)", () => {
  let householdRepo: HouseholdRepository;
  let schemeRepo: SchemeRepository;
  let evidenceRepo: EvidenceRepository;
  let aiCacheRepo: AICacheRepository;
  let eligibilityService: EligibilityService;
  let guidanceService: GuidanceService;
  let aiContextBuilder: AIContextBuilder;
  let lyzrService: LyzrService;
  let intelligenceService: IntelligenceService;

  beforeEach(async () => {
    householdRepo = new HouseholdRepository();
    schemeRepo = new SchemeRepository();
    evidenceRepo = new EvidenceRepository();
    aiCacheRepo = new AICacheRepository();
    eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);
    aiContextBuilder = new AIContextBuilder("test-secret");
    lyzrService = new LyzrService({ apiKey: "lyzr-test-key" });

    intelligenceService = new IntelligenceService(
      householdRepo,
      eligibilityService,
      guidanceService,
      schemeRepo,
      evidenceRepo,
      aiCacheRepo,
      aiContextBuilder,
      lyzrService
    );

    await seedSchemeRegistry(schemeRepo, true);
  });

  it("1. returns honest INSUFFICIENT_INFORMATION when citizen has not onboarded a household", async () => {
    const res = await intelligenceService.generateIntelligence("unonboarded_user", {
      capability: "EXPLAIN_ELIGIBILITY",
    });

    expect(res.certainty).toBe("INSUFFICIENT_INFORMATION");
    expect(res.explanation).toContain("complete your household profile onboarding first");
  });

  it("2. generates grounded explanation and caches response for subsequent identical requests", async () => {
    const household: Household = {
      id: "hh_user_1",
      ownerUid: "citizen_uid_1",
      headOfHouseholdName: "Ramesh Sharma",
      rationCardNumber: "RC-BR-12345",
      incomeCategory: "BPL",
      state: "Bihar",
      district: "Patna",
      village: "City",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const seniorMember: Member = {
      id: "mem_1",
      householdId: "hh_user_1",
      fullName: "Grandfather Sharma",
      age: 72,
      gender: "male",
      relationship: "Grandfather",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await householdRepo.createHousehold(household);
    await householdRepo.createMember(household.id, seniorMember);

    const mockAiResponse = {
      capability: "EXPLAIN_ELIGIBILITY" as const,
      contextVersion: "1.0",
      language: "en" as const,
      certainty: "GROUNDED" as const,
      explanation: "Your household matches the PM-JAY 70+ senior citizen pathway.",
      evidenceReferences: [],
      disclaimer: "Official enrollment required.",
      generatedAt: new Date().toISOString(),
    };

    const lyzrSpy = vi
      .spyOn(lyzrService, "generateIntelligence")
      .mockResolvedValue(mockAiResponse);

    // Call 1: Cache Miss -> Calls Lyzr
    const res1 = await intelligenceService.generateIntelligence("citizen_uid_1", {
      capability: "EXPLAIN_ELIGIBILITY",
    });
    expect(res1.explanation).toContain("PM-JAY 70+");
    expect(lyzrSpy).toHaveBeenCalledTimes(1);

    // Call 2: Cache Hit -> Skips Lyzr
    const res2 = await intelligenceService.generateIntelligence("citizen_uid_1", {
      capability: "EXPLAIN_ELIGIBILITY",
    });
    expect(res2.explanation).toContain("PM-JAY 70+");
    expect(res2.cacheHit).toBe(true);
    expect(lyzrSpy).toHaveBeenCalledTimes(1); // No second call!
  });
});
