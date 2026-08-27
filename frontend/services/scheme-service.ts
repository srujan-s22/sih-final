import { apiClient } from "./api-client";
import { Scheme, SchemeVersion } from "@shared/types/eligibility";
import { ApiResult } from "@shared/types/api";

export const schemeService = {
  /**
   * Retrieves all active public healthcare schemes
   */
  async getActiveSchemes(): Promise<ApiResult<{ schemes: Scheme[]; count: number }>> {
    return apiClient.get<{ schemes: Scheme[]; count: number }>("/api/v1/schemes");
  },

  /**
   * Retrieves a single scheme with active version details
   */
  async getSchemeDetails(
    schemeId: string
  ): Promise<ApiResult<{ scheme: Scheme; activeVersion: SchemeVersion }>> {
    return apiClient.get<{ scheme: Scheme; activeVersion: SchemeVersion }>(
      `/api/v1/schemes/${schemeId}`
    );
  },
};
