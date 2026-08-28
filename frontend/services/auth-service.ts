import { apiClient } from "./api-client";
import {
  AuthMeResponse,
  AuthSyncResponse,
  ConsentSubmission,
  UserProfile,
  UserRole,
  ConsentRecord,
} from "@shared/types/auth";
import { ApiResult } from "@shared/types/api";

export const authService = {
  /**
   * Pre-validates privileged registration authorization BEFORE creating Firebase Auth user
   */
  async prevalidateRole(
    requestedRole: UserRole,
    registrationSecret?: string | null
  ): Promise<ApiResult<{ allowed: boolean; role: UserRole }>> {
    return apiClient.post<{ allowed: boolean; role: UserRole }>(
      "/api/v1/auth/prevalidate",
      { requestedRole, registrationSecret }
    );
  },

  /**
   * Fetches current authenticated user profile and consent state
   */
  async getMe(): Promise<ApiResult<AuthMeResponse>> {
    return apiClient.get<AuthMeResponse>("/api/v1/auth/me");
  },

  /**
   * Idempotently syncs user profile upon sign-in
   */
  async syncUser(metadata?: {
    displayName?: string | null;
    phoneNumber?: string | null;
    requestedRole?: UserRole;
    registrationSecret?: string | null;
  }): Promise<ApiResult<AuthSyncResponse>> {
    return apiClient.post<AuthSyncResponse>("/api/v1/auth/sync", metadata || {});
  },

  /**
   * Explicitly registers user with optional privileged role verification
   */
  async registerUser(payload: {
    displayName?: string | null;
    phoneNumber?: string | null;
    requestedRole?: UserRole;
    registrationSecret?: string | null;
  }): Promise<ApiResult<AuthSyncResponse>> {
    return apiClient.post<AuthSyncResponse>("/api/v1/auth/register", payload);
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
