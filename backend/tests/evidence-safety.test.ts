import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvidenceService } from "../src/services/evidence/evidence.service.js";
import { EvidenceRepository } from "../src/repositories/evidence.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { TavilyService } from "../src/services/evidence/tavily.service.js";
import { SourceValidator } from "../src/services/evidence/source-validator.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household, Member } from "../../shared/types/household.js";

describe("Evidence Safety & Non-Mutation Tests (Tests A through R)", () => {
  let evidenceRepo: EvidenceRepository;
  let schemeRepo: SchemeRepository;
  let householdRepo: HouseholdRepository;
  let eligibilityService: EligibilityService;
  let tavilyService: TavilyService;
  let evidenceService: EvidenceService;
  let sourceValidator: SourceValidator;

  beforeEach(async () => {
    evidenceRepo = new EvidenceRepository();
    schemeRepo = new SchemeRepository();
    householdRepo = new HouseholdRepository();
    eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    tavilyService = new TavilyService("tvly-test-key");
    sourceValidator = new SourceValidator();
    evidenceService = new EvidenceService(evidenceRepo, schemeRepo, tavilyService, sourceValidator);

    await seedSchemeRegistry(schemeRepo, true);
  });

  it("TEST A: Tavily search result claiming 'qualifies' NEVER overrides deterministic rule engine NOT_ELIGIBLE", async () => {
    // 1. Household with a 30-year-old adult (ineligible for PM-JAY 70+ Senior Citizen pathway)
    const household: Household = {
      id: "hh_safety_01",
      ownerUid: "uid_citizen_young",
      headOfHouseholdName: "Amit Young",
      rationCardNumber: "RC-BR-1111",
      incomeCategory: "APL",
      state: "Bihar",
      district: "Patna",
      village: "Bakhtiyarpur",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const youngMember: Member = {
      id: "mem_y1",
      householdId: "hh_safety_01",
      fullName: "Amit Young",
      age: 30,
      gender: "male",
      relationship: "Head",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await householdRepo.createHousehold(household);
    await householdRepo.createMember(household.id, youngMember);

    // 2. Tavily returns a search result falsely claiming all citizens qualify
    vi.spyOn(tavilyService, "search").mockResolvedValue([
      {
        url: "https://pmjay.gov.in/news",
        title: "PM-JAY Universal Free Healthcare For Everyone",
        content: "Every citizen regardless of age now qualifies for full benefits.",
        rawHostname: "pmjay.gov.in",
      },
    ]);

    await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "Universal coverage for all ages" },
      "admin_1"
    );

    // 3. Evaluate household using the deterministic eligibility service
    const results = await eligibilityService.evaluateHouseholdForSchemes(household, [youngMember]);
    const pmjayResult = results.find((r) => r.schemeId === "ab-pmjay");

    // The deterministic rule engine output MUST remain NOT_ELIGIBLE!
    expect(pmjayResult?.status).toBe("NOT_ELIGIBLE");
  });

  it("TEST B: Unofficial blog results are classified REJECTED / UNVERIFIED and never become verified evidence", () => {
    const blogCandidate = {
      url: "https://policybazaar.com/pmjay-tips-and-tricks",
      title: "How to get free Ayushman card easily",
      content: "Top 5 tips to get benefits.",
      rawHostname: "policybazaar.com",
    };

    const res = sourceValidator.validateCandidate(blogCandidate, "PM-JAY eligibility");
    expect(res.sourceType).toBe("REJECTED");
    expect(res.isAuthoritative).toBe(false);
  });

  it("TEST C & M: Contradictory new official discovery records EVIDENCE_CONFLICT without mutating active rules", async () => {
    const conflictingCandidates = [
      {
        url: "https://pib.gov.in/PressReleasePage.aspx?PRID=9999",
        title: "Cabinet Approves Expansion: Senior citizen age 65 years now included in PM-JAY",
        content: "Senior citizens aged 65 years and above will receive coverage under new policy.",
        rawHostname: "pib.gov.in",
      },
    ];

    vi.spyOn(tavilyService, "search").mockResolvedValue(conflictingCandidates);

    const searchRes = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "Senior citizen age expansion" },
      "admin_1"
    );

    expect(searchRes.conflicts.length).toBeGreaterThan(0);
    expect(searchRes.conflicts[0].conflictType).toBe("AGE_THRESHOLD_CHANGED");

    // Check active version in SchemeRegistry - it MUST NOT be mutated!
    const activeVersion = await schemeRepo.getActiveVersion("ab-pmjay");
    expect(activeVersion?.version).toBe("2026.2");
    const seniorRule = activeVersion?.ruleSet.rules.find((r) => r.id === "rule_pmjay_senior_70plus");
    expect(seniorRule?.value).toBe(70); // Preserved exactly at 70!
  });

  it("TEST D & O: Tavily outage fails safely without fabricating evidence or altering existing verified records", async () => {
    // 1. Manually add verified evidence
    const verifiedRecord = {
      id: "ev_verified_existing",
      schemeId: "ab-pmjay",
      claim: "70+ senior citizen eligibility",
      query: "ab-pmjay query",
      queryHash: "hash_test_verified",
      sourceUrl: "https://nha.gov.in/guidelines",
      sourceDomain: "nha.gov.in",
      sourceOrganization: "NHA",
      officialTitle: "NHA Guidelines 70+",
      sourceType: "OFFICIAL_GOVERNMENT" as const,
      documentType: "GUIDELINE" as const,
      relevantExcerpt: "Universal 70+ cover.",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "VERIFIED" as const,
      contentHash: "hash123",
      discoveredBy: "SEED",
      authorityScore: 95,
      relevanceScore: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await evidenceRepo.createEvidence(verifiedRecord);

    // 2. Simulate Tavily network failure
    vi.spyOn(tavilyService, "search").mockRejectedValue(new Error("EVIDENCE_PROVIDER_UNAVAILABLE"));

    // 3. Searching for a NEW uncached claim fails safely with error (never fabricates)
    await expect(
      evidenceService.searchClaimEvidence(
        { schemeId: "ab-pmjay", claim: "New uncached claim" },
        "admin_1"
      )
    ).rejects.toThrow("EVIDENCE_PROVIDER_UNAVAILABLE");

    // 4. Existing verified evidence is completely intact and accessible
    const verifiedList = await evidenceService.getVerifiedSchemeEvidence("ab-pmjay");
    expect(verifiedList.length).toBe(1);
    expect(verifiedList[0].id).toBe("ev_verified_existing");
  });

  it("TEST E & P: DRAFT scheme evidence cannot become citizen-facing authoritative active schemes", async () => {
    const draftVersion = await schemeRepo.getSchemeVersion("state-health-assurance", "ver_statehealth_2026_1");
    // DRAFT scheme has status DRAFT and isVerified false
    expect(draftVersion?.status).toBe("DRAFT");
    expect(draftVersion?.sourceMetadata.isVerified).toBe(false);

    // Active version must be null for unverified/draft schemes
    const activeVersion = await schemeRepo.getActiveVersion("state-health-assurance");
    expect(activeVersion).toBeNull();

    // Evaluating household against schemes strictly excludes DRAFT scheme from active citizen matches
    const household: Household = {
      id: "hh_safety_draft",
      ownerUid: "uid_draft_test",
      headOfHouseholdName: "Ramesh Test",
      rationCardNumber: "RC-KA-9999",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru",
      village: "City",
      pincode: "560001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const results = await eligibilityService.evaluateHouseholdForSchemes(household, []);
    expect(results.some((r) => r.schemeId === "state-health-assurance")).toBe(false);
  });

  it("TEST F & H: Government domain source starts as PENDING_REVIEW and is NOT exposed in public verified view", async () => {
    vi.spyOn(tavilyService, "search").mockResolvedValue([
      {
        url: "https://mohfw.gov.in/order-2026.pdf",
        title: "MoHFW Draft Guidelines",
        content: "New health proposal.",
        rawHostname: "mohfw.gov.in",
      },
    ]);

    const searchRes = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "MoHFW new draft proposal" },
      "admin_1"
    );

    expect(searchRes.evidence[0].verificationStatus).toBe("PENDING_REVIEW");

    // Public verified evidence list must be empty because it is not yet verified by admin
    const publicList = await evidenceService.getVerifiedSchemeEvidence("ab-pmjay");
    expect(publicList.some((e) => e.id === searchRes.evidence[0].id)).toBe(false);
  });

  it("TEST J: Tavily queries containing citizen PII (phone, email, ration card) are strictly rejected", () => {
    expect(() =>
      tavilyService.normalizeQuery("Check eligibility for user with phone +919876543210")
    ).toThrow("EVIDENCE_PII_REJECTED");

    expect(() =>
      tavilyService.normalizeQuery("Check eligibility for citizen@gmail.com")
    ).toThrow("EVIDENCE_PII_REJECTED");

    expect(() =>
      tavilyService.normalizeQuery("Check eligibility for ration card RC-KA-99887766")
    ).toThrow("EVIDENCE_PII_REJECTED");
  });

  it("TEST K: Semantically identical queries with differing whitespace normalize to the exact same queryHash", () => {
    const hash1 = evidenceService.generateQueryHash("  PM-JAY   senior citizen 70+   guidelines  ");
    const hash2 = evidenceService.generateQueryHash("pm-jay senior citizen 70+ guidelines");
    expect(hash1).toBe(hash2);
  });

  it("TEST L: Changed content at the same URL generates a new distinct contentHash", () => {
    const h1 = sourceValidator.computeContentHash("https://nha.gov.in/guidelines", "Guidelines", "Text Version 1");
    const h2 = sourceValidator.computeContentHash("https://nha.gov.in/guidelines", "Guidelines", "Text Version 2");
    expect(h1).not.toBe(h2);
  });

  it("TEST G: A verified evidence record can be safely exposed to authenticated users", async () => {
    const verifiedRecord = {
      id: "ev_test_g",
      schemeId: "ab-pmjay",
      claim: "70+ senior citizen universal cover",
      query: "ab-pmjay query",
      queryHash: "hash_g",
      sourceUrl: "https://nha.gov.in/guidelines",
      sourceDomain: "nha.gov.in",
      sourceOrganization: "NHA",
      officialTitle: "NHA 70+ Guidelines",
      sourceType: "OFFICIAL_GOVERNMENT" as const,
      documentType: "GUIDELINE" as const,
      relevantExcerpt: "Universal cover for 70+.",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "VERIFIED" as const,
      contentHash: "hash_g_123",
      discoveredBy: "SEED",
      authorityScore: 95,
      relevanceScore: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await evidenceRepo.createEvidence(verifiedRecord);

    const publicList = await evidenceService.getVerifiedSchemeEvidence("ab-pmjay");
    expect(publicList.some((e) => e.id === "ev_test_g")).toBe(true);
    expect(publicList[0].sourceOrganization).toBe("NHA");
  });

  it("TEST I: A rejected source cannot be exposed as verified without explicit authorized admin transition", async () => {
    const rejectedRecord = {
      id: "ev_test_i",
      schemeId: "ab-pmjay",
      claim: "Commercial discount claim",
      query: "query_i",
      queryHash: "hash_i",
      sourceUrl: "https://policybazaar.com/claim",
      sourceDomain: "policybazaar.com",
      sourceOrganization: "Commercial Blog",
      officialTitle: "PolicyBazaar Article",
      sourceType: "REJECTED" as const,
      documentType: "UNKNOWN" as const,
      relevantExcerpt: "Commercial article.",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "REJECTED" as const,
      contentHash: "hash_i_123",
      discoveredBy: "SEARCH",
      authorityScore: 0,
      relevanceScore: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await evidenceRepo.createEvidence(rejectedRecord);

    const publicList = await evidenceService.getVerifiedSchemeEvidence("ab-pmjay");
    expect(publicList.some((e) => e.id === "ev_test_i")).toBe(false);
  });

  it("TEST N: A future policy effective date in discovered evidence does not alter current active eligibility", async () => {
    const household: Household = {
      id: "hh_future_test",
      ownerUid: "uid_future",
      headOfHouseholdName: "Future User",
      rationCardNumber: "RC-BR-8888",
      incomeCategory: "APL",
      state: "Bihar",
      district: "Patna",
      village: "Bakhtiyarpur",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const adult: Member = {
      id: "mem_future_1",
      householdId: "hh_future_test",
      fullName: "Future Adult",
      age: 62,
      gender: "male",
      relationship: "Head",
      disabilityStatus: false,
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Discovered evidence announces future policy change taking effect in 2030
    const futureRecord = {
      id: "ev_future_2030",
      schemeId: "ab-pmjay",
      claim: "Universal coverage age 60+ from year 2030",
      query: "query_future",
      queryHash: "hash_future",
      sourceUrl: "https://pib.gov.in/future-notification",
      sourceDomain: "pib.gov.in",
      sourceOrganization: "PIB",
      officialTitle: "Future Gazette Notification 2030",
      sourceType: "OFFICIAL_GOVERNMENT" as const,
      documentType: "GOVERNMENT_NOTIFICATION" as const,
      relevantExcerpt: "Effective 1 January 2030, age threshold will become 60 years.",
      effectiveDate: "2030-01-01",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "PENDING_REVIEW" as const,
      contentHash: "hash_future_123",
      discoveredBy: "SEARCH",
      authorityScore: 95,
      relevanceScore: 95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await evidenceRepo.createEvidence(futureRecord);

    // Evaluating the 62-year-old adult today still yields NOT_ELIGIBLE under active 2026 rules
    const results = await eligibilityService.evaluateHouseholdForSchemes(household, [adult]);
    const pmjay = results.find((r) => r.schemeId === "ab-pmjay");
    expect(pmjay?.status).toBe("NOT_ELIGIBLE");
  });

  it("TEST R: Tavily API key never leaks into evidence records, queries, or public representations", async () => {
    const mockCandidates = [
      {
        url: "https://pmjay.gov.in/guidelines",
        title: "PM-JAY Guidelines",
        content: "NHA guidelines.",
        rawHostname: "pmjay.gov.in",
      },
    ];

    vi.spyOn(tavilyService, "search").mockResolvedValue(mockCandidates);

    const res = await evidenceService.searchClaimEvidence(
      { schemeId: "ab-pmjay", claim: "70+ senior citizen guidelines" },
      "admin_1"
    );

    const json = JSON.stringify(res);
    expect(json).not.toContain("tvly-");
    expect(json).not.toContain("TAVILY_API_KEY");
  });
});
