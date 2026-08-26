/**
 * Backend API health check response contract matching FastAPI HealthCheckResponse.
 */
export interface HealthCheckResponse {
  status: "ok" | "degraded" | "unhealthy";
  app: string;
  version: string;
  environment: string;
  timestamp: string;
  correlation_id?: string;
  services: {
    api: string;
    firebase: string;
    [key: string]: string;
  };
}

/**
 * Standard API error contract matching FastAPI ErrorResponse.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  code: string;
  correlation_id?: string;
  timestamp: string;
  details?: Array<{
    field?: string;
    message: string;
    type?: string;
  }>;
}

/**
 * Generic API result wrapper for typed service calls.
 */
export type ApiResult<T> =
  | { success: true; data: T; correlationId?: string }
  | { success: false; error: ApiErrorResponse; correlationId?: string };
