import { apiClient } from "./api-client";
import {
  AshaPublicDirectoryInfo,
  AshaConnectionRequest,
  CitizenConnectionStatusResponse,
} from "@shared/types/connection";
import { ApiResult } from "@shared/types/api";

export class ConnectionServiceClient {
  /**
   * Resolves safe public identity information for an ASHA worker by Service Code.
   */
  public async resolveAshaServiceCode(
    serviceCode: string
  ): Promise<ApiResult<AshaPublicDirectoryInfo>> {
    return apiClient.get<AshaPublicDirectoryInfo>(
      `/api/v1/asha/directory/${encodeURIComponent(serviceCode.trim().toUpperCase())}`
    );
  }

  /**
   * Citizen requests connection for their household.
   */
  public async requestConnection(
    serviceCode: string,
    notes?: string
  ): Promise<ApiResult<AshaConnectionRequest>> {
    return apiClient.post<AshaConnectionRequest>("/api/v1/citizen/asha-connection/request", {
      serviceCode: serviceCode.trim().toUpperCase(),
      notes,
    });
  }

  /**
   * Retrieves current connection status for authenticated Citizen's household.
   */
  public async getCitizenConnectionStatus(): Promise<ApiResult<CitizenConnectionStatusResponse>> {
    return apiClient.get<CitizenConnectionStatusResponse>("/api/v1/citizen/asha-connection");
  }

  /**
   * Lists pending connection requests addressed to the authenticated ASHA worker.
   */
  public async listPendingRequestsForAsha(): Promise<
    ApiResult<{ requests: AshaConnectionRequest[] }>
  > {
    return apiClient.get<{ requests: AshaConnectionRequest[] }>(
      "/api/v1/asha/connection-requests"
    );
  }

  /**
   * ASHA accepts a connection request.
   */
  public async acceptConnectionRequest(
    requestId: string,
    note?: string
  ): Promise<ApiResult<AshaConnectionRequest>> {
    return apiClient.post<AshaConnectionRequest>(
      `/api/v1/asha/connection-requests/${encodeURIComponent(requestId)}/accept`,
      { note }
    );
  }

  /**
   * ASHA rejects a connection request.
   */
  public async rejectConnectionRequest(
    requestId: string,
    note?: string
  ): Promise<ApiResult<AshaConnectionRequest>> {
    return apiClient.post<AshaConnectionRequest>(
      `/api/v1/asha/connection-requests/${encodeURIComponent(requestId)}/reject`,
      { note }
    );
  }
}

export const connectionService = new ConnectionServiceClient();
