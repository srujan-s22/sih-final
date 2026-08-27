import { apiClient } from "./api-client";
import {
  AuthMeResponse,
  AuthSyncResponse,
  ConsentSubmission,
  UserProfile,
  ConsentRecord,
} from "@shared/types/auth";
import { ApiResult } from "@shared/types/api";

export const authService = {
  /**
   * Fetches current authenticated user profile and consent state
   */
  async getMe(): Promise<ApiResult<AuthMeResponse>> {
    return apiClient.get<AuthMeResponse>("/api/v1/auth/me");
  },

  /**
   * Idempotently syncs user profile upon sign-in/registration
   */
  async syncUser(metadata?: {
    displayName?: string | null;
    phoneNumber?: string | null;
  }): Promise<ApiResult<AuthSyncResponse>> {
    return apiClient.post<AuthSyncResponse>("/api/v1/auth/sync", metadata || {});
  },

  /**
   * Submits user consent decision
   */
  async submitConsent(
    submission: ConsentSubmission
  ): Promise<
    ApiResult<{
      user: UserProfile;
      consentRecord: ConsentRecord;
      isConsentRequired: boolean;
    }>
  > {
    return apiClient.post("/api/v1/auth/consent", submission);
  },
};
