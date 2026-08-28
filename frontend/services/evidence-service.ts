import { apiClient } from "./api-client";
import { EvidenceRecord } from "@shared/types/evidence";
import { ApiResult } from "@shared/types/api";

export const evidenceService = {
  /**
   * Retrieves verified government evidence records for an active scheme
   */
  async getSchemeEvidence(
    schemeId: string
  ): Promise<ApiResult<{ schemeId: string; count: number; evidence: EvidenceRecord[] }>> {
    return apiClient.get<{ schemeId: string; count: number; evidence: EvidenceRecord[] }>(
      `/api/v1/evidence/schemes/${schemeId}`
    );
  },

  /**
   * Retrieves pending or conflicting evidence records requiring admin audit
   */
  async getEvidenceConflicts(): Promise<
    ApiResult<{ count: number; unverifiedEvidence: EvidenceRecord[] }>
  > {
    return apiClient.get<{ count: number; unverifiedEvidence: EvidenceRecord[] }>(
      "/api/v1/evidence/conflicts"
    );
  },

  /**
   * Performs an evidence discovery search via Tavily for a scheme claim (Admin only)
   */
  async searchEvidence(
    schemeId: string,
    claim: string
  ): Promise<ApiResult<{ message: string; candidateCount: number; candidates: EvidenceRecord[] }>> {
    return apiClient.post<{ message: string; candidateCount: number; candidates: EvidenceRecord[] }>(
      "/api/v1/evidence/search",
      { schemeId, claim }
    );
  },

  /**
   * Updates verification status of an evidence record (Admin only)
   */
  async verifyEvidence(
    evidenceId: string,
    verified: boolean,
    notes?: string
  ): Promise<ApiResult<{ message: string; evidence: EvidenceRecord }>> {
    return apiClient.post<{ message: string; evidence: EvidenceRecord }>(
      `/api/v1/evidence/${evidenceId}/verify`,
      { verified, notes }
    );
  },
};
