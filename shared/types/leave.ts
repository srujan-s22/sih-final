export type LeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type RestorationStatus =
  | "PENDING"
  | "RESTORED"
  | "REQUIRES_REVIEW"
  | "NOT_APPLICABLE";

export type TemporaryAssignmentStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "SUPERSEDED_BY_MANUAL";

/**
 * Authoritative ASHA Leave Request Record
 * Stored in Firestore /asha_leave_requests/{leaveRequestId}
 */
export interface AshaLeaveRequest {
  id: string;
  ashaId: string;
  ashaName: string;
  ashaServiceCode: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  effectiveUntil: string; // Normalized ISO 8601 end boundary (23:59:59.999 IST)
  reason: string;
  status: LeaveRequestStatus;
  affectedHouseholdCount: number; // Informational / snapshot count at submission
  replacementAshaId: string | null;
  replacementAshaName: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  restorationStatus: RestorationStatus | null;
  restorationNotes: string | null;
  restoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Historical record of an individual household case reassigned due to leave.
 * Stored in /asha_temporary_assignments/{recordId}
 */
export interface AshaTemporaryAssignmentRecord {
  id: string;
  leaveRequestId: string;
  caseId: string;
  householdId: string;
  originalAshaUid: string;
  temporaryAshaUid: string;
  effectiveFrom: string;
  effectiveUntil: string;
  reason: string;
  status: "ACTIVE" | "RESTORED" | "OVERRIDDEN";
  createdAt: string;
  createdBy: string;
  restoredAt?: string | null;
  restoredBy?: string | null;
  overrideReason?: string | null;
}

/**
 * Audit event actions for leave lifecycle
 */
export type LeaveAuditAction =
  | "LEAVE_REQUEST_CREATED"
  | "LEAVE_REQUEST_APPROVED"
  | "LEAVE_REQUEST_REJECTED"
  | "LEAVE_REQUEST_CANCELLED"
  | "HOUSEHOLDS_TEMPORARILY_REASSIGNED"
  | "HOUSEHOLDS_AUTOMATICALLY_RESTORED"
  | "RESTORATION_SKIPPED";

/**
 * Dedicated audit log entry for leave actions
 * Stored in /asha_leave_audit_logs/{logId}
 */
export interface LeaveAuditLog {
  id: string;
  action: LeaveAuditAction;
  leaveRequestId: string;
  actorUid: string;
  actorRole: string;
  actorName: string;
  timestamp: string;
  details: {
    originalAshaUid?: string;
    replacementAshaUid?: string;
    affectedCount?: number;
    reassignedCount?: number;
    skippedCount?: number;
    caseId?: string;
    householdId?: string;
    reason?: string;
    notes?: string;
    [key: string]: unknown;
  };
}

/**
 * Input DTOs
 */
export interface CreateLeaveRequestInput {
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ApproveLeaveRequestInput {
  replacementAshaId: string;
  notes?: string;
}

export interface RejectLeaveRequestInput {
  reason: string;
}

/**
 * Response DTOs
 */
export interface ApproveLeaveResponse {
  leaveRequest: AshaLeaveRequest;
  affectedCount: number;
  reassignedCount: number;
  skippedCount: number;
  requiresReview: boolean;
  skippedCaseIds?: string[];
}

export interface RestoreCheckResponse {
  evaluatedLeavesCount: number;
  restoredCount: number;
  skippedCount: number;
  completedLeavesCount: number;
  reviewRequiredLeavesCount: number;
}
