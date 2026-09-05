import { UserProfile } from "../../../shared/types/auth.js";
import {
  AshaLeaveRequest,
  AshaTemporaryAssignmentRecord,
  CreateLeaveRequestInput,
  ApproveLeaveRequestInput,
  RejectLeaveRequestInput,
  ApproveLeaveResponse,
  RestoreCheckResponse,
  LeaveAuditLog,
} from "../../../shared/types/leave.js";
import { LeaveRepository } from "../repositories/leave.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { HTTP_STATUS } from "../config/constants.js";

export class LeaveServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "LeaveServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class LeaveService {
  constructor(
    private leaveRepo: LeaveRepository,
    private caseRepo: CaseRepository,
    private userRepo: UserRepository,
    private connectionRepo?: ConnectionRepository
  ) {}

  /**
   * Normalizes an end date (YYYY-MM-DD) to the precise end-of-day boundary in Indian Standard Time (IST, UTC+5:30)
   * Example: "2026-09-08" -> 2026-09-08T23:59:59.999+05:30 in UTC ISO format (2026-09-08T18:29:59.999Z)
   */
  public normalizeEffectiveUntil(endDateStr: string): string {
    const trimmed = endDateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const istBoundary = new Date(`${trimmed}T23:59:59.999+05:30`);
      if (!isNaN(istBoundary.getTime())) {
        return istBoundary.toISOString();
      }
    }
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }
    throw new LeaveServiceError("Invalid end date format.", HTTP_STATUS.BAD_REQUEST, "INVALID_DATE");
  }

  /**
   * Normalizes a start date (YYYY-MM-DD) to the start-of-day in IST
   */
  public normalizeStartDate(startDateStr: string): string {
    const trimmed = startDateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    throw new LeaveServiceError("Invalid start date format.", HTTP_STATUS.BAD_REQUEST, "INVALID_DATE");
  }

  /**
   * PHASE 2: Authenticated ASHA submits a leave request.
   * Derives ashaId strictly from authenticated user profile.
   * Validates date ranges and rejects overlapping active leave requests.
   */
  public async createLeaveRequest(
    ashaProfile: UserProfile,
    input: CreateLeaveRequestInput
  ): Promise<AshaLeaveRequest> {
    if (ashaProfile.role !== "ASHA") {
      throw new LeaveServiceError(
        "Only ASHA healthcare workers can submit leave requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const startDate = this.normalizeStartDate(input.startDate);
    const endDate = this.normalizeStartDate(input.endDate);

    const startTimestamp = new Date(`${startDate}T00:00:00.000+05:30`).getTime();
    const endTimestamp = new Date(`${endDate}T23:59:59.999+05:30`).getTime();

    if (startTimestamp > endTimestamp) {
      throw new LeaveServiceError(
        "Leave start date cannot be after end date.",
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_DATE_RANGE"
      );
    }

    const sanitizedReason = input.reason.trim();
    if (sanitizedReason.length < 5) {
      throw new LeaveServiceError(
        "Leave reason must be at least 5 characters.",
        HTTP_STATUS.BAD_REQUEST,
        "REASON_TOO_SHORT"
      );
    }
    if (sanitizedReason.length > 1000) {
      throw new LeaveServiceError(
        "Leave reason must not exceed 1000 characters.",
        HTTP_STATUS.BAD_REQUEST,
        "REASON_TOO_LONG"
      );
    }

    // UPGRADE 8: Check for overlapping PENDING or APPROVED leave requests for this ASHA
    const existingRequests = await this.leaveRepo.listLeaveRequestsByAsha(ashaProfile.uid);
    const activeExisting = existingRequests.filter(
      (r) => r.status === "PENDING" || r.status === "APPROVED"
    );

    for (const ex of activeExisting) {
      const exStart = new Date(`${ex.startDate}T00:00:00.000+05:30`).getTime();
      const exEnd = new Date(ex.effectiveUntil).getTime();

      // Overlap condition: start <= exEnd && end >= exStart
      if (startTimestamp <= exEnd && endTimestamp >= exStart) {
        throw new LeaveServiceError(
          `You already have an active or pending leave request (${ex.status}) for ${ex.startDate} to ${ex.endDate} that overlaps with the requested period.`,
          HTTP_STATUS.CONFLICT,
          "OVERLAPPING_LEAVE_REQUEST"
        );
      }
    }

    // Query backend for current assigned household count (informational snapshot)
    const assignedCases = await this.caseRepo.listCasesByAsha(ashaProfile.uid);
    const affectedCount = assignedCases.length;
    const now = new Date().toISOString();
    const effectiveUntil = this.normalizeEffectiveUntil(endDate);

    const leaveRequestId = `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRequest: AshaLeaveRequest = {
      id: leaveRequestId,
      ashaId: ashaProfile.uid,
      ashaName: ashaProfile.displayName || "ASHA Worker",
      ashaServiceCode: ashaProfile.ashaServiceCode || "ASHA-FIELD",
      startDate,
      endDate,
      effectiveUntil,
      reason: sanitizedReason,
      status: "PENDING",
      affectedHouseholdCount: affectedCount,
      replacementAshaId: null,
      replacementAshaName: null,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      reviewNotes: null,
      restorationStatus: null,
      restorationNotes: null,
      restoredAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.leaveRepo.createLeaveRequest(newRequest);

    // Audit log
    await this.leaveRepo.createAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: "LEAVE_REQUEST_CREATED",
      leaveRequestId: saved.id,
      actorUid: ashaProfile.uid,
      actorRole: ashaProfile.role,
      actorName: ashaProfile.displayName || "ASHA Worker",
      timestamp: now,
      details: {
        originalAshaUid: ashaProfile.uid,
        affectedCount,
        reason: sanitizedReason,
      },
    });

    return saved;
  }

  /**
   * Retrieves a single leave request by ID.
   * Enforces IDOR protection: ASHA can only view own; Admin can view any.
   */
  public async getLeaveRequestById(
    leaveRequestId: string,
    userProfile: UserProfile
  ): Promise<AshaLeaveRequest> {
    const req = await this.leaveRepo.getLeaveRequestById(leaveRequestId);
    if (!req) {
      throw new LeaveServiceError("Leave request not found.", HTTP_STATUS.NOT_FOUND, "LEAVE_NOT_FOUND");
    }

    if (userProfile.role !== "ADMIN" && req.ashaId !== userProfile.uid) {
      throw new LeaveServiceError(
        "You do not have permission to view this leave request.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ACCESS"
      );
    }

    return req;
  }

  /**
   * Lists leave requests for the authenticated ASHA worker.
   */
  public async listMyLeaveRequests(ashaProfile: UserProfile): Promise<AshaLeaveRequest[]> {
    if (ashaProfile.role !== "ASHA") {
      throw new LeaveServiceError("Only ASHA workers can access their leave records.", HTTP_STATUS.FORBIDDEN, "FORBIDDEN_ROLE");
    }
    // Lazy restore check first
    await this.evaluateAndRestoreExpiredLeaves();
    return this.leaveRepo.listLeaveRequestsByAsha(ashaProfile.uid);
  }

  /**
   * Lists all leave requests for administrators.
   */
  public async listAllLeaveRequestsForAdmin(
    adminProfile: UserProfile,
    statusFilter?: any
  ): Promise<AshaLeaveRequest[]> {
    if (adminProfile.role !== "ADMIN") {
      throw new LeaveServiceError("Only Administrators can view all leave requests.", HTTP_STATUS.FORBIDDEN, "FORBIDDEN_ROLE");
    }
    // Lazy restore check first
    await this.evaluateAndRestoreExpiredLeaves();
    return this.leaveRepo.listAllLeaveRequests(statusFilter);
  }

  /**
   * ASHA cancels their own PENDING leave request.
   */
  public async cancelLeaveRequest(
    leaveRequestId: string,
    ashaProfile: UserProfile
  ): Promise<AshaLeaveRequest> {
    if (ashaProfile.role !== "ASHA") {
      throw new LeaveServiceError("Only ASHA workers can cancel their leave requests.", HTTP_STATUS.FORBIDDEN, "FORBIDDEN_ROLE");
    }

    const req = await this.leaveRepo.getLeaveRequestById(leaveRequestId);
    if (!req || req.ashaId !== ashaProfile.uid) {
      throw new LeaveServiceError("Leave request not found.", HTTP_STATUS.NOT_FOUND, "LEAVE_NOT_FOUND");
    }

    if (req.status !== "PENDING") {
      throw new LeaveServiceError(
        `Cannot cancel leave request with status '${req.status}'. Only PENDING requests can be cancelled.`,
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const now = new Date().toISOString();
    const updated = await this.leaveRepo.updateLeaveRequest(leaveRequestId, {
      status: "CANCELLED",
      updatedAt: now,
    });

    await this.leaveRepo.createAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: "LEAVE_REQUEST_CANCELLED",
      leaveRequestId,
      actorUid: ashaProfile.uid,
      actorRole: ashaProfile.role,
      actorName: ashaProfile.displayName || "ASHA Worker",
      timestamp: now,
      details: { originalAshaUid: ashaProfile.uid },
    });

    return updated!;
  }

  /**
   * PHASE 5: Admin approves leave request and executes bulk temporary reassignment.
   * Incorporates UPGRADES 1, 2, 3, 4, 9, 10, 15, 16, 17, 18, 19.
   */
  public async approveLeaveRequest(
    leaveRequestId: string,
    adminProfile: UserProfile,
    input: ApproveLeaveRequestInput
  ): Promise<ApproveLeaveResponse> {
    // 1. Verify Admin RBAC
    if (adminProfile.role !== "ADMIN") {
      throw new LeaveServiceError(
        "Only Administrators can approve leave requests and reassign households.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    // 2. Load Leave Request & Verify Status is PENDING (UPGRADE 4: Idempotent Approval)
    const leaveReq = await this.leaveRepo.getLeaveRequestById(leaveRequestId);
    if (!leaveReq) {
      throw new LeaveServiceError("Leave request not found.", HTTP_STATUS.NOT_FOUND, "LEAVE_NOT_FOUND");
    }

    if (leaveReq.status !== "PENDING") {
      throw new LeaveServiceError(
        `Cannot approve leave request with status '${leaveReq.status}'. Only PENDING requests can be approved.`,
        HTTP_STATUS.BAD_REQUEST,
        "LEAVE_NOT_PENDING"
      );
    }

    // 3. UPGRADE 9: Validate Replacement ASHA
    const replacementInput = input.replacementAshaId.trim();
    if (!replacementInput) {
      throw new LeaveServiceError("A replacement ASHA worker must be selected.", HTTP_STATUS.BAD_REQUEST, "REPLACEMENT_REQUIRED");
    }

    // Resolve user by UID first; if not found, resolve by ASHA service code
    let replacementUser = await this.userRepo.getUserById(replacementInput);
    if (!replacementUser) {
      replacementUser = await this.userRepo.getUserByServiceCode(replacementInput);
    }

    if (!replacementUser) {
      throw new LeaveServiceError(
        `Replacement ASHA '${replacementInput}' does not exist. Please check the code or select an available worker.`,
        HTTP_STATUS.NOT_FOUND,
        "REPLACEMENT_NOT_FOUND"
      );
    }

    if (replacementUser.isActive === false) {
      throw new LeaveServiceError(
        `Replacement ASHA '${replacementUser.displayName || replacementInput}' is inactive and cannot accept temporary assignments.`,
        HTTP_STATUS.BAD_REQUEST,
        "REPLACEMENT_INACTIVE"
      );
    }

    const finalReplacementUid = replacementUser.uid;
    const finalReplacementName =
      replacementUser.displayName || replacementUser.ashaServiceCode || "Replacement ASHA";

    if (finalReplacementUid === leaveReq.ashaId) {
      throw new LeaveServiceError(
        "Replacement ASHA cannot be the same worker who is requesting leave.",
        HTTP_STATUS.BAD_REQUEST,
        "REPLACEMENT_CANNOT_BE_SELF"
      );
    }

    if (replacementUser.role !== "ASHA") {
      throw new LeaveServiceError(
        `Selected user '${replacementInput}' has role '${replacementUser.role}'. Cases can only be reassigned to users with the ASHA role.`,
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_REPLACEMENT_ROLE"
      );
    }

    // Check if replacement ASHA is currently on an active approved leave during this period (STALE AVAILABILITY PROTECTION)
    const replacementLeaves = await this.leaveRepo.listLeaveRequestsByAsha(finalReplacementUid);
    const leaveStartMs = new Date(`${leaveReq.startDate}T00:00:00.000+05:30`).getTime();
    const leaveEndMs = new Date(leaveReq.effectiveUntil).getTime();

    for (const rLeave of replacementLeaves) {
      if (rLeave.status === "APPROVED") {
        const rStartMs = new Date(`${rLeave.startDate}T00:00:00.000+05:30`).getTime();
        const rEndMs = new Date(rLeave.effectiveUntil).getTime();
        if (leaveStartMs <= rEndMs && leaveEndMs >= rStartMs) {
          throw new LeaveServiceError(
            `Replacement ASHA '${finalReplacementName}' is already on approved leave from ${rLeave.startDate} to ${rLeave.endDate}. Please select another active ASHA.`,
            HTTP_STATUS.BAD_REQUEST,
            "REPLACEMENT_ON_LEAVE"
          );
        }
      }
    }

    // 4. UPGRADE 2 & 18: Re-fetch current assigned cases from backend (Do NOT trust frontend counts/lists)
    const currentAssignedCases = await this.caseRepo.listCasesByAsha(leaveReq.ashaId);
    const affectedCount = currentAssignedCases.length;

    const now = new Date().toISOString();
    let reassignedCount = 0;
    let skippedCount = 0;
    const skippedCaseIds: string[] = [];

    // 5. UPGRADE 3, 10, 15, 16: Safe atomic reassignment with concurrency protection
    for (const c of currentAssignedCases) {
      // Concurrency check: Re-fetch latest case document to verify it is STILL assigned to original ASHA
      const freshCase = await this.caseRepo.getCaseById(c.id);
      if (!freshCase || freshCase.assignedAshaUid !== leaveReq.ashaId) {
        // Concurrency conflict: Another admin reassigned it in the interim
        skippedCount++;
        skippedCaseIds.push(c.id);
        continue;
      }

      // UPGRADE 1 & 10: Update CURRENT assignment (cases.assignedAshaUid) and stamp temporary metadata
      // All case tasks, notes, follow-ups, assistance requests, and activities remain completely intact!
      await this.caseRepo.updateCase(freshCase.id, {
        assignedAshaUid: finalReplacementUid,
        temporaryAssignment: {
          originalAshaUid: leaveReq.ashaId,
          temporaryAshaUid: finalReplacementUid,
          leaveRequestId: leaveReq.id,
          effectiveFrom: leaveReq.startDate,
          effectiveUntil: leaveReq.effectiveUntil,
          reason: leaveReq.reason,
          assignedAt: now,
          assignedByUid: adminProfile.uid,
          status: "ACTIVE",
        },
      });

      // Create detailed temporary assignment history record
      await this.leaveRepo.createTemporaryAssignment({
        id: `tasgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        leaveRequestId: leaveReq.id,
        caseId: freshCase.id,
        householdId: freshCase.householdId,
        originalAshaUid: leaveReq.ashaId,
        temporaryAshaUid: finalReplacementUid,
        effectiveFrom: leaveReq.startDate,
        effectiveUntil: leaveReq.effectiveUntil,
        reason: leaveReq.reason,
        status: "ACTIVE",
        createdAt: now,
        createdBy: adminProfile.uid,
      });

      // Append immutable case activity
      await this.caseRepo.createActivity(freshCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: freshCase.id,
        actorUid: adminProfile.uid,
        actorRole: "ADMIN",
        actorName: adminProfile.displayName || "Administrator",
        type: "CASE_TEMPORARILY_REASSIGNED",
        description: `Household temporarily reassigned from ASHA ${leaveReq.ashaName} to replacement ASHA ${finalReplacementName} due to approved leave.`,
        metadata: {
          leaveRequestId: leaveReq.id,
          originalAshaUid: leaveReq.ashaId,
          replacementAshaUid: finalReplacementUid,
          effectiveUntil: leaveReq.effectiveUntil,
        },
        timestamp: now,
      });

      reassignedCount++;
    }

    // 6. Update Leave Request to APPROVED
    const requiresReview = skippedCount > 0;
    const updatedLeave = await this.leaveRepo.updateLeaveRequest(leaveReq.id, {
      status: "APPROVED",
      replacementAshaId: finalReplacementUid,
      replacementAshaName: finalReplacementName,
      reviewedBy: adminProfile.uid,
      reviewedByName: adminProfile.displayName || "Administrator",
      reviewedAt: now,
      reviewNotes: input.notes?.trim() || null,
      restorationStatus: "PENDING",
      restorationNotes: requiresReview
        ? `${reassignedCount} households reassigned; ${skippedCount} skipped due to concurrent assignment change.`
        : null,
      updatedAt: now,
    });

    // 7. UPGRADE 17: Audit logs reflecting exact counts
    await this.leaveRepo.createAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: "LEAVE_REQUEST_APPROVED",
      leaveRequestId: leaveReq.id,
      actorUid: adminProfile.uid,
      actorRole: "ADMIN",
      actorName: adminProfile.displayName || "Administrator",
      timestamp: now,
      details: {
        originalAshaUid: leaveReq.ashaId,
        replacementAshaUid: finalReplacementUid,
        affectedCount,
        reassignedCount,
        skippedCount,
        notes: input.notes,
      },
    });

    if (reassignedCount > 0) {
      await this.leaveRepo.createAuditLog({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        action: "HOUSEHOLDS_TEMPORARILY_REASSIGNED",
        leaveRequestId: leaveReq.id,
        actorUid: adminProfile.uid,
        actorRole: "ADMIN",
        actorName: adminProfile.displayName || "Administrator",
        timestamp: now,
        details: {
          originalAshaUid: leaveReq.ashaId,
          replacementAshaUid: finalReplacementUid,
          reassignedCount,
          skippedCount,
        },
      });
    }

    // UPGRADE 19: Return clean, demo-friendly response
    return {
      leaveRequest: updatedLeave!,
      affectedCount,
      reassignedCount,
      skippedCount,
      requiresReview,
      skippedCaseIds: skippedCount > 0 ? skippedCaseIds : undefined,
    };
  }

  /**
   * Admin rejects leave request.
   */
  public async rejectLeaveRequest(
    leaveRequestId: string,
    adminProfile: UserProfile,
    input: RejectLeaveRequestInput
  ): Promise<AshaLeaveRequest> {
    if (adminProfile.role !== "ADMIN") {
      throw new LeaveServiceError("Only Administrators can reject leave requests.", HTTP_STATUS.FORBIDDEN, "FORBIDDEN_ROLE");
    }

    const leaveReq = await this.leaveRepo.getLeaveRequestById(leaveRequestId);
    if (!leaveReq) {
      throw new LeaveServiceError("Leave request not found.", HTTP_STATUS.NOT_FOUND, "LEAVE_NOT_FOUND");
    }

    if (leaveReq.status !== "PENDING") {
      throw new LeaveServiceError(
        `Cannot reject leave request with status '${leaveReq.status}'. Only PENDING requests can be rejected.`,
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const sanitizedReason = input.reason.trim();
    const now = new Date().toISOString();

    const updated = await this.leaveRepo.updateLeaveRequest(leaveReq.id, {
      status: "REJECTED",
      reviewedBy: adminProfile.uid,
      reviewedByName: adminProfile.displayName || "Administrator",
      reviewedAt: now,
      reviewNotes: sanitizedReason,
      updatedAt: now,
    });

    await this.leaveRepo.createAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: "LEAVE_REQUEST_REJECTED",
      leaveRequestId: leaveReq.id,
      actorUid: adminProfile.uid,
      actorRole: "ADMIN",
      actorName: adminProfile.displayName || "Administrator",
      timestamp: now,
      details: {
        originalAshaUid: leaveReq.ashaId,
        reason: sanitizedReason,
      },
    });

    return updated!;
  }

  /**
   * PHASES 7 & 8: Centralized Safe Lazy Restoration Engine.
   * Incorporates UPGRADES 5, 6, 7, 11, 12, 13, 14.
   *
   * Idempotently detects expired temporary assignments and restores them to the original ASHA
   * IF AND ONLY IF all safety rules pass:
   * 1. Leave request is APPROVED
   * 2. Effective until timestamp has passed (effectiveUntil < now)
   * 3. Original ASHA worker is still active with role ASHA
   * 4. Case is still assigned to the replacement ASHA
   * 5. Case temporaryAssignment belongs to this exact leaveRequestId
   * 6. Temporary assignment status is ACTIVE (not SUPERSEDED_BY_MANUAL)
   */
  public async evaluateAndRestoreExpiredLeaves(): Promise<RestoreCheckResponse> {
    const activeLeaves = await this.leaveRepo.listActiveApprovedRequests();
    const now = new Date();
    const nowIso = now.toISOString();

    let evaluatedLeavesCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    let completedLeavesCount = 0;
    let reviewRequiredLeavesCount = 0;

    for (const leave of activeLeaves) {
      const expiryDate = new Date(leave.effectiveUntil);
      if (now.getTime() < expiryDate.getTime()) {
        // Not yet expired
        continue;
      }

      evaluatedLeavesCount++;

      // UPGRADE 7: Validate original ASHA is still active
      const originalUser = await this.userRepo.getUserById(leave.ashaId);
      const isOriginalAshaActive = !!originalUser && originalUser.role === "ASHA";

      // Load temporary assignment records for this leave
      const assignments = await this.leaveRepo.getTemporaryAssignmentsByLeaveId(leave.id);
      let leaveHasConflictOrSkip = false;
      let anyCaseRestored = false;

      if (!isOriginalAshaActive) {
        // Original ASHA is no longer active! DO NOT restore.
        leaveHasConflictOrSkip = true;
        reviewRequiredLeavesCount++;

        await this.leaveRepo.updateLeaveRequest(leave.id, {
          status: "COMPLETED",
          restorationStatus: "REQUIRES_REVIEW",
          restorationNotes: `Automatic restoration skipped: Original ASHA '${leave.ashaId}' is no longer active or assigned the ASHA role. Active assignments retained under replacement ASHA.`,
          updatedAt: nowIso,
        });

        await this.leaveRepo.createAuditLog({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          action: "RESTORATION_SKIPPED",
          leaveRequestId: leave.id,
          actorUid: "system",
          actorRole: "SYSTEM",
          actorName: "System Lazy Restoration",
          timestamp: nowIso,
          details: {
            originalAshaUid: leave.ashaId,
            reason: "ORIGINAL_ASHA_INACTIVE",
          },
        });

        continue;
      }

      // Check each case assigned under this leave
      for (const asgn of assignments) {
        if (asgn.status !== "ACTIVE") {
          continue; // Already processed
        }

        const c = await this.caseRepo.getCaseById(asgn.caseId);
        if (!c) {
          skippedCount++;
          leaveHasConflictOrSkip = true;
          await this.leaveRepo.updateTemporaryAssignment(asgn.id, {
            status: "OVERRIDDEN",
            overrideReason: "CASE_NOT_FOUND",
          });
          continue;
        }

        // UPGRADE 5, 6, 11, 12: Rigorous safety checks
        const matchesReplacement = c.assignedAshaUid === asgn.temporaryAshaUid;
        const matchesLeaveRequest = c.temporaryAssignment?.leaveRequestId === leave.id;
        const isActiveTemporary = c.temporaryAssignment?.status === "ACTIVE";

        if (!matchesReplacement || !matchesLeaveRequest || !isActiveTemporary) {
          // Case was manually modified by admin or overridden! DO NOT overwrite.
          skippedCount++;
          leaveHasConflictOrSkip = true;

          await this.leaveRepo.updateTemporaryAssignment(asgn.id, {
            status: "OVERRIDDEN",
            overrideReason: !isActiveTemporary
              ? "SUPERSEDED_BY_MANUAL_ASSIGNMENT"
              : "ASSIGNED_ASHA_CHANGED",
          });

          await this.caseRepo.createActivity(c.id, {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            caseId: c.id,
            actorUid: "system",
            actorRole: "ADMIN",
            actorName: "System Lazy Restoration",
            type: "CASE_RESTORATION_SKIPPED",
            description: `Automatic restoration back to ASHA ${leave.ashaName} was safely skipped: assignment was manually altered or overridden during the leave period.`,
            metadata: {
              leaveRequestId: leave.id,
              currentAssignedAsha: c.assignedAshaUid,
              originalAshaUid: leave.ashaId,
              reason: !isActiveTemporary ? "SUPERSEDED_BY_MANUAL" : "ASSIGNED_ASHA_MISMATCH",
            },
            timestamp: nowIso,
          });

          continue;
        }

        // All checks passed: execute safe restoration back to original ASHA!
        const prevAsgn = c.temporaryAssignment!;
        await this.caseRepo.updateCase(c.id, {
          assignedAshaUid: leave.ashaId,
          temporaryAssignment: {
            ...prevAsgn,
            status: "COMPLETED",
          },
        });

        await this.leaveRepo.updateTemporaryAssignment(asgn.id, {
          status: "RESTORED",
          restoredAt: nowIso,
          restoredBy: "system",
        });

        await this.caseRepo.createActivity(c.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          caseId: c.id,
          actorUid: "system",
          actorRole: "ADMIN",
          actorName: "System Lazy Restoration",
          type: "CASE_ASSIGNMENT_RESTORED",
          description: `Leave period ended. Household assignment successfully restored to original ASHA ${leave.ashaName}.`,
          metadata: {
            leaveRequestId: leave.id,
            originalAshaUid: leave.ashaId,
            temporaryAshaUid: asgn.temporaryAshaUid,
          },
          timestamp: nowIso,
        });

        restoredCount++;
        anyCaseRestored = true;
      }

      // Finalize leave request status
      if (leaveHasConflictOrSkip) {
        reviewRequiredLeavesCount++;
        await this.leaveRepo.updateLeaveRequest(leave.id, {
          status: "COMPLETED",
          restorationStatus: "REQUIRES_REVIEW",
          restorationNotes: `Restoration completed with manual overrides or skipped cases (${skippedCount} skipped).`,
          restoredAt: nowIso,
          updatedAt: nowIso,
        });
      } else {
        completedLeavesCount++;
        await this.leaveRepo.updateLeaveRequest(leave.id, {
          status: "COMPLETED",
          restorationStatus: "RESTORED",
          restorationNotes: `All ${assignments.length} temporary assignments automatically restored to original ASHA.`,
          restoredAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (anyCaseRestored) {
        await this.leaveRepo.createAuditLog({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          action: "HOUSEHOLDS_AUTOMATICALLY_RESTORED",
          leaveRequestId: leave.id,
          actorUid: "system",
          actorRole: "SYSTEM",
          actorName: "System Lazy Restoration",
          timestamp: nowIso,
          details: {
            originalAshaUid: leave.ashaId,
            replacementAshaUid: leave.replacementAshaId || undefined,
            restoredCount,
            skippedCount,
          },
        });
      }
    }

    return {
      evaluatedLeavesCount,
      restoredCount,
      skippedCount,
      completedLeavesCount,
      reviewRequiredLeavesCount,
    };
  }

  /**
   * Helper for admin to list active eligible ASHA workers
   * Excludes inactive users, users with invalid roles, the requesting ASHA,
   * or workers currently on approved leave during the period.
   * Returns authoritative list and available worker count.
   */
  public async listEligibleReplacementAshas(
    adminProfile: UserProfile,
    excludeAshaId?: string,
    leaveRequestId?: string
  ): Promise<{
    ashas: Array<{
      uid: string;
      displayName: string;
      ashaServiceCode: string;
      serviceArea: string;
      activeCaseCount: number;
    }>;
    count: number;
  }> {
    if (adminProfile.role !== "ADMIN") {
      throw new LeaveServiceError(
        "Only Administrators can query available ASHA workers.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    let targetLeave: AshaLeaveRequest | null = null;
    if (leaveRequestId) {
      targetLeave = await this.leaveRepo.getLeaveRequestById(leaveRequestId);
    }

    const ashas = await this.userRepo.listAshaUsers();
    const results = [];
    const effectiveExcludeId = excludeAshaId || targetLeave?.ashaId;

    for (const a of ashas) {
      // 1. Exclude the leave-requesting ASHA (by UID or service code)
      if (
        effectiveExcludeId &&
        (a.uid === effectiveExcludeId ||
          (a.ashaServiceCode && a.ashaServiceCode.toUpperCase() === effectiveExcludeId.toUpperCase()))
      ) {
        continue;
      }

      // 2. Must have ASHA role
      if (a.role !== "ASHA") continue;

      // 3. Must be active
      if (a.isActive === false) continue;

      // 4. Stale availability / Approved leave check
      const leaves = await this.leaveRepo.listLeaveRequestsByAsha(a.uid);
      if (targetLeave) {
        const leaveStartMs = new Date(`${targetLeave.startDate}T00:00:00.000+05:30`).getTime();
        const leaveEndMs = new Date(targetLeave.effectiveUntil).getTime();
        const hasApprovedOverlap = leaves.some((l) => {
          if (l.status !== "APPROVED") return false;
          const rStartMs = new Date(`${l.startDate}T00:00:00.000+05:30`).getTime();
          const rEndMs = new Date(l.effectiveUntil).getTime();
          return leaveStartMs <= rEndMs && leaveEndMs >= rStartMs;
        });
        if (hasApprovedOverlap) continue;
      } else {
        const nowMs = Date.now();
        const currentlyOnLeave = leaves.some((l) => {
          if (l.status !== "APPROVED") return false;
          const rStartMs = new Date(`${l.startDate}T00:00:00.000+05:30`).getTime();
          const rEndMs = new Date(l.effectiveUntil).getTime();
          return nowMs >= rStartMs && nowMs <= rEndMs;
        });
        if (currentlyOnLeave) continue;
      }

      const cases = await this.caseRepo.listCasesByAsha(a.uid);
      results.push({
        uid: a.uid,
        displayName: a.displayName || "ASHA Worker",
        ashaServiceCode: a.ashaServiceCode || "ASHA-FIELD",
        serviceArea: a.serviceArea || "Field Jurisdiction",
        activeCaseCount: cases.length,
      });
    }

    return {
      ashas: results,
      count: results.length,
    };
  }
}
