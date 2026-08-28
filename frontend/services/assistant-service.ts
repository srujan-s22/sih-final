import { apiClient } from "./api-client";
import {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantStatusResponse,
} from "@shared/types/assistant";
import { ApiResult } from "@shared/types/api";

export class AssistantService {
  /**
   * Checks the status and availability of the Gemini conversational assistant.
   */
  public async getStatus(): Promise<ApiResult<AssistantStatusResponse>> {
    return apiClient.get<AssistantStatusResponse>("/api/v1/assistant/status");
  }

  /**
   * Sends a conversational query to the SwasthyaSetu assistant.
   */
  public async sendMessage(
    request: AssistantChatRequest
  ): Promise<ApiResult<AssistantChatResponse>> {
    return apiClient.post<AssistantChatResponse>("/api/v1/assistant/chat", request);
  }
}

export const assistantService = new AssistantService();
