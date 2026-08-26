export type GapSeverity = "high" | "medium" | "low";
export type GapStatus = "detected" | "in_progress" | "resolved";
export interface HealthcareGap {
    id: string;
    householdId: string;
    memberId?: string;
    gapType: "uninsured_member" | "missing_document" | "unregistered_benefit" | "renewal_due";
    title: string;
    description: string;
    severity: GapSeverity;
    status: GapStatus;
    detectedAt: string;
    resolvedAt?: string;
}
