import {
  AshaCase,
  CaseNote,
  CaseFollowUp,
  CaseActivity,
  CaseStatus,
  CasePriority,
  CaseDetailResponse,
  CaseSummaryResponse,
  FieldRegistrationInput,
} from "../../../shared/types/case.js";
import { UserProfile } from "../../../shared/types/auth.js";
import { Household, Member } from "../../../shared/types/household.js";
import {
  UpdateCaseInput,
  CreateCaseNoteInput,
  CreateCaseFollowUpInput,
  UpdateCaseFollowUpInput,
} from "../../../shared/schemas/case.schema.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { EligibilityService } from "./eligibility/eligibility.service.js";
import { GuidanceService } from "./guidance/guidance.service.js";
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
    private connectionRepo?: ConnectionRepository
  ) {}

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
    const cases = await this.caseRepo.listCasesByAsha(ashaUid);
    const now = new Date();

    const totalAssigned = cases.length;
    const needsAttentionCount = cases.filter(
      (c) => c.status === "NEEDS_ATTENTION" || c.detectedGapsCount > 0
    ).length;
    const urgentCount = cases.filter(
      (c) => c.priority === "URGENT" || c.priority === "HIGH"
    ).length;
    const upcomingFollowUpsCount = cases.filter(
      (c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt) >= now
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
    const [eligibilityResults, guidance, notes, followUps, activities] = await Promise.all([
      this.eligibilityService.evaluateHouseholdForSchemes(household, members),
      this.guidanceService.getCitizenGuidance(c.householdId),
      this.caseRepo.getNotes(caseId),
      this.caseRepo.getFollowUps(caseId),
      this.caseRepo.getActivities(caseId),
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

    return {
      case: c,
      household,
      members,
      eligibilityResults,
      guidance,
      notes,
      followUps,
      activities,
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
    const followUp: CaseFollowUp = {
      id: `fu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      scheduledAt: input.scheduledAt,
      reason: input.reason.trim(),
      status: "PENDING",
      notes: input.notes ? input.notes.trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    const savedFollowUp = await this.caseRepo.createFollowUp(caseId, followUp);

    // Update next follow-up pointer on case
    await this.caseRepo.updateCase(caseId, {
      nextFollowUpAt: input.scheduledAt,
    });

    // Record audit activity
    await this.caseRepo.createActivity(caseId, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      actorName: userProfile.displayName || "ASHA Worker",
      type: "FOLLOWUP_SCHEDULED",
      description: `Follow-up scheduled for ${input.scheduledAt}: ${input.reason}`,
      metadata: { scheduledAt: input.scheduledAt, reason: input.reason },
      timestamp: now,
    });

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
      notes: updates.notes,
      completedAt: updates.status === "COMPLETED" ? now : null,
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
      nextFollowUpAt: nextPending ? nextPending.scheduledAt : null,
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
    }

    return updated;
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
      const updated = await this.caseRepo.updateCase(existingCase.id, {
        assignedAshaUid: ashaUid,
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
    return this.caseRepo.listAllCases(filter);
  }
}
