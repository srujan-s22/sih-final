import {
  AshaCase,
  CaseNote,
  CaseFollowUp,
  CaseActivity,
  CaseTask,
  SchemeJourneyStep,
  CaseStatus,
  CasePriority,
  CaseDetailResponse,
  CaseSummaryResponse,
  FollowUpSummaryResponse,
  FieldRegistrationInput,
  AshaAttentionSignal,
  AshaAttentionPriority,
  AshaAttentionSignalsResponse,
  InitiateSchemeAssistanceInput,
  InitiateSchemeAssistanceResponse,
  AutomationHealthResponse,
} from "../../../shared/types/case.js";
import { UserProfile } from "../../../shared/types/auth.js";
import { Household, Member } from "../../../shared/types/household.js";
import { AshaAssistanceRequest } from "../../../shared/types/assistance.js";
import {
  UpdateCaseInput,
  CreateCaseTaskInput,
  UpdateCaseTaskInput,
  CompleteCaseTaskInput,
  CreateCaseNoteInput,
  CreateCaseFollowUpInput,
  UpdateCaseFollowUpInput,
  CompleteCaseFollowUpInput,
  RescheduleCaseFollowUpInput,
  CancelCaseFollowUpInput,
  InboundAutomationWebhookInput,
} from "../../../shared/schemas/case.schema.js";

import { CaseRepository } from "../repositories/case.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { AssistanceRepository } from "../repositories/assistance.repository.js";
import { EligibilityService } from "./eligibility/eligibility.service.js";
import { GuidanceService } from "./guidance/guidance.service.js";
import { AutomationService } from "./automation/automation.service.js";
import { HTTP_STATUS } from "../config/constants.js";

