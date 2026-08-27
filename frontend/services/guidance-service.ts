import { apiClient } from "./api-client";
import { GuidanceResponse } from "@shared/types/guidance";
import { ApiResult } from "@shared/types/api";

export const guidanceService = {
  /**
   * Retrieves comprehensive healthcare access guidance, detected gaps,
   * document readiness, and prioritized action plan for the authenticated citizen.
   */
  async getMyGuidance(): Promise<ApiResult<GuidanceResponse>> {
    return apiClient.get<GuidanceResponse>("/api/v1/guidance/me");
  },
};
