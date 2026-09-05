import { apiClient } from "./api-client";
import {
  AshaLeaveRequest,
  CreateLeaveRequestInput,
  ApproveLeaveRequestInput,
  RejectLeaveRequestInput,
  ApproveLeaveResponse,
  RestoreCheckResponse,
  LeaveRequestStatus,
} from "@shared/types/leave";
import { ApiResult } from "@shared/types/api";

export interface AvailableAshaWorker {
  uid: string;
  displayName: string;
  ashaServiceCode: string;
  serviceArea: string;
  activeCaseCount: number;
}

export class LeaveServiceClient {
  /**
   * ASHA submits a new leave request.
   */
  public async submitLeaveRequest(
    input: CreateLeaveRequestInput
  ): Promise<ApiResult<{ leaveRequest: AshaLeaveRequest }>> {
    return apiClient.post<{ leaveRequest: AshaLeaveRequest }>(
      "/api/v1/asha/leave-requests",
      input
    );
  }

  /**
   * ASHA retrieves their own leave requests and status history.
   */
  public async getMyLeaveRequests(): Promise<
    ApiResult<{ leaveRequests: AshaLeaveRequest[] }>
  > {
    return apiClient.get<{ leaveRequests: AshaLeaveRequest[] }>(
      "/api/v1/asha/leave-requests"
    );
  }

  /**
   * Retrieves single leave request by ID.
   */
  public async getLeaveRequestById(
    id: string
  ): Promise<ApiResult<{ leaveRequest: AshaLeaveRequest }>> {
    return apiClient.get<{ leaveRequest: AshaLeaveRequest }>(
      `/api/v1/asha/leave-requests/${encodeURIComponent(id)}`
    );
  }

  /**
   * ASHA cancels their pending leave request.
   */
  public async cancelLeaveRequest(
    id: string
  ): Promise<ApiResult<{ leaveRequest: AshaLeaveRequest }>> {
    return apiClient.post<{ leaveRequest: AshaLeaveRequest }>(
      `/api/v1/asha/leave-requests/${encodeURIComponent(id)}/cancel`,
      {}
    );
  }

  /**
   * Admin lists all platform-wide leave requests.
   */
  public async getAllLeaveRequestsForAdmin(
    status?: LeaveRequestStatus
  ): Promise<ApiResult<{ leaveRequests: AshaLeaveRequest[] }>> {
    const qs = status && status !== ("ALL" as any) ? `?status=${encodeURIComponent(status)}` : "";
    return apiClient.get<{ leaveRequests: AshaLeaveRequest[] }>(
      `/api/v1/admin/leave-requests${qs}`
    );
  }

  /**
   * Admin approves a leave request with selected replacement ASHA worker.
   */
  public async approveLeaveRequest(
    id: string,
    input: ApproveLeaveRequestInput
  ): Promise<ApiResult<ApproveLeaveResponse>> {
    return apiClient.post<ApproveLeaveResponse>(
      `/api/v1/admin/leave-requests/${encodeURIComponent(id)}/approve`,
      input
    );
  }

  /**
   * Admin rejects a leave request with recorded reason.
   */
  public async rejectLeaveRequest(
    id: string,
    input: RejectLeaveRequestInput
  ): Promise<ApiResult<{ leaveRequest: AshaLeaveRequest }>> {
    return apiClient.post<{ leaveRequest: AshaLeaveRequest }>(
      `/api/v1/admin/leave-requests/${encodeURIComponent(id)}/reject`,
      input
    );
  }

  /**
   * Admin triggers explicit restoration check for expired leaves.
   */
  public async triggerRestorationCheck(): Promise<ApiResult<RestoreCheckResponse>> {
    return apiClient.post<RestoreCheckResponse>(
      "/api/v1/admin/leave-requests/restore-check",
      {}
    );
  }

  /**
   * Admin lists active eligible ASHA workers to choose as replacement.
   * Returns available workers array and backend-calculated count.
   */
  public async getEligibleReplacementAshas(
    excludeAshaId?: string,
    leaveRequestId?: string
  ): Promise<ApiResult<{ ashas: AvailableAshaWorker[]; count: number }>> {
    const params = new URLSearchParams();
    if (excludeAshaId) params.set("excludeAshaId", excludeAshaId);
    if (leaveRequestId) params.set("leaveRequestId", leaveRequestId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<{ ashas: AvailableAshaWorker[]; count: number }>(
      `/api/v1/admin/ashas${qs}`
    );
  }
}

export const leaveService = new LeaveServiceClient();
