import { describe, it, expect, beforeEach } from "vitest";
import { CaseService, CaseServiceError } from "../src/services/case.service.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { UserProfile } from "../../shared/types/auth.js";

describe("Phase 9: CaseService & Authorization (RBAC / IDOR) Tests", () => {
  let caseRepo: CaseRepository;
  let householdRepo: HouseholdRepository;
  let schemeRepo: SchemeRepository;
  let eligibilityService: EligibilityService;
  let guidanceService: GuidanceService;
  let caseService: CaseService;

  const ashaProfileA: UserProfile = {
    uid: "asha-worker-101",
    email: "asha101@test.gov.in",
    role: "ASHA",
    displayName: "ASHA Shanthi",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ashaProfileB: UserProfile = {
    uid: "asha-worker-202",
    email: "asha202@test.gov.in",
    role: "ASHA",
    displayName: "ASHA Radha",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const citizenProfile: UserProfile = {
    uid: "citizen-user-999",
    email: "citizen999@test.gov.in",
    role: "CITIZEN",
    displayName: "Citizen Ramesh",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const adminProfile: UserProfile = {
    uid: "admin-user-777",
    email: "admin777@test.gov.in",
    role: "ADMIN",
    displayName: "System Admin",
    phoneNumber: null,
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    caseRepo = new CaseRepository(null);
    householdRepo = new HouseholdRepository(null);
    schemeRepo = new SchemeRepository(null);

    caseRepo.clearMemoryStore();
    householdRepo.clearMemoryStore();
    schemeRepo.clearMemoryStore();

    eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);
    caseService = new CaseService(caseRepo, householdRepo, eligibilityService, guidanceService);

    await seedSchemeRegistry(schemeRepo, true);
  });

  it("1. returns an honest empty caseload for a newly registered ASHA worker", async () => {
    const cases = await caseService.listAshaCases(ashaProfileA.uid);
    expect(cases).toHaveLength(0);

    const summary = await caseService.getAshaCaseSummary(ashaProfileA.uid);
    expect(summary.totalAssigned).toBe(0);
    expect(summary.needsAttentionCount).toBe(0);
    expect(summary.urgentCount).toBe(0);
    expect(summary.upcomingFollowUpsCount).toBe(0);
    expect(summary.resolvedCount).toBe(0);
  });

  it("2. allows ASHA worker to perform field registration and creates an assigned case", async () => {
    const regResult = await caseService.createFieldEnrollmentCase(
      {
        headOfHouseholdName: "Manjula Gowda",
        headAge: 32,
        headGender: "female",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Channasandra",
        pincode: "560067",
      },
      ashaProfileA
    );

    expect(regResult.case.assignedAshaUid).toBe(ashaProfileA.uid);
    expect(regResult.case.headOfHouseholdName).toBe("Manjula Gowda");
    expect(regResult.case.status).toBe("NEW");

    // Case is now in ASHA A's caseload
    const cases = await caseService.listAshaCases(ashaProfileA.uid);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe(regResult.case.id);

    // Initial activity was logged
    const activities = await caseService.getCaseActivities(regResult.case.id, ashaProfileA);
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe("CASE_CREATED");
  });

  it("3. allows assigned ASHA worker to retrieve full case details with deterministic eligibility and gaps", async () => {
    // Create household with senior citizen
    const hh = await householdRepo.createHousehold({
      id: "hh-senior-1",
      ownerUid: "citizen-1",
      headOfHouseholdName: "Siddaramaiah",
      rationCardNumber: "RC-KA-0011",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru",
      village: "Rural",
      pincode: "560001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await householdRepo.createMember(hh.id, {
      id: "mem-senior-1",
      householdId: hh.id,
      fullName: "Siddaramaiah",
      age: 74,
      gender: "male",
      relationship: "Head",
      disabilityStatus: false,
      maternalStatus: "none",
      chronicConditions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create case assigned to ASHA A
    const testCase = await caseRepo.createCase({
      id: "case-senior-1",
      householdId: hh.id,
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: hh.headOfHouseholdName,
      district: hh.district,
      state: hh.state,
      incomeCategory: hh.incomeCategory,
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const detail = await caseService.getCaseDetail(testCase.id, ashaProfileA);
    expect(detail.case.id).toBe("case-senior-1");
    expect(detail.household.headOfHouseholdName).toBe("Siddaramaiah");
    expect(detail.members).toHaveLength(1);
    // Deterministic eligibility evaluation
    expect(detail.eligibilityResults.some((r) => r.schemeId === "ab-pmjay" && r.status === "ELIGIBLE")).toBe(true);
  });

  it("4. IDOR DEFENSE: blocks another ASHA worker from accessing unassigned case", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-private-A",
      householdId: "hh-priv",
      assignedAshaUid: ashaProfileA.uid, // Assigned to Worker A
      headOfHouseholdName: "Private Family",
      district: "District 1",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Worker B attempts to access Worker A's case
    await expect(
      caseService.getCaseDetail(testCase.id, ashaProfileB)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CASE_NOT_FOUND",
        statusCode: 404,
      })
    );
  });

  it("5. ROLE ISOLATION: blocks Citizen from accessing ASHA case management", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-citizen-block",
      householdId: "hh-block",
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: "Family Block",
      district: "District 1",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Citizen attempts to access ASHA case
    await expect(
      caseService.getCaseDetail(testCase.id, citizenProfile)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN_ROLE",
        statusCode: 403,
      })
    );
  });

  it("6. updates case status and priority and records immutable audit activities", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-audit-test",
      householdId: "hh-audit",
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: "Family Audit",
      district: "Bengaluru",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "NEW",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update status to NEEDS_ATTENTION and priority to HIGH
    await caseService.updateCase(
      testCase.id,
      { status: "NEEDS_ATTENTION", priority: "HIGH" },
      ashaProfileA
    );

    const activities = await caseService.getCaseActivities(testCase.id, ashaProfileA);
    expect(activities.some((a) => a.type === "STATUS_CHANGED")).toBe(true);
    expect(activities.some((a) => a.type === "PRIORITY_CHANGED")).toBe(true);
  });

  it("7. adds case notes and records audit activity", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-notes-test",
      householdId: "hh-notes",
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: "Family Notes",
      district: "Bengaluru",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const note = await caseService.addCaseNote(
      testCase.id,
      { content: "Verified Aadhaar cards for all members during home visit." },
      ashaProfileA
    );

    expect(note.content).toContain("Verified Aadhaar");
    expect(note.authorUid).toBe(ashaProfileA.uid);

    const notes = await caseService.getCaseNotes(testCase.id, ashaProfileA);
    expect(notes).toHaveLength(1);
  });

  it("8. schedules follow-up tasks and recalculates upcoming pointer on completion", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-followup-test",
      householdId: "hh-fu",
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: "Family FollowUp",
      district: "Bengaluru",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const fu = await caseService.createFollowUp(
      testCase.id,
      {
        scheduledAt: "2026-09-10T10:00:00.000Z",
        reason: "Visit CSC center with family for Ayushman Vay Vandana card",
      },
      ashaProfileA
    );

    const updatedCase = await caseRepo.getCaseById(testCase.id);
    expect(updatedCase?.nextFollowUpAt).toBe("2026-09-10T10:00:00.000Z");

    // Complete the task
    await caseService.updateFollowUp(
      testCase.id,
      fu.id,
      { status: "COMPLETED" },
      ashaProfileA
    );

    const completedCase = await caseRepo.getCaseById(testCase.id);
    expect(completedCase?.nextFollowUpAt).toBeNull(); // No remaining pending tasks
  });

  it("9. allows Admin to assign or reassign cases to ASHA workers", async () => {
    const hh = await householdRepo.createHousehold({
      id: "hh-admin-assign",
      ownerUid: "citizen-2",
      headOfHouseholdName: "Kavitha Sharma",
      rationCardNumber: "RC-KA-0022",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru",
      village: "Town",
      pincode: "560002",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Admin assigns to ASHA A
    const assignedCase = await caseService.assignCaseToAsha(hh.id, ashaProfileA.uid, adminProfile);
    expect(assignedCase.assignedAshaUid).toBe(ashaProfileA.uid);

    // Non-admin cannot assign cases
    await expect(
      caseService.assignCaseToAsha(hh.id, ashaProfileB.uid, ashaProfileA)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN_ROLE",
        statusCode: 403,
      })
    );
  });

  it("10. Field Registration ignores spoofed assignedAshaUid and enforces caller's authenticated UID", async () => {
    const maliciousPayload: any = {
      headOfHouseholdName: "Spoof Test Family",
      headAge: 40,
      headGender: "male",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Bengaluru",
      village: "Locality",
      pincode: "560001",
      assignedAshaUid: "evil-asha-attacker-999", // Client attempts to hijack assignment
    };

    const regResult = await caseService.createFieldEnrollmentCase(maliciousPayload, ashaProfileA);

    // Invariant: Assignment must strictly match the authenticated ASHA worker
    expect(regResult.case.assignedAshaUid).toBe(ashaProfileA.uid);
    expect(regResult.case.assignedAshaUid).not.toBe("evil-asha-attacker-999");
  });

  it("11. Citizen is strictly rejected from performing field registrations", async () => {
    await expect(
      caseService.createFieldEnrollmentCase(
        {
          headOfHouseholdName: "Citizen Created",
          incomeCategory: "BPL",
          state: "Karnataka",
          district: "Bengaluru",
          village: "Locality",
          pincode: "560001",
        },
        citizenProfile
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN_ROLE",
        statusCode: 403,
      })
    );
  });

  it("12. IDOR: Cross-ASHA worker cannot read notes, follow-ups, or activities of unassigned case", async () => {
    const testCase = await caseRepo.createCase({
      id: "case-locked-A",
      householdId: "hh-locked-A",
      assignedAshaUid: ashaProfileA.uid,
      headOfHouseholdName: "Locked Family",
      district: "District 1",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Worker B attempts to read notes
    await expect(
      caseService.getCaseNotes(testCase.id, ashaProfileB)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CASE_NOT_FOUND",
        statusCode: 404,
      })
    );

    // Worker B attempts to read activities
    await expect(
      caseService.getCaseActivities(testCase.id, ashaProfileB)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CASE_NOT_FOUND",
        statusCode: 404,
      })
    );

    // Worker B attempts to add note
    await expect(
      caseService.addCaseNote(testCase.id, { content: "Malicious note" }, ashaProfileB)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CASE_NOT_FOUND",
        statusCode: 404,
      })
    );

    // Worker B attempts to schedule follow-up
    await expect(
      caseService.createFollowUp(
        testCase.id,
        { scheduledAt: "2026-09-01T00:00:00.000Z", reason: "Malicious follow-up" },
        ashaProfileB
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CASE_NOT_FOUND",
        statusCode: 404,
      })
    );
  });
});
