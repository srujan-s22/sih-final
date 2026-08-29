import { apiClient } from "./api-client";
import { ApiResult } from "@shared/types/api";
import {
  AshaAssistanceRequest,
  CreateAssistanceRequestInput,
  UpdateAssistanceRequestInput,
  AssistanceStatus,
} from "@shared/types/assistance";

export class AssistanceService {
  /**
   * Citizen creates an assistance request for their connected ASHA worker.
   */
  public async createAssistanceRequest(
    input: CreateAssistanceRequestInput
  ): Promise<ApiResult<AshaAssistanceRequest>> {
    return apiClient.post<AshaAssistanceRequest>(
      "/api/v1/citizen/assistance/request",
      input
    );
  }

  /**
   * Citizen retrieves their submitted assistance requests.
   */
  public async listMyAssistanceRequests(): Promise<
    ApiResult<{ requests: AshaAssistanceRequest[] }>
  > {
    return apiClient.get<{ requests: AshaAssistanceRequest[] }>(
      "/api/v1/citizen/assistance"
    );
  }

  /**
   * ASHA lists incoming assistance requests from connected households.
   */
  public async listAshaAssistanceRequests(
    status?: AssistanceStatus
  ): Promise<ApiResult<{ requests: AshaAssistanceRequest[] }>> {
    const query = status ? `?status=${status}` : "";
    return apiClient.get<{ requests: AshaAssistanceRequest[] }>(
      `/api/v1/asha/assistance-requests${query}`
    );
  }

  /**
   * ASHA updates status or adds response note to an assistance request.
   */
  public async updateAssistanceRequest(
    requestId: string,
    input: UpdateAssistanceRequestInput
  ): Promise<ApiResult<AshaAssistanceRequest>> {
    return apiClient.patch<AshaAssistanceRequest>(
      `/api/v1/asha/assistance-requests/${requestId}`,
      input
    );
  }
}

export const assistanceService = new AssistanceService();

