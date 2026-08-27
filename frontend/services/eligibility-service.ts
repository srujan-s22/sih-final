import { apiClient } from "./api-client";
import { EligibilityResult } from "@shared/types/eligibility";
import { Household, Member } from "@shared/types/household";
import { ApiResult } from "@shared/types/api";

export interface CitizenEligibilityResponse {
  hasHousehold: boolean;
  household: Household | null;
  members: Member[];
  results: EligibilityResult[];
  count: number;
}

export const eligibilityService = {
  /**
   * Evaluates the authenticated citizen's household against active schemes
   */
  async evaluateMyHousehold(): Promise<ApiResult<CitizenEligibilityResponse>> {
    return apiClient.get<CitizenEligibilityResponse>("/api/v1/eligibility/me");
  },

  /**
   * Evaluates citizen's household against a specific scheme
   */
  async evaluateMyScheme(
    schemeId: string
  ): Promise<ApiResult<{ result: EligibilityResult }>> {
    return apiClient.get<{ result: EligibilityResult }>(
      `/api/v1/eligibility/me/${schemeId}`
    );
  },
};
