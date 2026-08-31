import { apiClient } from "./api-client";
import {
  VoiceSession,
  VoiceTurnResponse,
  VoiceHealthResponse,
  VoicePublicConfig,
  CitizenCallRequest,
  AshaCallRequest,
  CallHistoryItem,
} from "@shared/types/voice";
import {
  VoiceTurnInput,
  VerifyCallerIdentityInput,
  InitiateOutboundCallInput,
} from "@shared/schemas/voice.schema";
import { ApiResult } from "@shared/types/api";

export class VoiceServiceClient {
  /**
   * Get public configuration (dynamic virtual number, supported languages)
   */
  public async getVoiceConfig(): Promise<ApiResult<VoicePublicConfig>> {
    return apiClient.get<VoicePublicConfig>("/api/v1/voice/config");
  }

  /**
   * Citizen requests an outbound call from SwasthyaSetu Healthcare Assistant
   */
  public async requestCitizenCall(
    input: CitizenCallRequest
  ): Promise<ApiResult<{ session: VoiceSession; callResult: any }>> {
    return apiClient.post<{ session: VoiceSession; callResult: any }>(
      "/api/v1/voice/citizen/request-call",
      input
    );
  }

  /**
   * Retrieve recent call history for current authenticated citizen
   */
  public async getCitizenCallHistory(): Promise<ApiResult<CallHistoryItem[]>> {
    return apiClient.get<CallHistoryItem[]>("/api/v1/voice/citizen/calls");
  }

  /**
   * ASHA initiates direct call to assigned beneficiary
   */
  public async ashaCallCitizen(
    input: AshaCallRequest
  ): Promise<ApiResult<{ session: VoiceSession; callResult: any }>> {
    return apiClient.post<{ session: VoiceSession; callResult: any }>(
      "/api/v1/voice/asha/call-citizen",
      input
    );
  }

  /**
   * Retrieve call history for current authenticated ASHA worker
   */
  public async getAshaCallHistory(): Promise<ApiResult<CallHistoryItem[]>> {
    return apiClient.get<CallHistoryItem[]>("/api/v1/voice/asha/calls");
  }

  /**
   * Retrieve call history for a specific case
   */
  public async getCaseCallHistory(caseId: string): Promise<ApiResult<CallHistoryItem[]>> {
    return apiClient.get<CallHistoryItem[]>(`/api/v1/voice/cases/${caseId}/calls`);
  }

  /**
   * Initialize a voice helpline session (development / simulator)
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
