import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { AutomationService } from "../src/services/automation/automation.service.js";

describe("SwasthyaSetu Phase 10: Actions, Follow-ups & Automation Architecture Test Suite", () => {
  let app: FastifyInstance;

  const citizen1Token = "test_token_citizen101_citizen";
  const citizen2Token = "test_token_citizen102_citizen";
  const asha1Token = "test_token_asha101_asha";
  const asha2Token = "test_token_asha102_asha";
  const adminToken = "test_token_admin101_admin";

  let pmjayBeneficiaryId: string;
  let jsyBeneficiaryId: string;
  let case1Id: string;
  let case2Id: string;
  let household1Id: string;
  let household2Id: string;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();

    // Seed scheme registry
    await seedSchemeRegistry(app.schemeRepository, true);

    // Consent all actors
    for (const token of [citizen1Token, citizen2Token, asha1Token, asha2Token, adminToken]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: { authorization: `Bearer ${token}` },
        payload: { consentVersion: "1.0", accepted: true },
      });
    }

    // Configure ASHA 1
    await app.userRepository.updateUserProfile("asha101", {
      displayName: "Priya Sharma",
      ashaServiceCode: "ASHA-KA-7K42",
      serviceArea: "Nelamangala PHC",
      role: "ASHA",
    });

    // Configure ASHA 2
    await app.userRepository.updateUserProfile("asha102", {
      displayName: "Sunita Rao",
      ashaServiceCode: "ASHA-KA-8M19",
      serviceArea: "Doddaballapura PHC",
      role: "ASHA",
    });

    // Create Household 1 (Citizen 1 - Ramesh with senior grandfather Gopal, 72)
    const hh1Res = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        headOfHouseholdName: "Ramesh Sharma",
        contactPhone: "9876543210",
        incomeCategory: "APL",
        rationCardNumber: "RAT-KA-9901",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
        addressLine1: "Village Road 4",
      },
    });
    household1Id = JSON.parse(hh1Res.body).data.household.id;

    // Add senior member to Household 1
    const mem1Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: {
        fullName: "Gopal Sharma",
        relationship: "father",
        age: 72,
        gender: "male",
      },
    });
    pmjayBeneficiaryId = JSON.parse(mem1Res.body).data.member.id;

    // Connect Household 1 to ASHA 1
    const conn1Res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen1Token}` },
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    const conn1Id = JSON.parse(conn1Res.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn1Id}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    // Create Household 2 (Citizen 2 - Anita Devi, 24, Pregnant for JSY)
    const hh2Res = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        headOfHouseholdName: "Anita Devi",
        contactPhone: "9876543211",
        incomeCategory: "BPL",
        rationCardNumber: "RAT-KA-9902",
        state: "Karnataka",
        district: "Bengaluru Rural",
        village: "Nelamangala",
        pincode: "562123",
        addressLine1: "Near Gram Panchayat",
      },
    });
    household2Id = JSON.parse(hh2Res.body).data.household.id;

    // Add pregnant member to Household 2
    const mem2Res = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: {
        fullName: "Anita Devi",
        relationship: "self",
        age: 24,
        gender: "female",
        maternalStatus: "pregnant",
      },
    });
    jsyBeneficiaryId = JSON.parse(mem2Res.body).data.member.id;

    // Connect Household 2 to ASHA 1
    const conn2Res = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizen2Token}` },
      payload: { serviceCode: "ASHA-KA-7K42" },
    });
    const conn2Id = JSON.parse(conn2Res.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${conn2Id}/accept`,
      headers: { authorization: `Bearer ${asha1Token}` },
    });

    // Fetch assigned case IDs
    const casesRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${asha1Token}` },
    });
    const cases = JSON.parse(casesRes.body).data.cases;
    case1Id = cases.find((c: any) => c.householdId === household1Id).id;
    case2Id = cases.find((c: any) => c.householdId === household2Id).id;
  });

  // ================================================================
  // 1. ASHA ACTION & TASK EXECUTION (AUTHORIZATION & IDOR)
  // ================================================================
  describe("1. Action & Task Authorization", () => {
    it("allows authorized ASHA to complete sequential tasks", async () => {
      // Initiate PM-JAY on Case 1
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: pmjayBeneficiaryId,
          priority: "HIGH",
        },
      });

      const tasksRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/tasks`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const tasks = JSON.parse(tasksRes.body).data.tasks;
      const firstTask = tasks[0];

      // Complete first task
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${firstTask.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Verified senior Aadhaar documents at household." },
      });

      expect(compRes.statusCode).toBe(200);
      const updatedTask = JSON.parse(compRes.body).data.task;
      expect(updatedTask.status).toBe("COMPLETED");
      expect(updatedTask.notes).toBe("Verified senior Aadhaar documents at household.");
    });

    it("rejects unauthorized ASHA from completing tasks on another worker's case (IDOR protection)", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: pmjayBeneficiaryId,
        },
      });

      const tasksRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/tasks`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const firstTask = JSON.parse(tasksRes.body).data.tasks[0];

      // ASHA 2 tries to complete ASHA 1's task
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${firstTask.id}/complete`,
        headers: { authorization: `Bearer ${asha2Token}` },
        payload: { notes: "Malicious attempt." },
      });

      expect([403, 404]).toContain(compRes.statusCode);
    });

    it("rejects citizen role from calling ASHA task and follow-up APIs (403 Forbidden)", async () => {
      const taskRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/fake-task-1/complete`,
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: { notes: "Citizen attempt." },
      });
      expect([403, 404]).toContain(taskRes.statusCode);

      const fuRes = await app.inject({
        method: "GET",
        url: "/api/v1/asha/follow-ups",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });
      expect(fuRes.statusCode).toBe(403);
    });
  });

  // ================================================================
  // 2. DETERMINISTIC AUTOMATIC FOLLOW-UP GENERATION (PM-JAY & JSY)
  // ================================================================
  describe("2. Deterministic Automatic Follow-up Generation", () => {
    it("generates exact sequential follow-ups upon completing PM-JAY tasks 1 to 4", async () => {
      // Initiate PM-JAY
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: pmjayBeneficiaryId,
        },
      });

      const tasksRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/tasks`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const tasks = JSON.parse(tasksRes.body).data.tasks;
      expect(tasks.length).toBe(5);

      // 1. Complete Task 1 (CONFIRM_BENEFICIARY) -> Expect Follow-up 1
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${tasks[0].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Senior age 72 confirmed via Aadhaar." },
      });

      let fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      let followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(1);
      expect(followUps[0].title).toBe("PM-JAY e-KYC & Registration Assistance");
      expect(followUps[0].sourceTaskId).toBe(tasks[0].id);
      expect(followUps[0].status).toBe("PENDING");

      // 2. Complete Task 2 (ENROLLMENT_GUIDANCE) -> Expect Follow-up 2
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${tasks[1].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { notes: "Guided on BIS portal." },
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(2);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[1].id)?.title).toBe(
        "Verify PM-JAY Application Submission"
      );

      // 3. Complete Task 3 (VERIFY_ENROLLMENT) -> Expect Follow-up 3
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${tasks[2].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(3);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[2].id)?.title).toBe(
        "Check Ayushman Card Generation Status"
      );

      // 4. Complete Task 4 (CONFIRM_CARD) -> Expect Follow-up 4
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${tasks[3].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(4);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[3].id)?.title).toBe(
        "Deliver Ayushman Card & Hospital Network Guidance"
      );

      // 5. Complete Task 5 (BENEFIT_GUIDANCE) -> Resolves case and completes intermediate followups
      const finalTaskRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${tasks[4].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });
      expect(finalTaskRes.statusCode).toBe(200);

      // Verify Case is RESOLVED
      const caseDetailRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const c = JSON.parse(caseDetailRes.body).data.case;
      expect(c.status).toBe("RESOLVED");
      expect(c.currentJourneyStep).toBe("CASE_RESOLVED");
      expect(c.nextFollowUpAt).toBeNull();
    });

    it("generates exact sequential follow-ups upon completing JSY tasks 1 to 5", async () => {
      // Initiate JSY
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case2Id}/initiate-scheme`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          schemeId: "jsy",
          beneficiaryMemberId: jsyBeneficiaryId,
        },
      });

      const tasksRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/tasks`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const tasks = JSON.parse(tasksRes.body).data.tasks;
      expect(tasks.length).toBe(6);

      // Complete Task 1 (CONFIRM_PREGNANCY)
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[0].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      let fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      let followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(1);
      expect(followUps[0].title).toBe("Antenatal Care (ANC) & MCP Card Follow-up");

      // Complete Task 2 (ANC_COORDINATION)
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[1].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(2);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[1].id)?.title).toBe(
        "Map Institutional Delivery Hospital & Ambulance"
      );

      // Complete Task 3 (FACILITY_MAPPING)
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[2].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(3);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[2].id)?.title).toBe(
        "Birth Preparedness & Delivery Readiness Check"
      );

      // Complete Task 4 (DELIVERY_SUPPORT)
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[3].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(4);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[3].id)?.title).toBe(
        "48-Hour Postnatal Visit & Newborn Vaccines"
      );

      // Complete Task 5 (POSTNATAL_VISIT)
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[4].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      followUps = JSON.parse(fuRes.body).data.followUps;
      expect(followUps.length).toBe(5);
      expect(followUps.find((f: any) => f.sourceTaskId === tasks[4].id)?.title).toBe(
        "Track JSY Cash Incentive DBT Transfer"
      );

      // Complete Task 6 (DBT_TRACKING) -> Resolves maternal care journey
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case2Id}/tasks/${tasks[5].id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      const caseDetailRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case2Id}`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const c = JSON.parse(caseDetailRes.body).data.case;
      expect(c.status).toBe("RESOLVED");
      expect(c.currentJourneyStep).toBe("CASE_RESOLVED");
    });

    it("prevents duplicate follow-up generation for the same source task", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/initiate-scheme`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          schemeId: "ab-pmjay",
          beneficiaryMemberId: pmjayBeneficiaryId,
        },
      });

      const tasksRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/tasks`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const firstTaskId = JSON.parse(tasksRes.body).data.tasks[0].id;

      // Complete task
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${firstTaskId}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      // Redundant completion attempt
      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/tasks/${firstTaskId}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {},
      });

      const fuRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const followUps = JSON.parse(fuRes.body).data.followUps;
      const matching = followUps.filter((f: any) => f.sourceTaskId === firstTaskId);
      expect(matching.length).toBe(1);
    });
  });

  // ================================================================
  // 3. FOLLOW-UP STATE & OUTCOME MANAGEMENT (KPI COUNTERS, COMPLETE & RESCHEDULE)
  // ================================================================
  describe("3. Follow-up Lifecycle & Outcome Recording", () => {
    it("completes follow-up with structured outcome and recalculates nextFollowUpAt", async () => {
      // Create manual follow-up
      const createRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          reason: "Doorstep identity verification and ration card scan",
        },
      });
      expect(createRes.statusCode).toBe(201);
      const followUp = JSON.parse(createRes.body).data.followUp;

      // Complete follow-up
      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups/${followUp.id}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          outcome: "Aadhaar verified and ration card scanned successfully.",
          notes: "Family was supportive and had original documents ready.",
        },
      });

      expect(compRes.statusCode).toBe(200);
      const updated = JSON.parse(compRes.body).data.followUp;
      expect(updated.status).toBe("COMPLETED");
      expect(updated.outcome).toBe("Aadhaar verified and ration card scanned successfully.");
      expect(updated.notes).toBe("Family was supportive and had original documents ready.");
      expect(updated.completedBy).toBe("Priya Sharma");
      expect(updated.completedAt).toBeDefined();
    });

    it("reschedules follow-up with new due date and audit reason", async () => {
      const initialDate = new Date(Date.now() + 86400000).toISOString();
      const createRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          dueAt: initialDate,
          reason: "Check PM-JAY e-KYC status",
        },
      });
      const followUp = JSON.parse(createRes.body).data.followUp;

      const newDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const reschedRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups/${followUp.id}/reschedule`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          dueAt: newDate,
          reason: "Beneficiary traveled out of village for a family function.",
        },
      });

      expect(reschedRes.statusCode).toBe(200);
      const updated = JSON.parse(reschedRes.body).data.followUp;
      expect(updated.dueAt).toBe(newDate);
      expect(updated.rescheduleReason).toBe("Beneficiary traveled out of village for a family function.");
      expect(updated.rescheduledAt).toBeDefined();
    });

    it("correctly computes on-demand KPI counters (dueToday, upcoming, overdue, completed)", async () => {
      const now = Date.now();
      const todayISO = new Date(now).toISOString();
      const overdueISO = new Date(now - 3 * 86400000).toISOString(); // 3 days ago
      const upcomingISO = new Date(now + 4 * 86400000).toISOString(); // 4 days later

      // 1. Create overdue follow-up
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { dueAt: overdueISO, reason: "Overdue visit" },
      });

      // 2. Create due today follow-up
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { dueAt: todayISO, reason: "Due today visit" },
      });

      // 3. Create upcoming follow-up
      const upRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { dueAt: upcomingISO, reason: "Upcoming visit" },
      });
      expect(upRes.statusCode).toBe(201);

      // 4. Create and complete a follow-up
      const compRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { dueAt: upcomingISO, reason: "Completed visit" },
      });
      const compId = JSON.parse(compRes.body).data.followUp.id;

      await app.inject({
        method: "PATCH",
        url: `/api/v1/asha/cases/${case1Id}/follow-ups/${compId}/complete`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { outcome: "Done" },
      });

      // Fetch ASHA summary roster
      const rosterRes = await app.inject({
        method: "GET",
        url: "/api/v1/asha/follow-ups",
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(rosterRes.statusCode).toBe(200);
      const summary = JSON.parse(rosterRes.body).data;
      expect(summary.total).toBe(4);
      expect(summary.completed).toBe(1);
      expect(summary.dueToday).toBe(1);
      expect(summary.overdue).toBe(1);
      expect(summary.upcoming).toBe(1);
    });
  });

  // ================================================================
  // 4. n8n AUTOMATION EVENT ARCHITECTURE & NON-BLOCKING SAFETY
  // ================================================================
  describe("4. Automation Architecture & Non-blocking n8n Safety", () => {
    it("degrades safely with { dispatched: false, reason: 'N8N_UNCONFIGURED' } when N8N_WEBHOOK_URL is unset", async () => {
      const autoService = new AutomationService("");
      const result = await autoService.emitDomainEvent("CASE_CREATED", {
        caseId: "case_test_1",
        householdId: "hh_test_1",
        assignedAshaUid: "asha101",
      });

      expect(result.success).toBe(true);
      expect(result.dispatched).toBe(false);
      expect(result.reason).toBe("N8N_UNCONFIGURED");
    });

    it("does not throw or fail core database transactions when n8n webhook returns 500 error", async () => {
      const originalFetch = global.fetch;
      // Mock fetch returning 500
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error in n8n workflow"),
      } as any);

      const autoService = new AutomationService("https://n8n.example.com/webhook/test");
      const result = await autoService.emitDomainEvent("TASK_COMPLETED", {
        caseId: case1Id,
        householdId: household1Id,
        assignedAshaUid: "asha101",
        payload: { taskId: "task-1" },
      });

      expect(result.success).toBe(true);
      expect(result.dispatched).toBe(false);
      expect(result.reason).toBe("HTTP_500");

      global.fetch = originalFetch;
    });

    it("does not throw or fail core database transactions when n8n webhook times out", async () => {
      const originalFetch = global.fetch;
      // Mock fetch throwing TimeoutError
      global.fetch = vi.fn().mockRejectedValue(new Error("TimeoutError: The operation was aborted due to timeout"));

      const autoService = new AutomationService("https://n8n.example.com/webhook/test");
      const result = await autoService.emitDomainEvent("FOLLOWUP_CREATED", {
        caseId: case1Id,
        householdId: household1Id,
        assignedAshaUid: "asha101",
      });

      expect(result.success).toBe(true);
      expect(result.dispatched).toBe(false);
      expect(result.reason).toContain("timeout");

      global.fetch = originalFetch;
    });

    it("deeply sanitizes sensitive tokens, passwords, and secret keys in domain event payloads", async () => {
      let capturedPayload: any = null;
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((_url, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({ ok: true, status: 200 } as any);
      });

      const autoService = new AutomationService("https://n8n.example.com/webhook/test");
      await autoService.emitDomainEvent("TASK_COMPLETED", {
        caseId: case1Id,
        householdId: household1Id,
        assignedAshaUid: "asha101",
        payload: {
          sessionToken: "super-secret-token-xyz",
          apiKey: "sk-proj-123456",
          userPassword: "PlainPassword123",
          normalField: "Public Value",
        },
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.payload.sessionToken).toBe("[REDACTED]");
      expect(capturedPayload.payload.apiKey).toBe("[REDACTED]");
      expect(capturedPayload.payload.userPassword).toBe("[REDACTED]");
      expect(capturedPayload.payload.normalField).toBe("Public Value");

      global.fetch = originalFetch;
    });
  });

  // ================================================================
  // 5. CITIZEN PRIVACY & ISOLATION
  // ================================================================
  describe("5. Citizen Privacy & High-Level Progress", () => {
    it("citizen sees high-level status without leaking internal ASHA notes or triage logs", async () => {
      // 1. Citizen creates assistance request
      const reqRes = await app.inject({
        method: "POST",
        url: "/api/v1/citizen/assistance/request",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          category: "SCHEME_ENROLLMENT",
          schemeId: "ab-pmjay",
          schemeName: "Ayushman Bharat PM-JAY",
          beneficiaryMemberId: pmjayBeneficiaryId,
          message: "Please help my grandfather apply for Senior PM-JAY card.",
        },
      });
      expect(reqRes.statusCode).toBe(201);
      const resBody = JSON.parse(reqRes.body);
      const astRequestId = resBody.data.id || resBody.data.request?.id;

      // 2. ASHA accepts assistance request
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/assistance-requests/${astRequestId}/accept`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { responseNote: "I will visit your home on Wednesday morning." },
      });

      // 3. ASHA records confidential internal case note
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/cases/${case1Id}/notes`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { content: "Confidential triage: Patient has mobility issues; check bedridden status." },
      });

      // 4. Citizen queries assistance requests
      const citRes = await app.inject({
        method: "GET",
        url: "/api/v1/citizen/assistance",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      const citRequests = JSON.parse(citRes.body).data.requests;
      const myReq = citRequests.find((r: any) => r.id === astRequestId);
      expect(myReq).toBeDefined();
      expect(myReq.status).toBe("ACCEPTED");
      expect(myReq.responseNote).toBe("I will visit your home on Wednesday morning.");

      // Verify internal ASHA note is NEVER present in citizen response
      expect(JSON.stringify(citRequests)).not.toContain("Confidential triage");
    });
  });
});
