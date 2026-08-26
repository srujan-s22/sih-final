# SwasthyaSetu — API Specification & Contract Conventions

## 1. API Architecture Conventions

- **Base URL Prefix**: `/api`
- **Versioned Routes**: `/api/v1/...`
- **Root Convenience Aliases**: `/api/health`
- **Payload Format**: `application/json` (UTF-8)
- **Validation Engine**: Zod runtime schema validation

---

## 2. Request Correlation & Observability

Every HTTP request is assigned a unique correlation ID:
- **Header Key**: `x-correlation-id` (and `x-request-id` alias)
- **Lifecycle**:
  1. Frontend API client attaches or generates `X-Correlation-ID`.
  2. Fastify correlation plugin assigns or preserves the ID.
  3. Structured Pino logs attach `correlationId` to all entries.
  4. Response returns `X-Correlation-ID` in HTTP headers and in error/health envelopes.

---

## 3. Standardized Error Contract

All error responses (4xx, 5xx) strictly follow the `ApiErrorResponse` schema:

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "The submitted request data failed schema validation.",
  "code": "VALIDATION_FAILED",
  "correlation_id": "req_a1b2c3d4",
  "timestamp": "2026-08-26T17:00:00.000Z",
  "details": [
    {
      "field": "householdId",
      "message": "Required",
      "type": "invalid_type"
    }
  ]
}
```

> **Security Rule**: Stack traces, file paths, credentials, and raw exception messages are never leaked in API error responses.

---

## 4. Health Check Endpoints

### `GET /api/health` and `GET /api/v1/health`
- **Description**: Fast, non-blocking operational status check.
- **Authentication**: None required (public health endpoint).
- **Response Schema (`HealthCheckResponse`)**:
```json
{
  "status": "ok",
  "app": "SwasthyaSetu API",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2026-08-26T17:00:00.000Z",
  "correlation_id": "req_123456",
  "services": {
    "api": "operational",
    "firebase": "operational"
  }
}
```
