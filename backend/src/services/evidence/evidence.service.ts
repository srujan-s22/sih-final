import { EvidenceRecord } from "@shared/types/actions.js";

/**
 * Evidence Service Boundary Interface (Phase 6 Foundation - Tavily Integration)
 */
export interface IEvidenceService {
  verifyEvidence(gapId: string, proofType: string): Promise<EvidenceRecord | null>;
}

export class EvidenceService implements IEvidenceService {
  async verifyEvidence(_gapId: string, _proofType: string): Promise<EvidenceRecord | null> {
    // Stub for Phase 6 Tavily evidence verification
    return null;
  }
}
