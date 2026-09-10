import { CaseStatus, CasePriority } from "@shared/types/case";

/**
 * Maps CaseStatus enum to localized human-readable string
 */
export function getLocalizedStatus(
  status: CaseStatus,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (status) {
    case "NEW":
      return t("status.new");
    case "OPEN" as any:
      return t("status.open");
    case "ACTIVE":
      return t("status.active");
    case "IN_PROGRESS":
      return t("status.in_progress");
    case "RESOLVED":
      return t("status.resolved");
    case "CLOSED":
      return t("status.closed");
    case "NEEDS_ATTENTION":
      return t("status.needs_attention");
    case "FOLLOW_UP":
      return t("status.follow_up");
    case "FOLLOW_UP_REQUIRED":
      return t("status.follow_up_required");
    case "REQUESTED":
      return t("status.requested");
    case "ACCEPTED":
      return t("status.accepted");
    case "ESCALATED":
      return t("status.escalated");
    case "BLOCKED":
      return t("status.blocked");
    case "CITIZEN_DECLINED":
      return t("status.citizen_declined");
    default:
      return String(status).replace(/_/g, " ");
  }
}

/**
 * Maps CasePriority enum to localized human-readable string
 */
export function getLocalizedPriority(
  priority: CasePriority,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (priority) {
    case "URGENT":
      return t("forms.priorityUrgent");
    case "HIGH":
      return t("forms.priorityHigh");
    case "NORMAL":
    case "MEDIUM" as any:
      return t("forms.priorityNormal");
    case "LOW":
      return t("forms.priorityLow");
    default:
      return String(priority);
  }
}
