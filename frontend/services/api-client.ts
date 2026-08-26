import { env } from "@/config/env";
import { ApiErrorResponse, ApiResult, HealthCheckResponse } from "@shared/types/api";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.apiBaseUrl.replace(/\/$/, "");
  }

  private generateCorrelationId(): string {
    return `req_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const correlationId = this.generateCorrelationId();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Correlation-ID": correlationId,
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        cache: options.cache || "no-store",
      });

      const responseCorrelationId =
        response.headers.get("X-Correlation-ID") || correlationId;

      if (!response.ok) {
        let errorData: ApiErrorResponse;
        try {
          const body = await response.json();
          errorData = {
            success: false,
            error: body.error || `HTTP_${response.status}`,
            message:
              body.message || "An unexpected error occurred while communicating with the server.",
            code: body.code || `HTTP_${response.status}`,
            correlation_id: body.correlation_id || responseCorrelationId,
            timestamp: body.timestamp || new Date().toISOString(),
            details: body.details,
          };
        } catch {
          errorData = {
            success: false,
            error: `HTTP_${response.status}`,
            message: "Unable to process the server response. Please try again.",
            code: `HTTP_${response.status}`,
            correlation_id: responseCorrelationId,
            timestamp: new Date().toISOString(),
          };
        }
        return { success: false, error: errorData, correlationId: responseCorrelationId };
      }

      const data = (await response.json()) as T;
      return { success: true, data, correlationId: responseCorrelationId };
    } catch (err: unknown) {
      const networkError: ApiErrorResponse = {
        success: false,
        error: "NetworkError",
        message: "Unable to connect to the backend server. Please verify your network connection.",
        code: "NETWORK_UNREACHABLE",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      };
      return { success: false, error: networkError, correlationId };
    }
  }

  /**
   * Generic GET request
   */
  public async get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  /**
   * Generic POST request
   */
  public async post<T>(
    endpoint: string,
    body: unknown,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Health Check Convenience Method
   */
  public async checkHealth(): Promise<ApiResult<HealthCheckResponse>> {
    return this.get<HealthCheckResponse>("/api/health");
  }
}

export const apiClient = new ApiClient();