export class CaseServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "CaseServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class CaseService {
  constructor(
    private caseRepo: CaseRepository,
    private householdRepo: HouseholdRepository,
    private eligibilityService: EligibilityService,
    private guidanceService: GuidanceService,
    private userRepo?: UserRepository,
    private connectionRepo?: ConnectionRepository,
    private assistanceRepo?: AssistanceRepository,
    private automationService?: AutomationService
  ) {}

  private leaveService?: { evaluateAndRestoreExpiredLeaves: () => Promise<any> };

  public setLeaveService(service: { evaluateAndRestoreExpiredLeaves: () => Promise<any> }): void {
    this.leaveService = service;
  }

  /**
   * Server-side authorization check:
   * ASHA can only access cases assigned to their specific UID.
   * ADMIN can inspect all cases.
   * CITIZEN is strictly forbidden.
   */
  private authorizeCaseAccess(c: AshaCase, userProfile: UserProfile): void {
    if (userProfile.role === "CITIZEN") {
      throw new CaseServiceError(
        "Citizens are not authorized to access ASHA operational cases.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    if (userProfile.role === "ASHA" && c.assignedAshaUid !== userProfile.uid) {
      throw new CaseServiceError(
        "Case not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "CASE_NOT_FOUND"
      );
    }
  }

  /**
   * Lists all assigned cases for an authenticated ASHA worker
   */
  public async listAshaCases(
    ashaUid: string,
    filter?: { status?: CaseStatus; priority?: CasePriority; search?: string }
  ): Promise<AshaCase[]> {
    if (this.leaveService) {
      await this.leaveService.evaluateAndRestoreExpiredLeaves();
    }

    let cases = await this.caseRepo.listCasesByAsha(ashaUid, {
      status: filter?.status,
      priority: filter?.priority,
    });

    if (filter?.search && filter.search.trim().length > 0) {
      const q = filter.search.trim().toLowerCase();
      cases = cases.filter(
        (c) =>
          c.headOfHouseholdName.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    return cases;
  }

  /**
   * Computes real operational summary metrics for an ASHA worker's caseload
   */
  public async getAshaCaseSummary(ashaUid: string): Promise<CaseSummaryResponse> {
    if (this.leaveService) {
      await this.leaveService.evaluateAndRestoreExpiredLeaves();
    }

    const cases = await this.caseRepo.listCasesByAsha(ashaUid);
    const now = new Date();

    const totalAssigned = cases.length;
    const needsAttentionCount = cases.filter(
      (c) =>
        (c.status === "NEEDS_ATTENTION" || c.detectedGapsCount > 0) &&
        !["RESOLVED", "CLOSED"].includes(c.status)
    ).length;
    const urgentCount = cases.filter(
      (c) =>
        (c.priority === "URGENT" || c.priority === "HIGH") &&
        !["RESOLVED", "CLOSED"].includes(c.status)
    ).length;
    const upcomingFollowUpsCount = cases.filter(
      (c) =>
        c.nextFollowUpAt &&
        new Date(c.nextFollowUpAt) >= now &&
        !["RESOLVED", "CLOSED"].includes(c.status)
    ).length;
    const resolvedCount = cases.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED"
    ).length;

    return {
      totalAssigned,
      needsAttentionCount,
      urgentCount,
      upcomingFollowUpsCount,
      resolvedCount,
    };
  }

  /**
   * Retrieves aggregated case detail including authorized household, deterministic
   * eligibility results, healthcare gaps, notes, follow-ups, and activity audit history.
   */
  public async getCaseDetail(
    caseId: string,
    userProfile: UserProfile
  ): Promise<CaseDetailResponse> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    // Fetch authorized household
    const household = await this.householdRepo.getHouseholdById(c.householdId);
    if (!household) {
      throw new CaseServiceError(
        "Associated household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    const members = await this.householdRepo.getMembers(c.householdId);

    // Deterministic Level 1 & 2 Engine Evaluations
    const [eligibilityResults, guidance, notes, followUps, activities, tasks, assistanceRequests] = await Promise.all([
      this.eligibilityService.evaluateHouseholdForSchemes(household, members),
      this.guidanceService.getHouseholdGuidance(household, members),
      this.caseRepo.getNotes(caseId),
      this.caseRepo.getFollowUps(caseId),
      this.caseRepo.getActivities(caseId),
      this.caseRepo.getTasks(caseId),
      this.assistanceRepo ? this.assistanceRepo.listRequestsByHouseholdId(c.householdId) : Promise.resolve([]),
    ]);

    // Keep case gap and scheme counts in sync if changed
    if (
      c.detectedGapsCount !== guidance.gaps.length ||
      c.eligibleSchemesCount !== eligibilityResults.filter((r) => r.status === "ELIGIBLE").length
    ) {
      await this.caseRepo.updateCase(caseId, {
        detectedGapsCount: guidance.gaps.length,
        eligibleSchemesCount: eligibilityResults.filter((r) => r.status === "ELIGIBLE").length,
      });
      c.detectedGapsCount = guidance.gaps.length;
      c.eligibleSchemesCount = eligibilityResults.filter((r) => r.status === "ELIGIBLE").length;
    }

    // Default journey steps if case has a scheme but journeySteps not yet persisted
    let journeySteps = c.journeySteps || [];
    if (journeySteps.length === 0 && c.schemeId) {
      if (c.schemeId === "ab-pmjay") {
        journeySteps = CaseService.getPmjayDefaultJourney(c.beneficiaryName);
      } else if (c.schemeId === "jsy") {
        journeySteps = CaseService.getJsyDefaultJourney(c.beneficiaryName);
      }
    }

    return {
      case: c,
      household,
      members,
      eligibilityResults,
      guidance,
      tasks,
      journeySteps,
      notes,
      followUps,
      activities,
      assistanceRequests,
    };
  }

  /**
   * Updates case status, priority, or last contact timestamp with audit logging
   */
  public async updateCase(
    caseId: string,
    updates: UpdateCaseInput,
    userProfile: UserProfile
  ): Promise<AshaCase> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const oldStatus = c.status;
    const oldPriority = c.priority;

    const updated = await this.caseRepo.updateCase(caseId, updates);
    if (!updated) {
      throw new CaseServiceError(
        "Failed to update case.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "UPDATE_FAILED"
      );
    }

    // Record immutable audit activities
    const now = new Date().toISOString();

    if (updates.status && updates.status !== oldStatus) {
      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        actorName: userProfile.displayName || "ASHA Worker",
        type: "STATUS_CHANGED",
        description: `Case status changed from ${oldStatus} to ${updates.status}`,
        metadata: { oldStatus, newStatus: updates.status },
        timestamp: now,
      });
    }

    if (updates.priority && updates.priority !== oldPriority) {
      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        actorName: userProfile.displayName || "ASHA Worker",
        type: "PRIORITY_CHANGED",
        description: `Case priority changed from ${oldPriority} to ${updates.priority}`,
        metadata: { oldPriority, newPriority: updates.priority },
        timestamp: now,
      });
    }

    if (updates.lastContactAt) {
      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        actorName: userProfile.displayName || "ASHA Worker",
        type: "CONTACT_RECORDED",
        description: `Beneficiary contact recorded at ${updates.lastContactAt}`,
        timestamp: now,
      });
    }

    return updated;
  }

  /**
   * Appends a timestamped case note with audit recording
   */
  public async addCaseNote(
    caseId: string,
    input: CreateCaseNoteInput,
    userProfile: UserProfile
  ): Promise<CaseNote> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const note: CaseNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      authorUid: userProfile.uid,
      authorName: userProfile.displayName || "ASHA Worker",
      content: input.content.trim(),
      createdAt: now,
    };

    const savedNote = await this.caseRepo.createNote(caseId, note);

    // Audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "NOTE_ADDED",
      description: `Case note added by ${userProfile.displayName || "ASHA Worker"}`,
      timestamp: now,
    });

    return savedNote;
  }

  /**
   * Retrieves notes for an authorized case
   */
  public async getCaseNotes(caseId: string, userProfile: UserProfile): Promise<CaseNote[]> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);
    return this.caseRepo.getNotes(caseId);
  }

  /**
   * Schedules a follow-up task and updates the case nextFollowUpAt pointer
   */
  public async createFollowUp(
    caseId: string,
    input: CreateCaseFollowUpInput,
    userProfile: UserProfile
  ): Promise<CaseFollowUp> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const scheduledDate = input.dueAt || input.scheduledAt || now;

    const followUp: CaseFollowUp = {
      id: `fu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      householdId: c.householdId,
      headOfHouseholdName: c.headOfHouseholdName,
      assignedAshaUid: c.assignedAshaUid,
      schemeId: input.schemeId || c.schemeId || null,
      schemeName: c.schemeName || null,
      beneficiaryMemberId: input.beneficiaryMemberId || c.beneficiaryMemberId || null,
      beneficiaryName: input.beneficiaryName || c.beneficiaryName || null,
      title: input.title ? input.title.trim() : input.reason.trim(),
      reason: input.reason.trim(),
      dueAt: scheduledDate,
      scheduledAt: scheduledDate,
      status: "PENDING",
      notes: input.notes ? input.notes.trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    const savedFollowUp = await this.caseRepo.createFollowUp(caseId, followUp);

    // Update next follow-up pointer on case
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: scheduledDate,
    });

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "FOLLOWUP_SCHEDULED",
      description: `Follow-up scheduled for ${scheduledDate}: ${input.reason}`,
      metadata: { dueAt: scheduledDate, reason: input.reason },
      timestamp: now,
    });

    // Emit domain event to automation service
    if (this.automationService) {
      this.automationService.emitDomainEvent("FOLLOWUP_CREATED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId: c.schemeId,
        beneficiaryMemberId: c.beneficiaryMemberId,
        beneficiaryName: c.beneficiaryName,
        payload: {
          followUpId: savedFollowUp.id,
          title: savedFollowUp.title,
          reason: savedFollowUp.reason,
          dueAt: scheduledDate,
        },
      }).catch(() => {});
    }

    return savedFollowUp;
  }

  /**
   * Completes or updates a follow-up task
   */
  public async updateFollowUp(
    caseId: string,
    followUpId: string,
    updates: UpdateCaseFollowUpInput,
    userProfile: UserProfile
  ): Promise<CaseFollowUp> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateFollowUp(caseId, followUpId, {
      status: updates.status,
      dueAt: updates.dueAt,
      outcome: updates.outcome,
      notes: updates.notes,
      completedAt: updates.status === "COMPLETED" ? now : null,
      completedBy: updates.status === "COMPLETED" ? (userProfile.displayName || "ASHA Worker") : undefined,
    });

    if (!updated) {
      throw new CaseServiceError(
        "Follow-up task not found.",
        HTTP_STATUS.NOT_FOUND,
        "FOLLOWUP_NOT_FOUND"
      );
    }

    // Recalculate next upcoming follow-up on case
    const allFollowUps = await this.caseRepo.getFollowUps(caseId);
    const nextPending = allFollowUps.find((f) => f.status === "PENDING");
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: nextPending ? (nextPending.dueAt || nextPending.scheduledAt) : null,
    });

    // Record audit activity
    if (updates.status === "COMPLETED") {
      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        actorName: userProfile.displayName || "ASHA Worker",
        type: "FOLLOWUP_COMPLETED",
        description: `Follow-up task marked completed by ${userProfile.displayName || "ASHA Worker"}`,
        timestamp: now,
      });

      if (this.automationService) {
        this.automationService.emitDomainEvent("FOLLOWUP_COMPLETED", {
          caseId,
          householdId: c.householdId,
          assignedAshaUid: c.assignedAshaUid,
          schemeId: c.schemeId,
          beneficiaryMemberId: c.beneficiaryMemberId,
          beneficiaryName: c.beneficiaryName,
          payload: {
            followUpId,
            outcome: updates.outcome || null,
            notes: updates.notes || null,
          },
        }).catch(() => {});
      }
    }

    return updated;
  }

  /**
   * Completes a follow-up with structured outcome and resolution notes
   */
  public async completeFollowUp(
    caseId: string,
    followUpId: string,
    input: CompleteCaseFollowUpInput,
    userProfile: UserProfile
  ): Promise<CaseFollowUp> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateFollowUp(caseId, followUpId, {
      status: "COMPLETED",
      outcome: input.outcome.trim(),
      notes: input.notes ? input.notes.trim() : null,
      completedAt: now,
      completedBy: userProfile.displayName || "ASHA Worker",
    });

    if (!updated) {
      throw new CaseServiceError(
        "Follow-up task not found.",
        HTTP_STATUS.NOT_FOUND,
        "FOLLOWUP_NOT_FOUND"
      );
    }

    // Recalculate next upcoming follow-up on case
    const allFollowUps = await this.caseRepo.getFollowUps(caseId);
    const nextPending = allFollowUps.find((f) => f.status === "PENDING");
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: nextPending ? (nextPending.dueAt || nextPending.scheduledAt) : null,
    });

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "FOLLOWUP_COMPLETED",
      description: `Follow-up completed by ${userProfile.displayName || "ASHA Worker"}: ${input.outcome}`,
      metadata: { followUpId, outcome: input.outcome },
      timestamp: now,
    });

    // Emit domain event to automation service
    if (this.automationService) {
      this.automationService.emitDomainEvent("FOLLOWUP_COMPLETED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId: c.schemeId,
        beneficiaryMemberId: c.beneficiaryMemberId,
        beneficiaryName: c.beneficiaryName,
        payload: {
          followUpId,
          outcome: input.outcome,
          notes: input.notes || null,
        },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Reschedules a follow-up with reason
   */
  public async rescheduleFollowUp(
    caseId: string,
    followUpId: string,
    input: RescheduleCaseFollowUpInput,
    userProfile: UserProfile
  ): Promise<CaseFollowUp> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateFollowUp(caseId, followUpId, {
      dueAt: input.dueAt,
      scheduledAt: input.dueAt,
      rescheduledAt: now,
      rescheduleReason: input.reason.trim(),
    });

    if (!updated) {
      throw new CaseServiceError(
        "Follow-up task not found.",
        HTTP_STATUS.NOT_FOUND,
        "FOLLOWUP_NOT_FOUND"
      );
    }

    // Recalculate next upcoming follow-up on case
    const allFollowUps = await this.caseRepo.getFollowUps(caseId);
    const nextPending = allFollowUps.find((f) => f.status === "PENDING");
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: nextPending ? (nextPending.dueAt || nextPending.scheduledAt) : null,
    });

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "FOLLOWUP_RESCHEDULED",
      description: `Follow-up rescheduled to ${input.dueAt} by ${userProfile.displayName || "ASHA Worker"}: ${input.reason}`,
      metadata: { followUpId, newDueAt: input.dueAt, reason: input.reason },
      timestamp: now,
    });

    // Emit domain event to automation service
    if (this.automationService) {
      this.automationService.emitDomainEvent("FOLLOWUP_RESCHEDULED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId: c.schemeId,
        beneficiaryMemberId: c.beneficiaryMemberId,
        beneficiaryName: c.beneficiaryName,
        payload: {
          followUpId,
          newDueAt: input.dueAt,
          reason: input.reason,
        },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Cancels a scheduled follow-up with mandatory reason
   */
  public async cancelFollowUp(
    caseId: string,
    followUpId: string,
    input: CancelCaseFollowUpInput,
    userProfile: UserProfile
  ): Promise<CaseFollowUp> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateFollowUp(caseId, followUpId, {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledBy: userProfile.displayName || "ASHA Worker",
      cancelReason: input.reason.trim(),
    });

    if (!updated) {
      throw new CaseServiceError(
        "Follow-up task not found.",
        HTTP_STATUS.NOT_FOUND,
        "FOLLOWUP_NOT_FOUND"
      );
    }

    // Recalculate next upcoming follow-up on case
    const allFollowUps = await this.caseRepo.getFollowUps(caseId);
    const nextPending = allFollowUps.find((f) => f.status === "PENDING");
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: nextPending ? (nextPending.dueAt || nextPending.scheduledAt) : null,
    });

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "FOLLOWUP_CANCELLED",
      description: `Follow-up cancelled by ${userProfile.displayName || "ASHA Worker"}: ${input.reason}`,
      metadata: { followUpId, reason: input.reason },
      timestamp: now,
    });

    // Emit domain event to automation service
    if (this.automationService) {
      this.automationService.emitDomainEvent("FOLLOWUP_CANCELLED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId: c.schemeId,
        beneficiaryMemberId: c.beneficiaryMemberId,
        beneficiaryName: c.beneficiaryName,
        payload: {
          followUpId,
          reason: input.reason,
        },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Lists all follow-ups across the entire platform for Administrator view
   */
  public async listAllFollowUpsForAdmin(
    userProfile: UserProfile
  ): Promise<FollowUpSummaryResponse> {
    if (userProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Access denied. Only Administrators can view platform-wide follow-ups.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_RESOURCE"
      );
    }

    const followUps = await this.caseRepo.listAllFollowUpsForAdmin();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let dueToday = 0;
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;
    let cancelled = 0;

    const enrichedFollowUps = followUps.map((f) => {
      const dueDateStr = f.dueAt || f.scheduledAt;
      const dueDate = new Date(dueDateStr);
      const isPending = f.status === "PENDING";
      const isPast = dueDate.getTime() < now.getTime();
      const dateOnlyStr = dueDate.toISOString().split("T")[0];
      const isToday = dateOnlyStr === todayStr;

      const isOverdue = isPending && isPast && !isToday;

      if (f.status === "COMPLETED") {
        completed++;
      } else if (f.status === "CANCELLED") {
        cancelled++;
      } else if (isPending) {
        if (isToday) {
          dueToday++;
        } else if (isOverdue) {
          overdue++;
        } else {
          upcoming++;
        }
      }

      return {
        ...f,
        dueAt: dueDateStr,
        scheduledAt: dueDateStr,
        isOverdue,
      };
    });

    return {
      total: enrichedFollowUps.length,
      dueToday,
      upcoming,
      overdue,
      completed,
      cancelled,
      followUps: enrichedFollowUps,
    };
  }

  /**
   * Retrieves automation health telemetry for Admin Dashboard
   */
  public async getAutomationHealth(
    userProfile: UserProfile
  ): Promise<AutomationHealthResponse> {
    if (userProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Access denied. Only Administrators can access automation telemetry.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_RESOURCE"
      );
    }

    const followUpSummary = await this.listAllFollowUpsForAdmin(userProfile);
    const healthStatus = this.automationService?.getHealthStatus() || {
      webhookConfigured: false,
      webhookUrl: null,
      status: "UNCONFIGURED" as const,
      recentEvents: [],
    };

    return {
      webhookConfigured: healthStatus.webhookConfigured,
      webhookUrl: healthStatus.webhookUrl,
      status: healthStatus.status,
      totalFollowUps: followUpSummary.total,
      activeFollowUps: followUpSummary.dueToday + followUpSummary.upcoming,
      overdueFollowUps: followUpSummary.overdue,
      completedFollowUps: followUpSummary.completed,
      cancelledFollowUps: followUpSummary.cancelled || 0,
      recentEvents: healthStatus.recentEvents,
    };
  }

  /**
   * Processes inbound webhook callbacks from n8n orchestrator
   */
  public async handleInboundAutomationWebhook(
    input: InboundAutomationWebhookInput,
    rawSecretOrAuthHeader?: string
  ): Promise<{ success: boolean; eventId: string; status: string; duplicate?: boolean; reason?: string }> {
    if (!this.automationService) {
      throw new CaseServiceError("Automation service is unavailable.", HTTP_STATUS.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE");
    }

    // Verify authenticity
    const isAuthentic = this.automationService.verifyInboundWebhook(rawSecretOrAuthHeader);
    if (!isAuthentic) {
      throw new CaseServiceError("Invalid webhook signature or authorization secret.", HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED_WEBHOOK");
    }

    // Idempotency check
    if (this.automationService.isEventProcessed(input.eventId)) {
      return {
        success: true,
        eventId: input.eventId,
        status: "IGNORED_DUPLICATE",
        duplicate: true,
        reason: `Event '${input.eventId}' was already processed.`,
      };
    }

    this.automationService.recordProcessedEvent(input.eventId);

    const now = new Date().toISOString();

    if (input.followUpId && input.caseId) {
      const followUp = await this.caseRepo.getFollowUpById(input.caseId, input.followUpId);
      if (followUp && followUp.status === "PENDING") {
        if (input.action === "REMINDER_SENT") {
          await this.caseRepo.createActivity(input.caseId, {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            caseId: input.caseId,
            actorUid: "system-n8n-automation",
            actorRole: "ADMIN",
            actorName: "n8n Automation Orchestrator",
            type: "AUTOMATION_DISPATCHED",
            description: `Automated reminder dispatched: ${input.notes || followUp.title || followUp.reason}`,
            metadata: { eventId: input.eventId, followUpId: input.followUpId, action: input.action },
            timestamp: now,
          });
        }
      }
    }

    return {
      success: true,
      eventId: input.eventId,
      status: "PROCESSED",
      duplicate: false,
    };
  }

  /**
   * Retrieves due follow-ups across all active cases for n8n polling workflow
   */
  public async getDueFollowUpsForAutomation(): Promise<{ dueFollowUps: CaseFollowUp[]; count: number }> {
    const allFollowUps = await this.caseRepo.listAllFollowUpsForAdmin({ status: "PENDING" });
    const now = new Date();

    const dueList: CaseFollowUp[] = [];
    for (const f of allFollowUps) {
      const dueDate = new Date(f.dueAt || f.scheduledAt);
      if (dueDate.getTime() <= now.getTime()) {
        const c = await this.caseRepo.getCaseById(f.caseId);
        if (c && !["RESOLVED", "CLOSED"].includes(c.status)) {
          dueList.push(f);
        }
      }
    }

    return {
      dueFollowUps: dueList,
      count: dueList.length,
    };
  }

  /**
   * Inspects follow-up and case status for n8n before executing reminders
   */
  public async getFollowUpStatusForAutomation(
    caseId: string,
    followUpId: string
  ): Promise<{ followUp: CaseFollowUp | null; caseStatus: string | null; shouldHalt: boolean }> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      return { followUp: null, caseStatus: null, shouldHalt: true };
    }

    const f = await this.caseRepo.getFollowUpById(caseId, followUpId);
    if (!f) {
      return { followUp: null, caseStatus: c.status, shouldHalt: true };
    }

    const shouldHalt = ["RESOLVED", "CLOSED"].includes(c.status) || f.status !== "PENDING";

    return {
      followUp: f,
      caseStatus: c.status,
      shouldHalt,
    };
  }

  /**
   * Retrieves all follow-up tasks assigned to an ASHA with calculated status metrics
   */
  public async listAshaFollowUps(
    ashaUid: string,
    userProfile: UserProfile
  ): Promise<FollowUpSummaryResponse> {
    if (userProfile.role !== "ADMIN" && userProfile.role !== "ASHA") {
      throw new CaseServiceError(
        "Access denied. Only ASHA workers and Administrators can access follow-up roster.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_RESOURCE"
      );
    }

    if (userProfile.role === "ASHA" && userProfile.uid !== ashaUid) {
      throw new CaseServiceError(
        "Access denied. You can only view your own assigned follow-up roster.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_RESOURCE"
      );
    }

    const followUps = await this.caseRepo.listFollowUpsByAsha(ashaUid);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let dueToday = 0;
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;

    const enrichedFollowUps = followUps.map((f) => {
      const dueDateStr = f.dueAt || f.scheduledAt;
      const dueDate = new Date(dueDateStr);
      const isPending = f.status === "PENDING";
      const isPast = dueDate.getTime() < now.getTime();
      const dateOnlyStr = dueDate.toISOString().split("T")[0];
      const isToday = dateOnlyStr === todayStr;

      const isOverdue = isPending && isPast && !isToday;

      if (f.status === "COMPLETED") {
        completed++;
      } else if (isPending) {
        if (isToday) {
          dueToday++;
        } else if (isOverdue) {
          overdue++;
        } else {
          upcoming++;
        }
      }

      return {
        ...f,
        dueAt: dueDateStr,
        scheduledAt: dueDateStr,
        isOverdue,
      };
    });

    return {
      total: enrichedFollowUps.length,
      dueToday,
      upcoming,
      overdue,
      completed,
      followUps: enrichedFollowUps,
    };
  }

  /**
   * Retrieves immutable activity log for an authorized case
   */
  public async getCaseActivities(
    caseId: string,
    userProfile: UserProfile
  ): Promise<CaseActivity[]> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);
    return this.caseRepo.getActivities(caseId);
  }

  /**
   * Assisted Field Registration:
   * ASHA worker registers a household in their village/jurisdiction.
   * Auto-creates the household, member, and assigned AshaCase.
   */
  public async createFieldEnrollmentCase(
    input: FieldRegistrationInput,
    ashaProfile: UserProfile
  ): Promise<{ case: AshaCase; household: Household }> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Only ASHA workers and Administrators can perform field case registrations.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const now = new Date().toISOString();

    // 1. Create Household
    const householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const household: Household = {
      id: householdId,
      ownerUid: ashaProfile.uid, // Managed under registering staff
      headOfHouseholdName: input.headOfHouseholdName.trim(),
      rationCardNumber: input.rationCardNumber ? input.rationCardNumber.trim() : `RC-PENDING-${Date.now()}`,
      incomeCategory: input.incomeCategory,
      state: input.state.trim(),
      district: input.district.trim(),
      village: input.village ? input.village.trim() : "Rural Area",
      pincode: input.pincode.trim(),
      contactPhone: input.contactPhone?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const savedHousehold = await this.householdRepo.createHousehold(household);

    // 2. Add Head of Household Member if provided
    let memberCount = 1;
    if (input.headAge && input.headGender) {
      const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await this.householdRepo.createMember(householdId, {
        id: memberId,
        householdId,
        fullName: input.headOfHouseholdName.trim(),
        age: input.headAge,
        gender: input.headGender,
        relationship: "Self / Head",
        disabilityStatus: false,
        maternalStatus: "none",
        chronicConditions: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Create Assigned AshaCase
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCase: AshaCase = {
      id: caseId,
      householdId,
      assignedAshaUid: ashaProfile.uid,
      headOfHouseholdName: savedHousehold.headOfHouseholdName,
      district: savedHousehold.district,
      state: savedHousehold.state,
      incomeCategory: savedHousehold.incomeCategory,
      memberCount,
      status: "NEW",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: now,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const savedCase = await this.caseRepo.createCase(newCase);

    // 4. Record Initial Audit Activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: ashaProfile.uid,
      actorRole: ashaProfile.role,
      actorName: ashaProfile.displayName || "ASHA Worker",
      type: "CASE_CREATED",
      description: `Case registered in field for ${savedHousehold.headOfHouseholdName}`,
      timestamp: now,
    });

    return { case: savedCase, household: savedHousehold };
  }

  /**
   * Admin Assignment:
   * Assigns or reassigns a household case to a specific ASHA worker
   */
  public async assignCaseToAsha(
    householdId: string,
    ashaUid: string,
    adminProfile: UserProfile
  ): Promise<AshaCase> {
    if (adminProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Only Administrators can assign household cases to ASHA workers.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const household = await this.householdRepo.getHouseholdById(householdId);
    if (!household) {
      throw new CaseServiceError(
        "Household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    // Validate target ASHA user
    if (this.userRepo) {
      const targetUser = await this.userRepo.getUserById(ashaUid);
      if (!targetUser) {
        throw new CaseServiceError(
          `Target user with UID '${ashaUid}' does not exist.`,
          HTTP_STATUS.NOT_FOUND,
          "USER_NOT_FOUND"
        );
      }
      if (targetUser.role !== "ASHA") {
        throw new CaseServiceError(
          `Target user '${ashaUid}' has role '${targetUser.role}'. Cases can only be assigned to users with the ASHA role.`,
          HTTP_STATUS.BAD_REQUEST,
          "INVALID_TARGET_ROLE"
        );
      }
    }

    // Synchronize active connection request if repository is provided
    if (this.connectionRepo) {
      const activeConn = await this.connectionRepo.getActiveRequestByHouseholdId(householdId);
      if (activeConn && activeConn.ashaUid !== ashaUid) {
        await this.connectionRepo.updateRequest(activeConn.id, {
          status: "REVOKED",
          responseNote: `Reassigned to ASHA worker ${ashaUid} by Administrator.`,
        });
      }
    }

    const existingCase = await this.caseRepo.getCaseByHouseholdId(householdId);
    const now = new Date().toISOString();

    if (existingCase) {
      const oldAsha = existingCase.assignedAshaUid;
      // UPGRADE 6: If this case has an active temporary assignment from a leave request,
      // mark it as SUPERSEDED_BY_MANUAL so that automatic restoration preserves this intentional admin reassignment.
      const updatedTemporaryAssignment = existingCase.temporaryAssignment
        ? {
            ...existingCase.temporaryAssignment,
            status: "SUPERSEDED_BY_MANUAL" as const,
          }
        : undefined;

      const updated = await this.caseRepo.updateCase(existingCase.id, {
        assignedAshaUid: ashaUid,
        ...(updatedTemporaryAssignment ? { temporaryAssignment: updatedTemporaryAssignment } : {}),
      });

      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: adminProfile.uid,
        actorRole: "ADMIN",
        actorName: adminProfile.displayName || "Administrator",
        type: "CASE_ASSIGNED",
        description: `Case reassigned from ASHA ${oldAsha} to ASHA ${ashaUid}`,
        metadata: { oldAsha, newAsha: ashaUid },
        timestamp: now,
      });

      return updated!;
    } else {
      // Create new assigned case
      const members = await this.householdRepo.getMembers(householdId);
      const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newCase: AshaCase = {
        id: caseId,
        householdId,
        assignedAshaUid: ashaUid,
        headOfHouseholdName: household.headOfHouseholdName,
        district: household.district,
        state: household.state,
        incomeCategory: household.incomeCategory,
        memberCount: members.length || 1,
        status: "NEW",
        priority: "NORMAL",
        detectedGapsCount: 0,
        eligibleSchemesCount: 0,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: now,
        updatedAt: now,
      };

      const savedCase = await this.caseRepo.createCase(newCase);

      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: adminProfile.uid,
        actorRole: "ADMIN",
        actorName: adminProfile.displayName || "Administrator",
        type: "CASE_ASSIGNED",
        description: `Case assigned to ASHA worker ${ashaUid} by Administrator`,
        metadata: { assignedAshaUid: ashaUid },
        timestamp: now,
      });

      return savedCase;
    }
  }

  /**
   * Admin inspection of all platform cases
   */
  public async listAllCasesForAdmin(
    adminProfile: UserProfile,
    filter?: { status?: CaseStatus; priority?: CasePriority }
  ): Promise<AshaCase[]> {
    if (adminProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Only Administrators can view platform-wide case rosters.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }
    if (this.leaveService) {
      await this.leaveService.evaluateAndRestoreExpiredLeaves();
    }
    return this.caseRepo.listAllCases(filter);
  }

  // ============================================================================
  // SCHEME-SPECIFIC JOURNEYS & TASK SYSTEM (PHASES 8, 9, 10)
  // ============================================================================

  public static getPmjayDefaultJourney(beneficiaryName?: string | null): SchemeJourneyStep[] {
    return [
      {
        stepId: "ELIGIBILITY_IDENTIFIED",
        title: "Eligibility Identified",
        description: `Senior citizen (70+) healthcare entitlement detected for ${beneficiaryName || "beneficiary"}.`,
        status: "COMPLETED",
      },
      {
        stepId: "BENEFICIARY_CONFIRMED",
        title: "Beneficiary Identity Confirmed",
        description: "ASHA confirmed senior beneficiary identity and age proof documentation.",
        status: "CURRENT",
      },
      {
        stepId: "ENROLLMENT_GUIDANCE",
        title: "e-KYC & Enrollment Guidance",
        description: "Official Aadhaar e-KYC and PM-JAY portal/CSC registration guidance provided.",
        status: "PENDING",
      },
      {
        stepId: "ENROLLMENT_COMPLETED",
        title: "PM-JAY Enrollment Submission",
        description: "Official enrollment application submitted and verified.",
        status: "PENDING",
      },
      {
        stepId: "CARD_STATUS_CONFIRMED",
        title: "Ayushman Card Generated",
        description: "Ayushman Card generation & digital/physical receipt confirmed.",
        status: "PENDING",
      },
      {
        stepId: "BENEFIT_ACCESS_GUIDANCE",
        title: "Hospital Network & Benefit Access",
        description: "Guidance provided on empaneled hospitals and ₹5 Lakh annual cashless care.",
        status: "PENDING",
      },
      {
        stepId: "CASE_RESOLVED",
        title: "Assistance Journey Completed",
        description: "All senior citizen healthcare support milestones completed.",
        status: "PENDING",
      },
    ];
  }

  public static getJsyDefaultJourney(beneficiaryName?: string | null): SchemeJourneyStep[] {
    return [
      {
        stepId: "PREGNANCY_INFORMATION",
        title: "Pregnancy Information Confirmed",
        description: `Maternal health status recorded for ${beneficiaryName || "beneficiary"}.`,
        status: "COMPLETED",
      },
      {
        stepId: "ELIGIBILITY_VERIFICATION",
        title: "JSY Eligibility Verified",
        description: "Verified institutional delivery and maternal care eligibility under NHM.",
        status: "CURRENT",
      },
      {
        stepId: "REGISTRATION_ANC",
        title: "MCP Card & ANC Registration",
        description: "Assisted with Mother and Child Protection card and Antenatal Care checkups.",
        status: "PENDING",
      },
      {
        stepId: "DELIVERY_FACILITY",
        title: "Delivery Facility Mapping",
        description: "Mapped accredited public health center / hospital and emergency transport.",
        status: "PENDING",
      },
      {
        stepId: "INSTITUTIONAL_DELIVERY",
        title: "Institutional Delivery Coordination",
        description: "Assisted with hospital admission and safe institutional delivery.",
        status: "PENDING",
      },
      {
        stepId: "POSTNATAL_FOLLOW_UP",
        title: "Postnatal & Newborn Care",
        description: "Conducted 48-hour and 14-day postnatal visit and infant immunization check.",
        status: "PENDING",
      },
      {
        stepId: "BENEFIT_PROCESSING",
        title: "Direct Benefit Transfer Tracking",
        description: "Tracked JSY cash assistance transfer and hospital discharge paperwork.",
        status: "PENDING",
      },
      {
        stepId: "CASE_RESOLVED",
        title: "Maternal Care Journey Completed",
        description: "Postpartum recovery and maternal health milestones fulfilled.",
        status: "PENDING",
      },
    ];
  }

  /**
   * Initializes scheme-specific journey steps and creates default ASHA tasks
   */
  public async initializeSchemeJourney(
    caseId: string,
    schemeId: string,
    beneficiary?: Member | null,
    userProfile?: UserProfile
  ): Promise<CaseTask[]> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    if (userProfile) {
      this.authorizeCaseAccess(c, userProfile);
    }

    const beneficiaryName = beneficiary ? beneficiary.fullName : c.beneficiaryName;
    const now = new Date().toISOString();

    let journeySteps: SchemeJourneyStep[] = [];
    const generatedTasks: Array<{ type: string; title: string; description: string; order: number }> = [];

    if (schemeId === "ab-pmjay") {
      journeySteps = CaseService.getPmjayDefaultJourney(beneficiaryName);
      generatedTasks.push(
        {
          type: "CONFIRM_BENEFICIARY",
          title: "Confirm senior citizen identity & age documentation",
          description: `Verify Aadhaar card and age proof (70+) for ${beneficiaryName || "beneficiary"}.`,
          order: 1,
        },
        {
          type: "ENROLLMENT_GUIDANCE",
          title: "Provide Aadhaar e-KYC & official PM-JAY registration guidance",
          description: "Guide the family to the nearest CSC center or official beneficiary.nha.gov.in portal.",
          order: 2,
        },
        {
          type: "VERIFY_ENROLLMENT",
          title: "Record PM-JAY enrollment submission & reference number",
          description: "Follow up with household to confirm enrollment application has been submitted.",
          order: 3,
        },
        {
          type: "CONFIRM_CARD",
          title: "Confirm Ayushman Card generation status",
          description: "Confirm whether physical or digital Ayushman Card has been downloaded or received.",
          order: 4,
        },
        {
          type: "BENEFIT_GUIDANCE",
          title: "Provide empaneled hospital guidance & ₹5 Lakh cover details",
          description: "Inform household about nearest empaneled public/private hospitals for cashless care.",
          order: 5,
        }
      );
    } else if (schemeId === "jsy") {
      journeySteps = CaseService.getJsyDefaultJourney(beneficiaryName);
      generatedTasks.push(
        {
          type: "CONFIRM_PREGNANCY",
          title: "Verify pregnancy records & MCP Card documentation",
          description: `Confirm maternal health status, LMP, and Mother and Child Protection Card for ${beneficiaryName || "beneficiary"}.`,
          order: 1,
        },
        {
          type: "ANC_COORDINATION",
          title: "Coordinate Antenatal Care (ANC) checkup schedule",
          description: "Ensure at least 4 ANC checkups, TT injections, and IFA tablets are scheduled.",
          order: 2,
        },
        {
          type: "FACILITY_MAPPING",
          title: "Map accredited delivery hospital & emergency transport",
          description: "Identify nearest accredited public facility and register 108/102 ambulance contact.",
          order: 3,
        },
        {
          type: "DELIVERY_SUPPORT",
          title: "Institutional delivery coordination & admission support",
          description: "Assist family during labor onset for timely hospital arrival and institutional delivery.",
          order: 4,
        },
        {
          type: "POSTNATAL_VISIT",
          title: "Conduct 48-hour & 14-day postnatal visit and immunization",
          description: "Check maternal recovery, infant breastfeeding, and zero-dose immunization (BCG, OPV, Hep B).",
          order: 5,
        },
        {
          type: "DBT_TRACKING",
          title: "Track JSY cash incentive DBT bank transfer",
          description: "Verify beneficiary bank account linkage and receipt of official JSY institutional delivery incentive.",
          order: 6,
        }
      );
    }

    // Update case with scheme journey
    await this.caseRepo.updateCase(caseId, {
      schemeId,
      schemeName: schemeId === "ab-pmjay" ? "Ayushman Bharat PM-JAY" : schemeId === "jsy" ? "Janani Suraksha Yojana" : schemeId,
      beneficiaryMemberId: beneficiary ? beneficiary.id : c.beneficiaryMemberId,
      beneficiaryName: beneficiaryName || c.beneficiaryName,
      journeySteps,
      currentJourneyStep: journeySteps[1]?.stepId || journeySteps[0]?.stepId || null,
      status: "IN_PROGRESS",
    });

    // Create tasks in subcollection
    const createdTasks: CaseTask[] = [];
    for (const t of generatedTasks) {
      const task: CaseTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        schemeId,
        beneficiaryMemberId: beneficiary ? beneficiary.id : c.beneficiaryMemberId,
        beneficiaryName,
        type: t.type,
        title: t.title,
        description: t.description,
        status: "PENDING",
        order: t.order,
        dueDate: null,
        completedAt: null,
        completedBy: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      const savedTask = await this.caseRepo.createTask(caseId, task);
      createdTasks.push(savedTask);
    }

    // Audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile ? userProfile.uid : "system",
      actorRole: userProfile ? userProfile.role : "ASHA",
      actorName: userProfile ? (userProfile.displayName || "ASHA Worker") : "System",
      type: "TASK_CREATED",
      description: `Scheme journey initialized for '${schemeId}' with ${createdTasks.length} field tasks`,
      metadata: { schemeId, taskCount: createdTasks.length },
      timestamp: now,
    });

    return createdTasks;
  }

  /**
   * Retrieves tasks for an authorized case
   */
  public async getCaseTasks(caseId: string, userProfile: UserProfile): Promise<CaseTask[]> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);
    return this.caseRepo.getTasks(caseId);
  }

  /**
   * Creates a custom field task for a case
   */
  public async createCaseTask(
    caseId: string,
    input: CreateCaseTaskInput,
    userProfile: UserProfile
  ): Promise<CaseTask> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const existingTasks = await this.caseRepo.getTasks(caseId);

    const task: CaseTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      schemeId: input.schemeId || c.schemeId,
      beneficiaryMemberId: input.beneficiaryMemberId || c.beneficiaryMemberId,
      beneficiaryName: input.beneficiaryName || c.beneficiaryName,
      type: input.type || "GENERAL",
      title: input.title.trim(),
      description: input.description.trim(),
      status: input.status || "PENDING",
      order: existingTasks.length + 1,
      dueDate: input.dueDate || null,
      completedAt: input.status === "COMPLETED" ? now : null,
      completedBy: input.status === "COMPLETED" ? (userProfile.displayName || "ASHA Worker") : null,
      notes: input.notes ? input.notes.trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    const savedTask = await this.caseRepo.createTask(caseId, task);

    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "TASK_CREATED",
      description: `Task created: ${task.title}`,
      metadata: { taskId: task.id, title: task.title },
      timestamp: now,
    });

    return savedTask;
  }

  /**
   * Updates an existing task
   */
  public async updateCaseTask(
    caseId: string,
    taskId: string,
    updates: UpdateCaseTaskInput,
    userProfile: UserProfile
  ): Promise<CaseTask> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateTask(caseId, taskId, {
      ...updates,
      completedAt: updates.status === "COMPLETED" ? now : undefined,
      completedBy: updates.status === "COMPLETED" ? (userProfile.displayName || "ASHA Worker") : undefined,
    });

    if (!updated) {
      throw new CaseServiceError("Task not found.", HTTP_STATUS.NOT_FOUND, "TASK_NOT_FOUND");
    }

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: updates.status === "COMPLETED" ? "TASK_COMPLETED" : "TASK_STATUS_CHANGED",
      description: `Task '${updated.title}' updated to status '${updated.status}'`,
      metadata: { taskId, newStatus: updated.status },
      timestamp: now,
    });

    return updated;
  }

  /**
   * Completes a task and advances the scheme journey step
   */
  public async completeCaseTask(
    caseId: string,
    taskId: string,
    input: CompleteCaseTaskInput,
    userProfile: UserProfile
  ): Promise<CaseTask> {
    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }
    this.authorizeCaseAccess(c, userProfile);

    const now = new Date().toISOString();
    const updated = await this.caseRepo.updateTask(caseId, taskId, {
      status: "COMPLETED",
      completedAt: now,
      completedBy: userProfile.displayName || "ASHA Worker",
      notes: input.notes ? input.notes.trim() : undefined,
    });

    if (!updated) {
      throw new CaseServiceError("Task not found.", HTTP_STATUS.NOT_FOUND, "TASK_NOT_FOUND");
    }

    // Re-evaluate journey progress
    const allTasks = await this.caseRepo.getTasks(caseId);
    const completedTasksCount = allTasks.filter((t) => t.status === "COMPLETED").length;
    const totalTasksCount = allTasks.length;

    let journeySteps = c.journeySteps || [];
    if (journeySteps.length === 0 && c.schemeId) {
      if (c.schemeId === "ab-pmjay") {
        journeySteps = CaseService.getPmjayDefaultJourney(c.beneficiaryName);
      } else if (c.schemeId === "jsy") {
        journeySteps = CaseService.getJsyDefaultJourney(c.beneficiaryName);
      }
    }

    if (journeySteps.length > 0) {
      // Map task completion to journey step advancement
      const progressFraction = totalTasksCount > 0 ? completedTasksCount / totalTasksCount : 0;
      const stepIndex = Math.min(
        Math.floor(progressFraction * (journeySteps.length - 1)) + 1,
        journeySteps.length - 1
      );

      const updatedJourneySteps = journeySteps.map((step, idx) => {
        if (idx < stepIndex) {
          return { ...step, status: "COMPLETED" as const, completedAt: step.completedAt || now };
        } else if (idx === stepIndex) {
          return { ...step, status: (completedTasksCount === totalTasksCount ? "COMPLETED" : "CURRENT") as "COMPLETED" | "CURRENT" };
        } else {
          return { ...step, status: "PENDING" as const };
        }
      });

      const nextStep = updatedJourneySteps[stepIndex]?.stepId || null;
      const isAllDone = completedTasksCount === totalTasksCount;

      await this.caseRepo.updateCase(caseId, {
        journeySteps: updatedJourneySteps,
        currentJourneyStep: nextStep,
        status: isAllDone ? "RESOLVED" : "IN_PROGRESS",
        nextFollowUpAt: isAllDone ? null : undefined,
      });

      // When case reaches complete resolution, mark any lingering intermediate follow-ups COMPLETED
      if (isAllDone) {
        const caseFollowUps = await this.caseRepo.getFollowUps(caseId);
        for (const pf of caseFollowUps) {
          if (pf.status === "PENDING") {
            await this.caseRepo.updateFollowUp(caseId, pf.id, {
              status: "COMPLETED",
              outcome: "Resolved with final scheme journey milestone.",
              completedAt: now,
              completedBy: userProfile.displayName || "ASHA Worker",
            });
          }
        }
      }

      // Synchronize linked AshaAssistanceRequest in assistanceRepository if present
      if (c.assistanceRequestId && this.assistanceRepo) {
        if (isAllDone) {
          await this.assistanceRepo.updateRequestStatus(
            c.assistanceRequestId,
            "RESOLVED",
            "All scheme journey tasks completed and resolved by ASHA worker."
          );
        } else {
          await this.assistanceRepo.updateRequestStatus(
            c.assistanceRequestId,
            "IN_PROGRESS",
            `Assistance in progress: ${completedTasksCount}/${totalTasksCount} tasks completed.`
          );
        }
      }
    }

    // Helper to calculate relative ISO date
    const addDays = (d: Date, days: number) => {
      const target = new Date(d);
      target.setDate(target.getDate() + days);
      return target.toISOString();
    };

    // Deterministic Next Follow-Up Generation based on Scheme and Task Type
    let nextFollowUpPayload: { title: string; reason: string; dueAt: string } | null = null;

    if (c.schemeId === "ab-pmjay") {
      if (updated.type === "CONFIRM_BENEFICIARY") {
        nextFollowUpPayload = {
          title: "PM-JAY e-KYC & Registration Assistance",
          reason: `Assist ${c.beneficiaryName || "senior citizen"} with official Aadhaar e-KYC and PM-JAY registration at CSC/portal`,
          dueAt: addDays(new Date(), 3),
        };
      } else if (updated.type === "ENROLLMENT_GUIDANCE") {
        nextFollowUpPayload = {
          title: "Verify PM-JAY Application Submission",
          reason: `Verify PM-JAY application submission and record reference number for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 7),
        };
      } else if (updated.type === "VERIFY_ENROLLMENT") {
        nextFollowUpPayload = {
          title: "Check Ayushman Card Generation Status",
          reason: `Check Ayushman Card generation and digital/physical receipt for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 5),
        };
      } else if (updated.type === "CONFIRM_CARD") {
        nextFollowUpPayload = {
          title: "Deliver Ayushman Card & Hospital Network Guidance",
          reason: `Deliver Ayushman Card to ${c.beneficiaryName || "beneficiary"} and inform family of nearest empaneled hospitals for ₹5 Lakh cashless care`,
          dueAt: addDays(new Date(), 3),
        };
      }
    } else if (c.schemeId === "jsy") {
      if (updated.type === "CONFIRM_PREGNANCY") {
        nextFollowUpPayload = {
          title: "Antenatal Care (ANC) & MCP Card Follow-up",
          reason: `Ensure Mother and Child Protection (MCP) card issuance and schedule Antenatal Care checkups for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 7),
        };
      } else if (updated.type === "ANC_COORDINATION") {
        nextFollowUpPayload = {
          title: "Map Institutional Delivery Hospital & Ambulance",
          reason: `Map accredited public hospital and confirm 108/102 emergency ambulance contact for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 14),
        };
      } else if (updated.type === "FACILITY_MAPPING") {
        nextFollowUpPayload = {
          title: "Birth Preparedness & Delivery Readiness Check",
          reason: `Review birth preparedness plan and hospital admission readiness before Expected Date of Delivery for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 14),
        };
      } else if (updated.type === "DELIVERY_SUPPORT") {
        nextFollowUpPayload = {
          title: "48-Hour Postnatal Visit & Newborn Vaccines",
          reason: `Conduct 48-hour postpartum home visit for ${c.beneficiaryName || "beneficiary"} to check maternal recovery, newborn breastfeeding, and zero-dose vaccines`,
          dueAt: addDays(new Date(), 2),
        };
      } else if (updated.type === "POSTNATAL_VISIT") {
        nextFollowUpPayload = {
          title: "Track JSY Cash Incentive DBT Transfer",
          reason: `Verify beneficiary bank account linkage and receipt of official JSY institutional delivery cash assistance for ${c.beneficiaryName || "beneficiary"}`,
          dueAt: addDays(new Date(), 10),
        };
      }
    }

    if (nextFollowUpPayload) {
      const existingFollowUps = await this.caseRepo.getFollowUps(caseId);
      const isDuplicate = existingFollowUps.some(
        (f) => f.sourceTaskId === taskId && f.status === "PENDING"
      );

      if (!isDuplicate) {
        const autoFollowUp: CaseFollowUp = {
          id: `fu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          caseId,
          householdId: c.householdId,
          headOfHouseholdName: c.headOfHouseholdName,
          assignedAshaUid: c.assignedAshaUid,
          schemeId: c.schemeId,
          schemeName: c.schemeName,
          beneficiaryMemberId: c.beneficiaryMemberId,
          beneficiaryName: c.beneficiaryName,
          title: nextFollowUpPayload.title,
          reason: nextFollowUpPayload.reason,
          dueAt: nextFollowUpPayload.dueAt,
          scheduledAt: nextFollowUpPayload.dueAt,
          status: "PENDING",
          sourceTaskId: taskId,
          notes: `Automatically generated following completion of task '${updated.title}'.`,
          createdAt: now,
          updatedAt: now,
        };

        await this.caseRepo.createFollowUp(caseId, autoFollowUp);
        await this.caseRepo.updateCase(caseId, { nextFollowUpAt: nextFollowUpPayload.dueAt });

        await this.caseRepo.createActivity(caseId, {
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          caseId,
          actorUid: userProfile.uid,
          actorRole: userProfile.role,
          actorName: userProfile.displayName || "ASHA Worker",
          type: "FOLLOWUP_SCHEDULED",
          description: `Automatic follow-up scheduled for ${nextFollowUpPayload.dueAt}: ${nextFollowUpPayload.title}`,
          metadata: { dueAt: nextFollowUpPayload.dueAt, sourceTaskId: taskId },
          timestamp: now,
        });

        if (this.automationService) {
          this.automationService.emitDomainEvent("FOLLOWUP_CREATED", {
            caseId,
            householdId: c.householdId,
            assignedAshaUid: c.assignedAshaUid,
            schemeId: c.schemeId,
            beneficiaryMemberId: c.beneficiaryMemberId,
            beneficiaryName: c.beneficiaryName,
            payload: {
              followUpId: autoFollowUp.id,
              title: autoFollowUp.title,
              reason: autoFollowUp.reason,
              dueAt: autoFollowUp.dueAt,
              sourceTaskId: taskId,
            },
          }).catch(() => {});
        }
      }
    }

    // Log immutable audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "TASK_COMPLETED",
      description: `Task completed: '${updated.title}' (${completedTasksCount}/${totalTasksCount} tasks complete)`,
      metadata: { taskId, title: updated.title, completedTasksCount, totalTasksCount },
      timestamp: now,
    });

    // Emit domain events
    if (this.automationService) {
      this.automationService.emitDomainEvent("TASK_COMPLETED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId: c.schemeId,
        beneficiaryMemberId: c.beneficiaryMemberId,
        beneficiaryName: c.beneficiaryName,
        payload: {
          taskId: updated.id,
          taskTitle: updated.title,
          taskType: updated.type,
          completedTasksCount,
          totalTasksCount,
        },
      }).catch(() => {});

      const isAllDone = completedTasksCount === totalTasksCount;
      if (isAllDone) {
        this.automationService.emitDomainEvent("CASE_RESOLVED", {
          caseId,
          householdId: c.householdId,
          assignedAshaUid: c.assignedAshaUid,
          schemeId: c.schemeId,
          beneficiaryMemberId: c.beneficiaryMemberId,
          beneficiaryName: c.beneficiaryName,
          payload: {
            resolvedAt: now,
            schemeId: c.schemeId,
          },
        }).catch(() => {});
      }
    }

    return updated;
  }

  /**
   * Generates deterministic proactive attention signals across an ASHA worker's assigned caseload.
   * Evaluates authoritative household demographics, deterministic scheme eligibility,
   * healthcare gaps, active task states, and scheduled follow-ups server-side on demand.
   * Filters out completed and active scheme journeys so resolved cases do not generate stale Start Assistance signals.
   */
  public async getAshaAttentionSignals(
    ashaUid: string
  ): Promise<AshaAttentionSignalsResponse> {
    const cases = await this.caseRepo.listCasesByAsha(ashaUid);
    const now = new Date();
    const signals: AshaAttentionSignal[] = [];

    for (const c of cases) {
      try {
        const household = await this.householdRepo.getHouseholdById(c.householdId);
        if (!household) continue;

        const members = await this.householdRepo.getMembers(c.householdId);

        // Fetch case sub-collections and evaluate deterministic intelligence on the fly
        const [eligibilityResults, guidance, tasks, followUps, householdRequests] = await Promise.all([
          this.eligibilityService.evaluateHouseholdForSchemes(household, members),
          this.guidanceService.getHouseholdGuidance(household, members),
          this.caseRepo.getTasks(c.id),
          this.caseRepo.getFollowUps(c.id),
          this.assistanceRepo ? this.assistanceRepo.listRequestsByHouseholdId(c.householdId) : Promise.resolve([]),
        ]);

        const isCaseResolved = ["RESOLVED", "CLOSED"].includes(c.status);
        const hasActiveJourney = Boolean(
          c.schemeId && ["IN_PROGRESS", "ACCEPTED", "REQUESTED", "NEW"].includes(c.status)
        );

        // 1. OVERDUE FOLLOW-UP SIGNALS (URGENT)
        const overdueFollowUp = !isCaseResolved
          ? followUps.find(
              (f) => f.status === "PENDING" && new Date(f.scheduledAt).getTime() < now.getTime()
            )
          : null;
        const isCaseNextFollowUpOverdue =
          !isCaseResolved && c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() < now.getTime();

        if (overdueFollowUp || isCaseNextFollowUpOverdue) {
          signals.push({
            id: `sig_overdue_${c.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "URGENT",
            category: "OVERDUE_FOLLOWUP",
            title: `Overdue Follow-up: ${overdueFollowUp?.reason || "Scheduled Home Visit"}`,
            subtitle: `Visit was scheduled for ${new Date(
              overdueFollowUp?.scheduledAt || c.nextFollowUpAt!
            ).toLocaleDateString()}`,
            beneficiaryName: overdueFollowUp?.beneficiaryName || c.beneficiaryName || null,
            beneficiaryMemberId: overdueFollowUp?.beneficiaryMemberId || c.beneficiaryMemberId || null,
            schemeId: c.schemeId || null,
            schemeName: c.schemeName || null,
            recommendedAction: "Conduct doorstep follow-up visit immediately",
            actionType: "COMPLETE_FOLLOWUP",
          });
        }

        // 2. BLOCKED FIELD TASK SIGNALS (URGENT)
        const blockedTask = tasks.find((t) => t.status === "BLOCKED");
        if (blockedTask) {
          signals.push({
            id: `sig_blocked_${c.id}_${blockedTask.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "URGENT",
            category: "BLOCKED_TASK",
            title: `Blocked Field Task: ${blockedTask.title}`,
            subtitle: blockedTask.notes || "Field assistance task is blocked and requires attention.",
            beneficiaryName: blockedTask.beneficiaryName || c.beneficiaryName || null,
            beneficiaryMemberId: blockedTask.beneficiaryMemberId || c.beneficiaryMemberId || null,
            schemeId: blockedTask.schemeId || c.schemeId || null,
            schemeName: c.schemeName || null,
            recommendedAction: "Review task notes and unblock scheme journey",
            actionType: "UNBLOCK_TASK",
          });
        }

        // 3. PREGNANCY CARE & JSY SIGNALS (HIGH)
        const jsyResult = eligibilityResults.find((r) => r.schemeId === "jsy");
        const pregnantMember =
          members.find((m) => m.maternalStatus === "pregnant") ||
          (jsyResult?.status === "ELIGIBLE"
            ? members.find((m) => m.gender === "female" && m.age >= 18 && m.age <= 49)
            : null);

        const jsyRequest = householdRequests.find(
          (r) => r.schemeId === "jsy" && (pregnantMember ? r.beneficiaryMemberId === pregnantMember.id : true)
        );
        const isJsyCompleted =
          (c.schemeId === "jsy" && ["RESOLVED", "CLOSED"].includes(c.status)) ||
          (jsyRequest && ["RESOLVED", "CLOSED"].includes(jsyRequest.status));
        const isJsyActive =
          (c.schemeId === "jsy" && !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(c.status)) ||
          (jsyRequest && !["RESOLVED", "CLOSED", "DECLINED"].includes(jsyRequest.status));

        // Only generate START_ASSISTANCE signal if JSY has neither an active nor completed journey
        if (
          pregnantMember &&
          !isJsyActive &&
          !isJsyCompleted &&
          (jsyResult?.status === "ELIGIBLE" || jsyResult?.status === "NEEDS_INFORMATION")
        ) {
          signals.push({
            id: `sig_jsy_${c.id}_${pregnantMember.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "HIGH",
            category: "PREGNANCY_CARE",
            title: `${pregnantMember.fullName} — Maternal Care & JSY Eligible`,
            subtitle:
              "Antenatal care registration, institutional delivery mapping, and ₹1,400 benefit recommended.",
            beneficiaryName: pregnantMember.fullName,
            beneficiaryMemberId: pregnantMember.id,
            beneficiaryAge: pregnantMember.age,
            beneficiaryRelationship: pregnantMember.relationship,
            schemeId: "jsy",
            schemeName: "Janani Suraksha Yojana (JSY)",
            recommendedAction: "Start JSY Doorstep Assistance",
            actionType: "INITIATE_SCHEME",
          });
        }

        // 4. SENIOR CITIZEN PM-JAY SIGNALS (HIGH)
        const pmjayResult = eligibilityResults.find((r) => r.schemeId === "ab-pmjay");
        const seniorMember = members.find((m) => m.age >= 70);

        const pmjayRequest = householdRequests.find(
          (r) => r.schemeId === "ab-pmjay" && (seniorMember ? r.beneficiaryMemberId === seniorMember.id : true)
        );
        const isPmjayCompleted =
          (c.schemeId === "ab-pmjay" && ["RESOLVED", "CLOSED"].includes(c.status)) ||
          (pmjayRequest && ["RESOLVED", "CLOSED"].includes(pmjayRequest.status));
        const isPmjayActive =
          (c.schemeId === "ab-pmjay" && !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(c.status)) ||
          (pmjayRequest && !["RESOLVED", "CLOSED", "DECLINED"].includes(pmjayRequest.status));

        // Only generate START_ASSISTANCE signal if PM-JAY has neither an active nor completed journey
        if (
          seniorMember &&
          !isPmjayActive &&
          !isPmjayCompleted &&
          pmjayResult?.status === "ELIGIBLE"
        ) {
          signals.push({
            id: `sig_pmjay_${c.id}_${seniorMember.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "HIGH",
            category: "SENIOR_CITIZEN_PMJAY",
            title: `${seniorMember.fullName} (Age ${seniorMember.age}) — Senior Citizen PM-JAY Eligible`,
            subtitle:
              "Doorstep Aadhaar e-KYC guidance and ₹5 Lakh Ayushman Vay Vandana Card issuance recommended.",
            beneficiaryName: seniorMember.fullName,
            beneficiaryMemberId: seniorMember.id,
            beneficiaryAge: seniorMember.age,
            beneficiaryRelationship: seniorMember.relationship,
            schemeId: "ab-pmjay",
            schemeName: "Ayushman Bharat — PM-JAY (Senior 70+)",
            recommendedAction: "Start PM-JAY Doorstep Assistance",
            actionType: "INITIATE_SCHEME",
          });
        }

        // 5. INCOMPLETE INFORMATION SIGNALS (MEDIUM)
        if (
          !hasActiveJourney &&
          !isCaseResolved &&
          (guidance.householdStatus === "MORE_INFORMATION_NEEDED" ||
            guidance.gaps.some((g) => g.type === "MISSING_INFORMATION"))
        ) {
          signals.push({
            id: `sig_missing_info_${c.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "MEDIUM",
            category: "MISSING_DOCUMENTS",
            title: `Incomplete Details: ${c.headOfHouseholdName}'s Household`,
            subtitle:
              guidance.statusSummary ||
              "Additional household verification details needed for entitlement matching.",
            beneficiaryName: null,
            beneficiaryMemberId: null,
            schemeId: null,
            schemeName: null,
            recommendedAction: "Review household record and collect missing details",
            actionType: "REVIEW_CASE",
          });
        }

        // 6. UPCOMING SCHEDULED FOLLOW-UP (LOW)
        const upcomingFollowUp = !isCaseResolved
          ? followUps.find(
              (f) =>
                f.status === "PENDING" &&
                new Date(f.scheduledAt).getTime() >= now.getTime() &&
                new Date(f.scheduledAt).getTime() <= now.getTime() + 48 * 3600 * 1000
            )
          : null;

        if (upcomingFollowUp && !overdueFollowUp) {
          signals.push({
            id: `sig_upcoming_${c.id}_${upcomingFollowUp.id}`,
            householdId: c.householdId,
            caseId: c.id,
            headOfHouseholdName: c.headOfHouseholdName,
            district: c.district,
            state: c.state,
            priority: "LOW",
            category: "UPCOMING_FOLLOWUP",
            title: `Upcoming Visit: ${upcomingFollowUp.reason}`,
            subtitle: `Scheduled for ${new Date(upcomingFollowUp.scheduledAt).toLocaleDateString()}`,
            beneficiaryName: upcomingFollowUp.beneficiaryName || c.beneficiaryName || null,
            beneficiaryMemberId: upcomingFollowUp.beneficiaryMemberId || c.beneficiaryMemberId || null,
            schemeId: c.schemeId || null,
            schemeName: c.schemeName || null,
            recommendedAction: "Prepare materials for upcoming home visit",
            actionType: "COMPLETE_FOLLOWUP",
          });
        }
      } catch (err) {
        // Continue processing remaining households gracefully
      }
    }

    // Priority ordering: URGENT (4) -> HIGH (3) -> MEDIUM (2) -> LOW (1)
    const priorityWeight: Record<AshaAttentionPriority, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    signals.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    const activeSchemeJourneys = cases.filter(
      (c) => c.schemeId && ["IN_PROGRESS", "ACCEPTED", "REQUESTED"].includes(c.status)
    ).length;

    const overdueFollowUps = cases.filter(
      (c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() < now.getTime()
    ).length;

    return {
      summary: {
        totalAssignedHouseholds: cases.length,
        needsAttentionCount: signals.length,
        activeSchemeJourneys,
        overdueFollowUps,
      },
      signals,
    };
  }

  /**
   * Proactively initiates scheme assistance directly from an ASHA worker's caseload.
   * Validates server-side case ownership, verifies deterministic eligibility, creates synchronized
   * AshaAssistanceRequest (initiatedBy: "ASHA"), seeds the 5 PM-JAY / 6 JSY tasks, and logs immutable audit activity.
   */
  public async initiateSchemeAssistance(
    caseId: string,
    input: InitiateSchemeAssistanceInput,
    ashaProfile: UserProfile
  ): Promise<InitiateSchemeAssistanceResponse> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new CaseServiceError(
        "Only ASHA workers and Administrators can initiate proactive scheme assistance.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const c = await this.caseRepo.getCaseById(caseId);
    if (!c) {
      throw new CaseServiceError("Case not found.", HTTP_STATUS.NOT_FOUND, "CASE_NOT_FOUND");
    }

    // IDOR boundary
    this.authorizeCaseAccess(c, ashaProfile);

    // Validate scheme ID
    const schemeId = input.schemeId.trim();
    if (schemeId !== "ab-pmjay" && schemeId !== "jsy") {
      throw new CaseServiceError(
        `Scheme '${schemeId}' is not supported for automated field assistance.`,
        HTTP_STATUS.BAD_REQUEST,
        "UNSUPPORTED_SCHEME"
      );
    }

    const household = await this.householdRepo.getHouseholdById(c.householdId);
    if (!household) {
      throw new CaseServiceError(
        "Associated household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    const members = await this.householdRepo.getMembers(c.householdId);

    // Validate or determine beneficiary member
    let beneficiary: Member | null = null;
    if (input.beneficiaryMemberId) {
      beneficiary = members.find((m) => m.id === input.beneficiaryMemberId) || null;
      if (!beneficiary) {
        throw new CaseServiceError(
          "Selected beneficiary member was not found in this household.",
          HTTP_STATUS.BAD_REQUEST,
          "BENEFICIARY_NOT_FOUND"
        );
      }
    } else {
      if (schemeId === "ab-pmjay") {
        beneficiary = members.find((m) => m.age >= 70) || null;
      } else if (schemeId === "jsy") {
        beneficiary =
          members.find((m) => m.maternalStatus === "pregnant") ||
          members.find((m) => m.gender === "female" && m.age >= 18) ||
          null;
      }
    }

    // Evaluate deterministic eligibility on the fly
    const eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
      household,
      members
    );
    const schemeResult = eligibilityResults.find((r) => r.schemeId === schemeId);
    if (!schemeResult || schemeResult.status === "NOT_ELIGIBLE") {
      throw new CaseServiceError(
        `Household does not meet verified eligibility criteria for ${
          schemeId === "ab-pmjay" ? "Ayushman Bharat PM-JAY" : "Janani Suraksha Yojana (JSY)"
        }.`,
        HTTP_STATUS.BAD_REQUEST,
        "NOT_ELIGIBLE"
      );
    }

    if (schemeId === "ab-pmjay") {
      if (schemeResult.status !== "ELIGIBLE" || !beneficiary || beneficiary.age < 70) {
        throw new CaseServiceError(
          "Beneficiary does not meet the 70+ age requirement for Ayushman Bharat PM-JAY.",
          HTTP_STATUS.BAD_REQUEST,
          "NOT_ELIGIBLE"
        );
      }
    } else if (schemeId === "jsy") {
      const isMaternalEligible =
        beneficiary?.maternalStatus === "pregnant" ||
        members.some((m) => m.maternalStatus === "pregnant");
      if (!isMaternalEligible) {
        throw new CaseServiceError(
          "Household does not meet pregnancy criteria for Janani Suraksha Yojana (JSY).",
          HTTP_STATUS.BAD_REQUEST,
          "NOT_ELIGIBLE"
        );
      }
    }

    // Check duplicate or completed scheme journey on this case
    if (
      c.schemeId === schemeId &&
      (!beneficiary || c.beneficiaryMemberId === beneficiary.id)
    ) {
      if (["RESOLVED", "CLOSED"].includes(c.status)) {
        throw new CaseServiceError(
          "An assistance journey has already been completed for this scheme and beneficiary.",
          HTTP_STATUS.CONFLICT,
          "DUPLICATE_ACTIVE_REQUEST"
        );
      }
      if (c.status !== "CITIZEN_DECLINED") {
        throw new CaseServiceError(
          "An active scheme journey already exists for this scheme and beneficiary.",
          HTTP_STATUS.CONFLICT,
          "DUPLICATE_ACTIVE_REQUEST"
        );
      }
    }

    // Check duplicate or completed request in assistance repository
    if (this.assistanceRepo) {
      const existingRequests = await this.assistanceRepo.listRequestsByHouseholdId(c.householdId);
      const duplicateOrCompleted = existingRequests.find(
        (r) =>
          r.schemeId === schemeId &&
          (beneficiary ? r.beneficiaryMemberId === beneficiary.id : true) &&
          r.status !== "DECLINED"
      );
      if (duplicateOrCompleted) {
        if (["RESOLVED", "CLOSED"].includes(duplicateOrCompleted.status)) {
          throw new CaseServiceError(
            "An assistance request has already been completed for this scheme and beneficiary.",
            HTTP_STATUS.CONFLICT,
            "DUPLICATE_ACTIVE_REQUEST"
          );
        } else {
          throw new CaseServiceError(
            "An active assistance request already exists for this scheme and beneficiary.",
            HTTP_STATUS.CONFLICT,
            "DUPLICATE_ACTIVE_REQUEST"
          );
        }
      }
    }

    const now = new Date().toISOString();
    const schemeName =
      schemeId === "ab-pmjay"
        ? "Ayushman Bharat — PM-JAY (Senior 70+)"
        : "Janani Suraksha Yojana (JSY)";

    // Create synchronized AshaAssistanceRequest stamped with initiatedBy: "ASHA"
    let assistanceRequestId: string | null = null;
    if (this.assistanceRepo) {
      const requestId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      assistanceRequestId = requestId;
      const ashaRequest: AshaAssistanceRequest = {
        id: requestId,
        householdId: c.householdId,
        citizenUid: household.ownerUid || c.householdId,
        headOfHouseholdName: c.headOfHouseholdName,
        district: c.district,
        state: c.state,
        ashaUid: ashaProfile.uid,
        ashaServiceCode: ashaProfile.ashaServiceCode || "ASHA-WORKER",
        ashaName: ashaProfile.displayName || "ASHA Worker",
        category: "SCHEME_ENROLLMENT",
        schemeId,
        schemeName,
        beneficiaryMemberId: beneficiary ? beneficiary.id : null,
        beneficiaryName: beneficiary ? beneficiary.fullName : null,
        beneficiaryAge: beneficiary ? beneficiary.age : null,
        beneficiaryRelationship: beneficiary ? beneficiary.relationship : null,
        message:
          input.notes ||
          `ASHA worker proactively initiated doorstep assistance for ${schemeName}.`,
        priority: input.priority || "HIGH",
        status: "ACCEPTED",
        initiatedBy: "ASHA",
        caseId: c.id,
        createdAt: now,
        updatedAt: now,
      };
      await this.assistanceRepo.createRequest(ashaRequest);
    }

    // Initialize Scheme Journey and seed the 5 PM-JAY or 6 JSY tasks
    const tasks = await this.initializeSchemeJourney(
      caseId,
      schemeId,
      beneficiary,
      ashaProfile
    );

    // Update case with assistanceRequestId & priority
    await this.caseRepo.updateCase(caseId, {
      assistanceRequestId: assistanceRequestId || undefined,
      priority: input.priority || "HIGH",
      status: "IN_PROGRESS",
    });

    const freshCase = await this.caseRepo.getCaseById(caseId);

    // Record immutable audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: ashaProfile.uid,
      actorRole: ashaProfile.role,
      actorName: ashaProfile.displayName || "ASHA Worker",
      type: "CASE_SCHEME_INITIATED",
      description: `ASHA proactively initiated scheme assistance for '${schemeName}' for ${
        beneficiary?.fullName || "household"
      }`,
      metadata: {
        schemeId,
        beneficiaryMemberId: beneficiary?.id,
        initiationSource: "ASHA",
      },
      timestamp: now,
    });

    if (this.automationService) {
      this.automationService.emitDomainEvent("CASE_SCHEME_INITIATED", {
        caseId,
        householdId: c.householdId,
        assignedAshaUid: c.assignedAshaUid,
        schemeId,
        beneficiaryMemberId: beneficiary?.id,
        beneficiaryName: beneficiary?.fullName,
        payload: {
          schemeName,
          tasksCount: tasks.length,
          initiatedBy: ashaProfile.displayName || "ASHA Worker",
        },
      }).catch(() => {});
    }

    return {
      case: freshCase || c,
      tasks,
      journeySteps: freshCase?.journeySteps || [],
    };
  }
}

