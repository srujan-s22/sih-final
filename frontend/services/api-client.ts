import { env } from "@/config/env";
import { getCurrentUserToken } from "@/lib/firebase/client";
import { ApiErrorResponse, ApiResult, HealthCheckResponse } from "@shared/types/api";

type AuthFailureCallback = () => void;

class ApiClient {
  private baseUrl: string;
  private onUnauthorizedCallback: AuthFailureCallback | null = null;
  private customTokenProvider: (() => Promise<string | null>) | null = null;

  constructor() {
    this.baseUrl = env.apiBaseUrl.replace(/\/$/, "");
  }

  public setUnauthorizedHandler(callback: AuthFailureCallback) {
    this.onUnauthorizedCallback = callback;
  }

  public setTokenProvider(provider: () => Promise<string | null>) {
    this.customTokenProvider = provider;
  }

  private generateCorrelationId(): string {
    return `req_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    let cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith("/v1/")) {
      cleanEndpoint = `/api${cleanEndpoint}`;
    }
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const correlationId = this.generateCorrelationId();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Correlation-ID": correlationId,
      ...(options.headers as Record<string, string>),
    };

    // Attach Bearer token if not explicitly provided
    if (!headers["Authorization"] && !headers["authorization"]) {
      try {
        const token = this.customTokenProvider
          ? await this.customTokenProvider()
          : await getCurrentUserToken();

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // Continue unauthenticated if token resolution fails
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        cache: options.cache || "no-store",
      });

      const responseCorrelationId =
        response.headers.get("X-Correlation-ID") || correlationId;

      if (!response.ok) {
        if (response.status === 401 && this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }

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

      const jsonResponse = await response.json();
      // Handle unwrapping of standardized backend envelope: { success: true, data: T }
      const data = (jsonResponse && typeof jsonResponse === "object" && "data" in jsonResponse)
        ? jsonResponse.data
        : jsonResponse;

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
    body?: unknown,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Generic PATCH request
   */
  public async patch<T>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Generic PUT request
   */
  public async put<T>(
    endpoint: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Generic DELETE request
   */
  public async delete<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
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
