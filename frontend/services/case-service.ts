import { apiClient } from "./api-client";
import {
  AshaCase,
  CaseNote,
  CaseFollowUp,
  CaseActivity,
  CaseTask,
  CaseStatus,
  CasePriority,
  CaseDetailResponse,
  CaseSummaryResponse,
  FieldRegistrationInput,
  AshaAttentionSignalsResponse,
  InitiateSchemeAssistanceInput,
  InitiateSchemeAssistanceResponse,
} from "@shared/types/case";
import { Household } from "@shared/types/household";
import {
  UpdateCaseInput,
  CreateCaseTaskInput,
  UpdateCaseTaskInput,
  CreateCaseFollowUpInput,
  UpdateCaseFollowUpInput,
} from "@shared/schemas/case.schema";
import { ApiResult } from "@shared/types/api";

export class CaseServiceClient {
  /**
   * Retrieves proactive attention signals across assigned caseload
   */
  public async getAttentionSignals(): Promise<ApiResult<AshaAttentionSignalsResponse>> {
    return apiClient.get<AshaAttentionSignalsResponse>("/api/v1/asha/intelligence/attention-signals");
  }

  /**
   * Proactively initiates scheme assistance for an eligible household case
   */
  public async initiateScheme(
    caseId: string,
    input: InitiateSchemeAssistanceInput
  ): Promise<ApiResult<InitiateSchemeAssistanceResponse>> {
    return apiClient.post<InitiateSchemeAssistanceResponse>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/initiate-scheme`,
      input
    );
  }
  /**
   * Retrieves all cases assigned to the authenticated ASHA worker
   */
  public async listCases(filter?: {
    status?: CaseStatus;
    priority?: CasePriority;
    search?: string;
  }): Promise<ApiResult<{ cases: AshaCase[] }>> {
    const params = new URLSearchParams();
    if (filter?.status) params.append("status", filter.status);
    if (filter?.priority) params.append("priority", filter.priority);
    if (filter?.search) params.append("search", filter.search);

    const qs = params.toString();
    const endpoint = `/api/v1/asha/cases${qs ? `?${qs}` : ""}`;
    return apiClient.get<{ cases: AshaCase[] }>(endpoint);
  }

  /**
   * Retrieves summary caseload metrics
   */
  public async getSummary(): Promise<ApiResult<CaseSummaryResponse>> {
    return apiClient.get<CaseSummaryResponse>("/api/v1/asha/cases/summary");
  }

  /**
   * Retrieves aggregated case detail (household, deterministic eligibility, gaps, notes, follow-ups, activities)
   */
  public async getCaseDetail(caseId: string): Promise<ApiResult<CaseDetailResponse>> {
    return apiClient.get<CaseDetailResponse>(`/api/v1/asha/cases/${encodeURIComponent(caseId)}`);
  }

  /**
   * Updates case status, priority, or last contact timestamp
   */
  public async updateCase(
    caseId: string,
    updates: UpdateCaseInput
  ): Promise<ApiResult<{ case: AshaCase }>> {
    return apiClient.patch<{ case: AshaCase }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}`,
      updates
    );
  }

  /**
   * Adds a timestamped note to a case
   */
  public async addNote(
    caseId: string,
    content: string
  ): Promise<ApiResult<{ note: CaseNote }>> {
    return apiClient.post<{ note: CaseNote }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/notes`,
      { content }
    );
  }

  /**
   * Lists notes for a case
   */
  public async getNotes(caseId: string): Promise<ApiResult<{ notes: CaseNote[] }>> {
    return apiClient.get<{ notes: CaseNote[] }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/notes`
    );
  }

  /**
   * Schedules a follow-up task
   */
  public async createFollowUp(
    caseId: string,
    input: CreateCaseFollowUpInput
  ): Promise<ApiResult<{ followUp: CaseFollowUp }>> {
    return apiClient.post<{ followUp: CaseFollowUp }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/follow-ups`,
      input
    );
  }

  /**
   * Updates or completes a follow-up task
   */
  public async updateFollowUp(
    caseId: string,
    followUpId: string,
    updates: UpdateCaseFollowUpInput
  ): Promise<ApiResult<{ followUp: CaseFollowUp }>> {
    return apiClient.patch<{ followUp: CaseFollowUp }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/follow-ups/${encodeURIComponent(followUpId)}`,
      updates
    );
  }

  /**
   * Retrieves tasks for an authorized case
   */
  public async getTasks(caseId: string): Promise<ApiResult<{ tasks: CaseTask[] }>> {
    return apiClient.get<{ tasks: CaseTask[] }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/tasks`
    );
  }

  /**
   * Creates a custom task for a case
   */
  public async createTask(
    caseId: string,
    input: CreateCaseTaskInput
  ): Promise<ApiResult<{ task: CaseTask }>> {
    return apiClient.post<{ task: CaseTask }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/tasks`,
      input
    );
  }

  /**
   * Updates an existing task
   */
  public async updateTask(
    caseId: string,
    taskId: string,
    updates: UpdateCaseTaskInput
  ): Promise<ApiResult<{ task: CaseTask }>> {
    return apiClient.patch<{ task: CaseTask }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`,
      updates
    );
  }

  /**
   * Marks a task completed and advances scheme journey
   */
  public async completeTask(
    caseId: string,
    taskId: string,
    notes?: string
  ): Promise<ApiResult<{ task: CaseTask }>> {
    return apiClient.patch<{ task: CaseTask }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/complete`,
      { notes }
    );
  }

  /**
   * Retrieves immutable activity audit records
   */
  public async getActivities(
    caseId: string
  ): Promise<ApiResult<{ activities: CaseActivity[] }>> {
    return apiClient.get<{ activities: CaseActivity[] }>(
      `/api/v1/asha/cases/${encodeURIComponent(caseId)}/activities`
    );
  }

  /**
   * Assisted field registration of household and auto-assigned case
   */
  public async createFieldRegistration(
    input: FieldRegistrationInput
  ): Promise<ApiResult<{ case: AshaCase; household: Household }>> {
    return apiClient.post<{ case: AshaCase; household: Household }>(
      "/api/v1/asha/cases",
      input
    );
  }

  /**
   * Retrieves all platform cases for Administrative oversight
   */
  public async listAllCasesForAdmin(): Promise<ApiResult<{ cases: AshaCase[] }>> {
    return apiClient.get<{ cases: AshaCase[] }>("/api/v1/admin/cases");
  }
}

export const caseService = new CaseServiceClient();


