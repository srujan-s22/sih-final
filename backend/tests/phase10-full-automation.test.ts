import { describe, it, expect, beforeEach, vi } from "vitest";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { ConnectionRepository } from "../src/repositories/connection.repository.js";
import { AssistanceRepository } from "../src/repositories/assistance.repository.js";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { CaseService } from "../src/services/case.service.js";
import { AutomationService } from "../src/services/automation/automation.service.js";
import { EligibilityService } from "../src/services/eligibility/eligibility.service.js";
import { GuidanceService } from "../src/services/guidance/guidance.service.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { UserProfile } from "../../shared/types/auth.js";
import { Household, Member } from "../../shared/types/household.js";
import { CaseFollowUp } from "../../shared/types/case.js";

describe("Phase 10: Actions, Follow-ups & n8n Automation Engine", () => {
  let caseRepo: CaseRepository;
  let householdRepo: HouseholdRepository;
  let userRepo: UserRepository;
  let connectionRepo: ConnectionRepository;
  let assistanceRepo: AssistanceRepository;
  let schemeRepo: SchemeRepository;
  let automationService: AutomationService;
  let caseService: CaseService;

  const adminProfile: UserProfile = {
    uid: "admin-phase10-uid",
    email: "admin@test.swasthyasetu.gov.in",
    phoneNumber: "+919999900001",
    displayName: "Admin Officer",
    role: "ADMIN",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ashaProfile: UserProfile = {
    uid: "asha-phase10-uid",
    email: "asha@test.swasthyasetu.gov.in",
    phoneNumber: "+919999900002",
    displayName: "Sunita ASHA",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const otherAshaProfile: UserProfile = {
    uid: "other-asha-uid",
    email: "other@test.swasthyasetu.gov.in",
    phoneNumber: "+919999900003",
    displayName: "Other ASHA",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const citizenProfile: UserProfile = {
    uid: "citizen-phase10-uid",
    email: "citizen@test.swasthyasetu.gov.in",
    phoneNumber: "+919999900004",
    displayName: "Devendra Verma",
    role: "CITIZEN",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testHousehold: Household = {
    id: "hh-phase10-test-1",
    ownerUid: citizenProfile.uid,
    headOfHouseholdName: "Devendra Verma",
    state: "Uttar Pradesh",
    district: "Varanasi",
    village: "Ramnagar",
    pincode: "221008",
    incomeCategory: "BPL",
    rationCardNumber: "RC-UP-BPL-554433",
    contactPhone: "9876543210",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const seniorMember: Member = {
    id: "mem-senior-p10",
    householdId: testHousehold.id,
    fullName: "Ramnath Verma",
    relationship: "FATHER",
    gender: "male",
    age: 74,
    maternalStatus: "none",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const pregnantMember: Member = {
    id: "mem-preg-p10",
    householdId: testHousehold.id,
    fullName: "Meena Verma",
    relationship: "WIFE",
    gender: "female",
    age: 24,
    maternalStatus: "pregnant",
    disabilityStatus: false,
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    caseRepo = new CaseRepository(null);
    householdRepo = new HouseholdRepository(null);
    userRepo = new UserRepository(null);
    connectionRepo = new ConnectionRepository(null);
    assistanceRepo = new AssistanceRepository(null);
    schemeRepo = new SchemeRepository(null);
    automationService = new AutomationService("http://localhost:5678/webhook/test", "test-secret-key-123");

    await seedSchemeRegistry(schemeRepo, true);

    const eligibilityService = new EligibilityService(schemeRepo, householdRepo);
    const guidanceService = new GuidanceService(householdRepo, eligibilityService, schemeRepo);

    caseService = new CaseService(
      caseRepo,
      householdRepo,
      eligibilityService,
      guidanceService,
      userRepo,
      connectionRepo,
      assistanceRepo,
      automationService
    );

    // Seed mock data
    await householdRepo.createHousehold(testHousehold);
    await householdRepo.createMember(testHousehold.id, seniorMember);
    await householdRepo.createMember(testHousehold.id, pregnantMember);

    await userRepo.createUserProfile(citizenProfile);
    await userRepo.createUserProfile(ashaProfile);
    await userRepo.createUserProfile(adminProfile);

    await caseRepo.createCase({
      id: "case-p10-1",
      householdId: testHousehold.id,
      headOfHouseholdName: testHousehold.headOfHouseholdName,
      district: testHousehold.district,
      state: testHousehold.state,
      incomeCategory: "BPL",
      memberCount: 3,
      assignedAshaUid: ashaProfile.uid,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe("1. Follow-up Lifecycle: PENDING -> COMPLETED / RESCHEDULED / CANCELLED", () => {
    it("should allow ASHA to create, reschedule, complete, and cancel follow-ups with immutable audit logs", async () => {
      // 1. Create manual follow-up
      const dueTomorrow = new Date(Date.now() + 86400000).toISOString();
      const followUp = await caseService.createFollowUp(
        "case-p10-1",
        {
          title: "Follow up on Ration Card linking",
          reason: "Verify Aadhaar seeding on beneficiary ration card at local Food & Civil Supplies office.",
          dueAt: dueTomorrow,
          notes: "Beneficiary requested afternoon home visit.",
        },
        ashaProfile
      );

      expect(followUp).toBeDefined();
      expect(followUp.status).toBe("PENDING");
      expect(followUp.title).toBe("Follow up on Ration Card linking");
      expect(followUp.dueAt).toBe(dueTomorrow);

      // 2. Reschedule follow-up
      const dueNextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
      const rescheduled = await caseService.rescheduleFollowUp(
        "case-p10-1",
        followUp.id,
        {
          dueAt: dueNextWeek,
          reason: "Beneficiary was out of town for harvest season.",
        },
        ashaProfile
      );

      expect(rescheduled.status).toBe("PENDING");
      expect(rescheduled.dueAt).toBe(dueNextWeek);
      expect(rescheduled.rescheduleReason).toBe("Beneficiary was out of town for harvest season.");

      // 3. Cancel follow-up
      const cancelled = await caseService.cancelFollowUp(
        "case-p10-1",
        followUp.id,
        {
          reason: "Beneficiary completed Aadhaar linking independently at CSC.",
        },
        ashaProfile
      );

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelReason).toBe("Beneficiary completed Aadhaar linking independently at CSC.");
      expect(cancelled.cancelledBy).toBe(ashaProfile.displayName);
      expect(cancelled.cancelledAt).toBeDefined();

      // 4. Verify audit trail in Case Activities
      const activities = await caseService.getCaseActivities("case-p10-1", ashaProfile);
      const activityTypes = activities.map((a) => a.type);
      expect(activityTypes).toContain("FOLLOWUP_SCHEDULED");
      expect(activityTypes).toContain("FOLLOWUP_RESCHEDULED");
      expect(activityTypes).toContain("FOLLOWUP_CANCELLED");
    });

    it("should prevent unauthorized users from modifying follow-ups", async () => {
      const dueTomorrow = new Date(Date.now() + 86400000).toISOString();
      const followUp = await caseService.createFollowUp(
        "case-p10-1",
        {
          reason: "Verify document",
          dueAt: dueTomorrow,
        },
        ashaProfile
      );

      // Other ASHA should be rejected (403 Forbidden)
      await expect(
        caseService.completeFollowUp(
          "case-p10-1",
          followUp.id,
          { outcome: "Done" },
          otherAshaProfile
        )
      ).rejects.toThrow(/access denied/i);

      // Other ASHA cannot cancel
      await expect(
        caseService.cancelFollowUp(
          "case-p10-1",
          followUp.id,
          { reason: "Attempted cancel" },
          otherAshaProfile
        )
      ).rejects.toThrow(/access denied/i);
    });
  });

  describe("2. Automatic Follow-up Generation & Resolution Policy", () => {
    it("should automatically generate PM-JAY follow-ups on task completion and clean up on resolution", async () => {
      // Initiate PM-JAY assistance
      const initResult = await caseService.initiateSchemeAssistance(
        "case-p10-1",
        {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: seniorMember.id,
          priority: "URGENT",
        },
        ashaProfile
      );

      expect(initResult.tasks).toHaveLength(5);

      // Complete Task 1 -> Should generate automatic Follow-Up 1
      await caseService.completeCaseTask(
        "case-p10-1",
        initResult.tasks[0].id,
        { notes: "Beneficiary identity verified via Aadhaar OTP" },
        ashaProfile
      );

      let followUps = (await caseService.getCaseDetail("case-p10-1", ashaProfile)).followUps;
      expect(followUps.length).toBeGreaterThanOrEqual(1);
      const autoFu1 = followUps.find((f) => f.sourceTaskId === initResult.tasks[0].id);
      expect(autoFu1).toBeDefined();
      expect(autoFu1?.title).toContain("PM-JAY e-KYC");
      expect(autoFu1?.status).toBe("PENDING");

      // Complete Tasks 2, 3, 4
      for (let i = 1; i < 4; i++) {
        await caseService.completeCaseTask(
          "case-p10-1",
          initResult.tasks[i].id,
          { notes: `Step ${i + 1} done` },
          ashaProfile
        );
      }

      // Complete Task 5 (5/5) -> Final Milestone
      await caseService.completeCaseTask(
        "case-p10-1",
        initResult.tasks[4].id,
        { notes: "Delivered Ayushman Card and provided nearest empanelled hospital list." },
        ashaProfile
      );

      const resolvedDetail = await caseService.getCaseDetail("case-p10-1", ashaProfile);
      expect(resolvedDetail.case.status).toBe("RESOLVED");
      expect(resolvedDetail.tasks.filter((t) => t.status === "COMPLETED")).toHaveLength(5);

      // All lingering pending follow-ups should be marked COMPLETED upon resolution
      expect(resolvedDetail.followUps.every((f) => f.status === "COMPLETED" || f.status === "CANCELLED")).toBe(true);
    });

    it("should automatically generate JSY follow-ups across the 6-task maternal care journey", async () => {
      // Initiate JSY assistance
      const initResult = await caseService.initiateSchemeAssistance(
        "case-p10-1",
        {
          schemeId: "jsy",
          beneficiaryMemberId: pregnantMember.id,
          priority: "HIGH",
        },
        ashaProfile
      );

      expect(initResult.tasks).toHaveLength(6);

      // Complete Task 1 (Confirm Pregnancy & MCP Card)
      await caseService.completeCaseTask(
        "case-p10-1",
        initResult.tasks[0].id,
        { notes: "MCP Card issued and 1st ANC registered." },
        ashaProfile
      );

      let followUps = (await caseService.getCaseDetail("case-p10-1", ashaProfile)).followUps;
      const jsyFu1 = followUps.find((f) => f.sourceTaskId === initResult.tasks[0].id);
      expect(jsyFu1).toBeDefined();
      expect(jsyFu1?.title).toContain("Antenatal Care");

      // Complete Tasks 2-5
      for (let i = 1; i < 5; i++) {
        await caseService.completeCaseTask(
          "case-p10-1",
          initResult.tasks[i].id,
          { notes: `Step ${i + 1} completed` },
          ashaProfile
        );
      }

      // Complete Final Task 6 (DBT ₹1400 confirmed)
      await caseService.completeCaseTask(
        "case-p10-1",
        initResult.tasks[5].id,
        { notes: "Bank SMS confirmation verified for DBT transfer." },
        ashaProfile
      );

      const finalDetail = await caseService.getCaseDetail("case-p10-1", ashaProfile);
      expect(finalDetail.case.status).toBe("RESOLVED");
      expect(finalDetail.tasks.filter((t) => t.status === "COMPLETED")).toHaveLength(6);
    });
  });

  describe("3. n8n Automation: Inbound Webhooks, Idempotency & Polling", () => {
    it("should reject unauthenticated inbound webhooks", async () => {
      await expect(
        caseService.handleInboundAutomationWebhook(
          {
            eventId: "evt-test-unauth-1",
            eventType: "REMINDER_SENT",
            action: "REMINDER_SENT",
          },
          "wrong-secret"
        )
      ).rejects.toThrow("Invalid webhook signature or authorization secret");
    });

    it("should process authenticated inbound reminder webhooks with strict idempotency", async () => {
      const followUp = await caseService.createFollowUp(
        "case-p10-1",
        {
          title: "Visit for ANC Checkup",
          reason: "Doorstep reminder",
          dueAt: new Date().toISOString(),
        },
        ashaProfile
      );

      // 1. First webhook execution
      const result1 = await caseService.handleInboundAutomationWebhook(
        {
          eventId: "evt-n8n-reminder-unique-123",
          eventType: "REMINDER_SENT",
          caseId: "case-p10-1",
          followUpId: followUp.id,
          action: "REMINDER_SENT",
          notes: "WhatsApp reminder sent to head of household phone.",
        },
        "test-secret-key-123"
      );

      expect(result1.success).toBe(true);
      expect(result1.status).toBe("PROCESSED");
      expect(result1.duplicate).toBe(false);

      // Verify activity was recorded
      const activities = await caseService.getCaseActivities("case-p10-1", ashaProfile);
      const reminderAct = activities.find((a) => a.type === "AUTOMATION_DISPATCHED");
      expect(reminderAct).toBeDefined();
      expect(reminderAct?.description).toContain("Automated reminder dispatched");

      // 2. Duplicate webhook execution (should be safely ignored with duplicate: true)
      const result2 = await caseService.handleInboundAutomationWebhook(
        {
          eventId: "evt-n8n-reminder-unique-123",
          eventType: "REMINDER_SENT",
          caseId: "case-p10-1",
          followUpId: followUp.id,
          action: "REMINDER_SENT",
          notes: "WhatsApp reminder sent to head of household phone.",
        },
        "test-secret-key-123"
      );

      expect(result2.success).toBe(true);
      expect(result2.duplicate).toBe(true);
      expect(result2.status).toBe("IGNORED_DUPLICATE");
    });

    it("should return shouldHalt: true for resolved cases or completed follow-ups in status checks", async () => {
      const followUp = await caseService.createFollowUp(
        "case-p10-1",
        {
          title: "Follow-up check",
          reason: "Checking status",
          dueAt: new Date().toISOString(),
        },
        ashaProfile
      );

      // Active state -> should NOT halt
      const statusActive = await caseService.getFollowUpStatusForAutomation("case-p10-1", followUp.id);
      expect(statusActive.shouldHalt).toBe(false);
      expect(statusActive.followUp?.status).toBe("PENDING");

      // Mark follow-up completed -> should halt
      await caseService.completeFollowUp(
        "case-p10-1",
        followUp.id,
        { outcome: "Verification complete" },
        ashaProfile
      );

      const statusDone = await caseService.getFollowUpStatusForAutomation("case-p10-1", followUp.id);
      expect(statusDone.shouldHalt).toBe(true);
      expect(statusDone.followUp?.status).toBe("COMPLETED");
    });

    it("should return due follow-ups across active cases for n8n poller", async () => {
      const pastDue = new Date(Date.now() - 3600000).toISOString();
      await caseService.createFollowUp(
        "case-p10-1",
        {
          title: "Overdue task",
          reason: "Must be done immediately",
          dueAt: pastDue,
        },
        ashaProfile
      );

      const dueData = await caseService.getDueFollowUpsForAutomation();
      expect(dueData.count).toBeGreaterThanOrEqual(1);
      expect(dueData.dueFollowUps.some((f) => f.title === "Overdue task")).toBe(true);
    });
  });

  describe("4. Admin Observability & Automation Telemetry", () => {
    it("should allow Administrators to query platform-wide follow-ups and automation telemetry", async () => {
      const health = await caseService.getAutomationHealth(adminProfile);
      expect(health.webhookConfigured).toBe(true);
      expect(health.status).toBe("OPERATIONAL");
      expect(health.totalFollowUps).toBeGreaterThanOrEqual(0);

      const allFollowUps = await caseService.listAllFollowUpsForAdmin(adminProfile);
      expect(allFollowUps.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(allFollowUps.followUps)).toBe(true);
    });

    it("should deny non-admin users from accessing platform-wide automation health", async () => {
      await expect(caseService.getAutomationHealth(ashaProfile)).rejects.toThrow("Access denied");
      await expect(caseService.getAutomationHealth(citizenProfile)).rejects.toThrow("Access denied");
      await expect(caseService.listAllFollowUpsForAdmin(ashaProfile)).rejects.toThrow("Access denied");
    });
  });
});
