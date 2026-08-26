export interface EvidenceRecord {
  id: string;
  gapId: string;
  proofType: string;
  source: "asha_upload" | "citizen_portal" | "api_verification";
  storageUrl?: string;
  verified: boolean;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  actionId: string;
  notes: string;
  conductedBy: string;
  outcome: string;
  timestamp: string;
}

export interface ActionResolution {
  id: string;
  gapId: string;
  assignedRole: "asha" | "citizen" | "admin";
  actionType: "collect_document" | "ekyc_verification" | "csc_visit" | "scheme_application";
  title: string;
  description: string;
  status: "pending" | "completed" | "cancelled";
  dueDate?: string;
  evidence?: EvidenceRecord[];
  followups?: FollowUp[];
  createdAt: string;
  updatedAt: string;
}
