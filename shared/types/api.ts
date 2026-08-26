/**
 * Standard Health Check Response Interface
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
 * Field-level Error Detail
 */
export interface ErrorDetail {
  field?: string;
  message: string;
  type?: string;
}

/**
 * Standard API Error Response Envelope
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  code: string;
  correlation_id?: string;
  timestamp: string;
  details?: ErrorDetail[];
}

/**
 * Generic API Result for Client Services
 */
export type ApiResult<T> =
  | { success: true; data: T; correlationId?: string }
  | { success: false; error: ApiErrorResponse; correlationId?: string };
