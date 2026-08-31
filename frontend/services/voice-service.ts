import { apiClient } from "./api-client";
import {
  VoiceSession,
  VoiceTurnResponse,
  VoiceHealthResponse,
} from "@shared/types/voice";
import {
  VoiceTurnInput,
  VerifyCallerIdentityInput,
  InitiateOutboundCallInput,
} from "@shared/schemas/voice.schema";
import { ApiResult } from "@shared/types/api";

export class VoiceServiceClient {
  /**
   * Initialize a voice helpline session
   */
  public async createSession(
    callerPhone?: string,
    language: string = "hi-IN"
  ): Promise<ApiResult<VoiceSession>> {
    return apiClient.post<VoiceSession>("/api/v1/voice/sessions", {
      callerPhone,
      language,
    });
  }

  /**
   * Retrieve voice session metadata
   */
  public async getSession(sessionId: string): Promise<ApiResult<VoiceSession>> {
    return apiClient.get<VoiceSession>(`/api/v1/voice/sessions/${sessionId}`);
  }

  /**
   * Process a conversational turn
   */
  public async processTurn(
    sessionId: string,
    input: VoiceTurnInput
  ): Promise<ApiResult<VoiceTurnResponse>> {
    return apiClient.post<VoiceTurnResponse>(
      `/api/v1/voice/sessions/${sessionId}/turn`,
      input
    );
  }

  /**
   * Verify caller identity challenge
   */
  public async verifyIdentity(
    sessionId: string,
    input: VerifyCallerIdentityInput
  ): Promise<ApiResult<VoiceTurnResponse>> {
    return apiClient.post<VoiceTurnResponse>(
      `/api/v1/voice/sessions/${sessionId}/verify`,
      input
    );
  }

  /**
   * Trigger server-authorized outbound follow-up reminder call
   */
  public async initiateOutboundCall(
    input: InitiateOutboundCallInput
  ): Promise<ApiResult<{ session: VoiceSession; callResult: any }>> {
    return apiClient.post<{ session: VoiceSession; callResult: any }>(
      "/api/v1/voice/outbound",
      input
    );
  }

  /**
   * Get admin voice telemetry & telephony health
   */
  public async getVoiceTelemetry(): Promise<ApiResult<VoiceHealthResponse>> {
    return apiClient.get<VoiceHealthResponse>("/api/v1/admin/voice/telemetry");
  }
}

export const voiceService = new VoiceServiceClient();
