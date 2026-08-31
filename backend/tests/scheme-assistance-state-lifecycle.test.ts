import { describe, it, expect, beforeEach } from "vitest";
import { CaseService } from "../src/services/case.service.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { ConnectionRepository } from "../src/repositories/connection.repository.js";
import { AssistanceRepository } from "../src/repositories/assistance.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { UserProfile } from "../../shared/types/auth.js";
import { Household, Member } from "../../shared/types/household.js";

describe("Scheme Assistance State-Lifecycle Audit & Verification (PM-JAY & JSY)", () => {
  let caseRepo: CaseRepository;
  let householdRepo: HouseholdRepository;
  let schemeRepo: SchemeRepository;
  let userRepo: UserRepository;
  let connectionRepo: ConnectionRepository;
  let assistanceRepo: AssistanceRepository;
  let eligibilityService: EligibilityService;
  let guidanceService: GuidanceService;
  let caseService: CaseService;

  const ashaProfile: UserProfile = {
    uid: "asha-state-test-1",
    email: "asha.state@test.swasthyasetu.gov.in",
    role: "ASHA",
    displayName: "Sunita Sharma",
    phoneNumber: "9876543210",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const citizenProfile: UserProfile = {
    uid: "citizen-state-test-1",
    email: "citizen.state@test.swasthyasetu.gov.in",
    role: "CITIZEN",
    displayName: "Ramesh Sharma",
    phoneNumber: "9123456789",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testHousehold: Household = {
    id: "hh-state-test-1",
    ownerUid: citizenProfile.uid,
    headOfHouseholdName: "Ramesh Sharma",
    state: "Uttar Pradesh",
    district: "Varanasi",
    village: "Phoolpur",
    pincode: "221001",
    incomeCategory: "BPL",
    rationCardNumber: "RC-UP-BPL-998877",
    contactPhone: "9123456789",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const memberHead: Member = {
    id: "mem-head-1",
    householdId: testHousehold.id,
    fullName: "Ramesh Sharma",
    relationship: "HEAD",
    gender: "male",
    age: 45,
    maternalStatus: "none",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const memberSenior: Member = {
    id: "mem-senior-1",
    householdId: testHousehold.id,
    fullName: "Gopal Sharma",
    relationship: "FATHER",
    gender: "male",
    age: 72,
    maternalStatus: "none",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const memberPregnant: Member = {
    id: "mem-pregnant-1",
    householdId: testHousehold.id,
    fullName: "Anita Sharma",
    relationship: "WIFE",
    gender: "female",
    age: 26,
    maternalStatus: "pregnant",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    caseRepo = new CaseRepository(null);
    householdRepo = new HouseholdRepository(null);
    schemeRepo = new SchemeRepository(null);
    userRepo = new UserRepository(null);
    connectionRepo = new ConnectionRepository(null);
    assistanceRepo = new AssistanceRepository(null);

    caseRepo.clearMemoryStore();
    householdRepo.clearMemoryStore();
    schemeRepo.clearMemoryStore();
    userRepo.clearMemoryStore();
    connectionRepo.clearMemoryStore();
    assistanceRepo.clearMemoryStore();

    await userRepo.createUserProfile(ashaProfile);
    await userRepo.createUserProfile(citizenProfile);
    await seedSchemeRegistry(schemeRepo, true);

    eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);
    caseService = new CaseService(
      caseRepo,
      householdRepo,
      eligibilityService,
      guidanceService,
      userRepo,
      connectionRepo,
      assistanceRepo
    );

    await householdRepo.createHousehold(testHousehold);
    await householdRepo.createMember(testHousehold.id, memberHead);
    await householdRepo.createMember(testHousehold.id, memberSenior);
    await householdRepo.createMember(testHousehold.id, memberPregnant);

    await caseRepo.createCase({
      id: "case-state-test-1",
      householdId: testHousehold.id,
      assignedAshaUid: ashaProfile.uid,
      headOfHouseholdName: testHousehold.headOfHouseholdName,
      district: testHousehold.district,
      state: testHousehold.state,
      incomeCategory: testHousehold.incomeCategory,
      memberCount: 3,
      status: "NEW",
      priority: "HIGH",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe("1. Initial Unassisted State Verification", () => {
    it("should return an unassisted case with 0 tasks and empty journey milestones", async () => {
      const detail = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail.case.status).toBe("NEW");
      expect(detail.case.schemeId).toBeFalsy();
      expect(detail.tasks).toHaveLength(0);
      expect(detail.journeySteps).toHaveLength(0);
      expect(detail.assistanceRequests).toHaveLength(0);
    });
  });

  describe("2. PM-JAY Lifecycle: Not Started -> Start -> In Progress (0/5 to 5/5) -> Resolved", () => {
    it("should initialize PM-JAY with exactly 5 field tasks, 7 milestones, and advance sequentially to resolution", async () => {
      // ASHA initiates PM-JAY
      const initResult = await caseService.initiateSchemeAssistance(
        "case-state-test-1",
        {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: memberSenior.id,
          priority: "HIGH",
          notes: "Initiated doorstep assistance for Senior Citizen PM-JAY.",
        },
        ashaProfile
      );

      expect(initResult.case.schemeId).toBe("ab-pmjay");
      expect(initResult.case.status).toBe("IN_PROGRESS");
      expect(initResult.case.beneficiaryMemberId).toBe(memberSenior.id);
      expect(initResult.case.beneficiaryName).toBe("Gopal Sharma");
      expect(initResult.tasks).toHaveLength(5);
      expect(initResult.journeySteps).toHaveLength(7);

      // Verify task counting model: PM-JAY starts at 0/5
      const detail0 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      const completed0 = detail0.tasks.filter((t) => t.status === "COMPLETED").length;
      expect(completed0).toBe(0);
      expect(detail0.tasks.length).toBe(5);

      // Complete Task 1 (1/5)
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[0].id, { notes: "Aadhaar verified" }, ashaProfile);
      const detail1 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail1.tasks.filter((t) => t.status === "COMPLETED").length).toBe(1);
      expect(detail1.case.status).toBe("IN_PROGRESS");

      // Complete Task 2 (2/5)
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[1].id, { notes: "e-KYC consent obtained" }, ashaProfile);
      const detail2 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail2.tasks.filter((t) => t.status === "COMPLETED").length).toBe(2);

      // Complete Task 3 (3/5)
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[2].id, { notes: "NHA application submitted" }, ashaProfile);
      const detail3 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail3.tasks.filter((t) => t.status === "COMPLETED").length).toBe(3);

      // Complete Task 4 (4/5)
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[3].id, { notes: "Ayushman card downloaded" }, ashaProfile);
      const detail4 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail4.tasks.filter((t) => t.status === "COMPLETED").length).toBe(4);
      expect(detail4.case.status).toBe("IN_PROGRESS");

      // Complete Task 5 (5/5) -> RESOLUTION
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[4].id, { notes: "Empanelled hospital list handed over" }, ashaProfile);
      const detail5 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail5.tasks.filter((t) => t.status === "COMPLETED").length).toBe(5);
      expect(detail5.tasks.length).toBe(5);
      expect(detail5.case.status).toBe("RESOLVED");
      expect(detail5.case.currentJourneyStep).toBe("CASE_RESOLVED");
      expect(detail5.journeySteps.every((s) => s.status === "COMPLETED")).toBe(true);

      // Verify linked assistance request was marked RESOLVED
      const requests = await assistanceRepo.listRequestsByHouseholdId(testHousehold.id);
      const pmjayReq = requests.find((r) => r.schemeId === "ab-pmjay");
      expect(pmjayReq).toBeDefined();
      expect(pmjayReq?.status).toBe("RESOLVED");
    });
  });

  describe("3. JSY Lifecycle: Not Started -> Start -> In Progress (0/6 to 6/6) -> Resolved", () => {
    it("should initialize JSY with exactly 6 field tasks, 8 milestones, and advance sequentially to resolution", async () => {
      // ASHA initiates JSY
      const initResult = await caseService.initiateSchemeAssistance(
        "case-state-test-1",
        {
          schemeId: "jsy",
          beneficiaryMemberId: memberPregnant.id,
          priority: "HIGH",
          notes: "Initiated doorstep assistance for Janani Suraksha Yojana maternal care.",
        },
        ashaProfile
      );

      expect(initResult.case.schemeId).toBe("jsy");
      expect(initResult.case.status).toBe("IN_PROGRESS");
      expect(initResult.case.beneficiaryMemberId).toBe(memberPregnant.id);
      expect(initResult.case.beneficiaryName).toBe("Anita Sharma");
      expect(initResult.tasks).toHaveLength(6);
      expect(initResult.journeySteps).toHaveLength(8);

      // Verify task counting model: JSY starts at 0/6
      const detail0 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail0.tasks.filter((t) => t.status === "COMPLETED").length).toBe(0);
      expect(detail0.tasks.length).toBe(6);

      // Complete all 6 tasks sequentially
      for (let i = 0; i < 5; i++) {
        await caseService.completeCaseTask("case-state-test-1", detail0.tasks[i].id, { notes: `Task ${i + 1} completed` }, ashaProfile);
        const detailStep = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
        expect(detailStep.tasks.filter((t) => t.status === "COMPLETED").length).toBe(i + 1);
        expect(detailStep.case.status).toBe("IN_PROGRESS");
      }

      // Complete Final Task 6 (6/6) -> RESOLUTION
      await caseService.completeCaseTask("case-state-test-1", detail0.tasks[5].id, { notes: "₹1,400 DBT credited to beneficiary bank account" }, ashaProfile);
      const detail6 = await caseService.getCaseDetail("case-state-test-1", ashaProfile);
      expect(detail6.tasks.filter((t) => t.status === "COMPLETED").length).toBe(6);
      expect(detail6.tasks.length).toBe(6);
      expect(detail6.case.status).toBe("RESOLVED");
      expect(detail6.case.currentJourneyStep).toBe("CASE_RESOLVED");
      expect(detail6.journeySteps.every((s) => s.status === "COMPLETED")).toBe(true);

      // Verify linked assistance request was marked RESOLVED
      const requests = await assistanceRepo.listRequestsByHouseholdId(testHousehold.id);
      const jsyReq = requests.find((r) => r.schemeId === "jsy");
      expect(jsyReq).toBeDefined();
      expect(jsyReq?.status).toBe("RESOLVED");
    });
  });

  describe("4. Attention Signals Synchronization Across States", () => {
    it("should show INITIATE_SCHEME when unstarted, and clear it once journey starts or resolves", async () => {
      // 1. Initial unstarted state: Attention signals generated for both PM-JAY and JSY
      const signals0 = await caseService.getAshaAttentionSignals(ashaProfile.uid);
      const pmjaySig0 = signals0.signals.find((s) => s.schemeId === "ab-pmjay");
      const jsySig0 = signals0.signals.find((s) => s.schemeId === "jsy");
      expect(pmjaySig0).toBeDefined();
      expect(pmjaySig0?.actionType).toBe("INITIATE_SCHEME");
      expect(jsySig0).toBeDefined();
      expect(jsySig0?.actionType).toBe("INITIATE_SCHEME");

      // 2. Start PM-JAY: PM-JAY signal should disappear from attention opportunities
      await caseService.initiateSchemeAssistance(
        "case-state-test-1",
        {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: memberSenior.id,
        },
        ashaProfile
      );

      const signals1 = await caseService.getAshaAttentionSignals(ashaProfile.uid);
      const pmjaySig1 = signals1.signals.find(
        (s) => s.schemeId === "ab-pmjay" && s.actionType === "INITIATE_SCHEME"
      );
      expect(pmjaySig1).toBeUndefined(); // Cleared because journey is active!
    });
  });

  describe("5. Idempotency and Duplicate Protection", () => {
    it("should prevent duplicate scheme initiation on an active case with 409 Conflict", async () => {
      await caseService.initiateSchemeAssistance(
        "case-state-test-1",
        {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: memberSenior.id,
        },
        ashaProfile
      );

      await expect(
        caseService.initiateSchemeAssistance(
          "case-state-test-1",
          {
            schemeId: "ab-pmjay",
            beneficiaryMemberId: memberSenior.id,
          },
          ashaProfile
        )
      ).rejects.toThrow();
    });
  });
});
