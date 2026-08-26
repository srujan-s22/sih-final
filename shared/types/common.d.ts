export type StatusType = "verified" | "pending" | "gap" | "action_required" | "inactive";
export interface AuditLogEntry {
    id: string;
    actorId: string;
    actorRole: "citizen" | "asha" | "admin" | "system";
    action: string;
    resource: string;
    correlationId: string;
    timestamp: string;
}
export interface PaginationParams {
    limit?: number;
    offset?: number;
}
