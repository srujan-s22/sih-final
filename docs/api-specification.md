# SwasthyaSetu — API Specification & Contract Conventions

## 1. API Architecture Conventions

- **Base URL Prefix**: `/api`
- **Versioned Routes**: `/api/v1/...`
- **Root Convenience Aliases**: `/api/health`
- **Payload Format**: `application/json` (UTF-8)
- **Validation Engine**: Zod runtime schema validation
- **Authorization Header**: `Authorization: Bearer <Firebase_ID_Token>`

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
  "timestamp": "2026-08-27T05:30:00.000Z",
  "details": [
    {
      "field": "consentVersion",
      "message": "Consent version is required",
      "type": "invalid_type"
    }
  ]
}
```

---

## 4. Endpoints Summary

### Health Check
- `GET /api/health` & `GET /api/v1/health`: Public health check returning `HealthCheckResponse`.

### Authentication & Consent (`/api/v1/auth/*`)
- `GET /api/v1/auth/me`
  - **Auth**: Required (`Bearer <token>`)
  - **Response**: Returns current user profile, consent status, and `activeConsentVersion`.
- `POST /api/v1/auth/sync`
  - **Auth**: Required (`Bearer <token>`)
  - **Body**: `{ displayName?: string, phoneNumber?: string }`
  - **Response**: Idempotently syncs profile, strictly preserving existing role (`CITIZEN`, `ASHA`, `ADMIN`).
- `POST /api/v1/auth/consent`
  - **Auth**: Required (`Bearer <token>`)
  - **Body**: `{ consentVersion: string, accepted: boolean, method?: "web_portal" | "mobile" }`
  - **Response**: Updates current user consent state and appends immutable audit record to `consent_history`.
- `POST /api/v1/auth/role/assign`
  - **Auth**: Required (`ADMIN` role only)
  - **Body**: `{ targetUid: string, newRole: "CITIZEN" | "ASHA" | "ADMIN" }`
  - **Response**: Updates target user's role. Actor is strictly resolved from verified token context.

### Authorization Verification Endpoints (`/api/v1/test/*`)
- `GET /api/v1/test/citizen-only`: Protected by `requireRole(["CITIZEN"])` + `requireConsent`.
- `GET /api/v1/test/asha-only`: Protected by `requireRole(["ASHA"])` + `requireConsent`.
- `GET /api/v1/test/admin-only`: Protected by `requireRole(["ADMIN"])`.
- `GET /api/v1/test/asha-or-admin`: Protected by `requireRole(["ASHA", "ADMIN"])`.
