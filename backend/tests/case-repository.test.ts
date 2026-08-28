import { describe, it, expect, beforeEach } from "vitest";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { AshaCase, CaseNote, CaseFollowUp, CaseActivity } from "../../shared/types/case.js";

describe("Phase 9: CaseRepository Unit Tests", () => {
  let caseRepo: CaseRepository;

  beforeEach(() => {
    caseRepo = new CaseRepository(null);
    caseRepo.clearMemoryStore();
  });

  it("1. creates and retrieves a case by ID and by Household ID", async () => {
    const newCase: AshaCase = {
      id: "case-test-101",
      householdId: "hh-test-101",
      assignedAshaUid: "asha-user-1",
      headOfHouseholdName: "Smt. Kamala Devi",
      district: "Bengaluru Rural",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 4,
      status: "NEW",
      priority: "NORMAL",
      detectedGapsCount: 2,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await caseRepo.createCase(newCase);
    expect(created.id).toBe("case-test-101");

    const fetchedById = await caseRepo.getCaseById("case-test-101");
    expect(fetchedById).not.toBeNull();
    expect(fetchedById?.headOfHouseholdName).toBe("Smt. Kamala Devi");

    const fetchedByHousehold = await caseRepo.getCaseByHouseholdId("hh-test-101");
    expect(fetchedByHousehold).not.toBeNull();
    expect(fetchedByHousehold?.id).toBe("case-test-101");
  });

  it("2. lists cases filtered by assigned ASHA worker, status, and priority", async () => {
    await caseRepo.createCase({
      id: "case-1",
      householdId: "hh-1",
      assignedAshaUid: "asha-worker-A",
      headOfHouseholdName: "Family A1",
      district: "District 1",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 3,
      status: "ACTIVE",
      priority: "HIGH",
      detectedGapsCount: 1,
      eligibleSchemesCount: 2,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    await caseRepo.createCase({
      id: "case-2",
      householdId: "hh-2",
      assignedAshaUid: "asha-worker-A",
      headOfHouseholdName: "Family A2",
      district: "District 1",
      state: "Karnataka",
      incomeCategory: "AAY",
      memberCount: 5,
      status: "NEEDS_ATTENTION",
      priority: "URGENT",
      detectedGapsCount: 3,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    });

    await caseRepo.createCase({
      id: "case-3",
      householdId: "hh-3",
      assignedAshaUid: "asha-worker-B",
      headOfHouseholdName: "Family B1",
      district: "District 2",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 2,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    // List for worker A
    const workerACases = await caseRepo.listCasesByAsha("asha-worker-A");
    expect(workerACases.length).toBe(2);

    // List for worker B
    const workerBCases = await caseRepo.listCasesByAsha("asha-worker-B");
    expect(workerBCases.length).toBe(1);

    // Filter by status
    const attentionCases = await caseRepo.listCasesByAsha("asha-worker-A", { status: "NEEDS_ATTENTION" });
    expect(attentionCases.length).toBe(1);
    expect(attentionCases[0].id).toBe("case-2");

    // Filter by priority
    const urgentCases = await caseRepo.listCasesByAsha("asha-worker-A", { priority: "URGENT" });
    expect(urgentCases.length).toBe(1);
    expect(urgentCases[0].id).toBe("case-2");
  });

  it("3. updates case metadata", async () => {
    await caseRepo.createCase({
      id: "case-update-test",
      householdId: "hh-update",
      assignedAshaUid: "asha-1",
      headOfHouseholdName: "Family Update",
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

    const updated = await caseRepo.updateCase("case-update-test", {
      status: "ACTIVE",
      priority: "HIGH",
      lastContactAt: "2026-08-28T10:00:00.000Z",
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("ACTIVE");
    expect(updated?.priority).toBe("HIGH");
    expect(updated?.lastContactAt).toBe("2026-08-28T10:00:00.000Z");
  });

  it("4. manages notes, follow-ups, and activity subcollections", async () => {
    const caseId = "case-sub-test";
    await caseRepo.createCase({
      id: caseId,
      householdId: "hh-sub",
      assignedAshaUid: "asha-1",
      headOfHouseholdName: "Family Sub",
      district: "Bengaluru",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 3,
      status: "NEW",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Note
    const note: CaseNote = {
      id: "note-1",
      caseId,
      authorUid: "asha-1",
      authorName: "ASHA Shanthi",
      content: "Visited family and verified ration card.",
      createdAt: new Date().toISOString(),
    };
    await caseRepo.createNote(caseId, note);
    const notes = await caseRepo.getNotes(caseId);
    expect(notes.length).toBe(1);
    expect(notes[0].content).toContain("Visited family");

    // 2. Follow-Up
    const followUp: CaseFollowUp = {
      id: "fu-1",
      caseId,
      scheduledAt: "2026-09-01T09:00:00.000Z",
      reason: "Follow up on e-KYC document submission",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await caseRepo.createFollowUp(caseId, followUp);
    const followUps = await caseRepo.getFollowUps(caseId);
    expect(followUps.length).toBe(1);
    expect(followUps[0].reason).toContain("e-KYC");

    // Update Follow-up
    await caseRepo.updateFollowUp(caseId, "fu-1", { status: "COMPLETED", completedAt: new Date().toISOString() });
    const updatedFollowUps = await caseRepo.getFollowUps(caseId);
    expect(updatedFollowUps[0].status).toBe("COMPLETED");

    // 3. Activity
    const activity: CaseActivity = {
      id: "act-1",
      caseId,
      actorUid: "asha-1",
      actorRole: "ASHA",
      actorName: "ASHA Shanthi",
      type: "NOTE_ADDED",
      description: "Note added by ASHA Shanthi",
      timestamp: new Date().toISOString(),
    };
    await caseRepo.createActivity(caseId, activity);
    const activities = await caseRepo.getActivities(caseId);
    expect(activities.length).toBe(1);
    expect(activities[0].type).toBe("NOTE_ADDED");

    // 4. Delete Case
    const deleted = await caseRepo.deleteCase(caseId);
    expect(deleted).toBe(true);
    expect(await caseRepo.getCaseById(caseId)).toBeNull();
    expect(await caseRepo.getNotes(caseId)).toHaveLength(0);
  });
});
