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

## 3. Endpoints Summary

### Health Check
- `GET /api/health` & `GET /api/v1/health`: Public health check returning `HealthCheckResponse`.

### Authentication & Consent (`/api/v1/auth/*`)
- `GET /api/v1/auth/me`: Returns user profile and consent status (`requireAuth`).
- `POST /api/v1/auth/sync`: Idempotently syncs profile, strictly preserving role (`requireAuth`).
- `POST /api/v1/auth/consent`: Submits consent and appends audit record (`requireAuth`).
- `POST /api/v1/auth/role/assign`: Admin-only role assignment (`requireRole(["ADMIN"])`).

### Household & Member Management (`/api/v1/households/*`)
- `POST /api/v1/households`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Body**: `CreateHouseholdInput`
  - **Purpose**: Creates or resolves existing household for authenticated citizen.
- `GET /api/v1/households/me`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Purpose**: Retrieves citizen's household and nested family members list.
- `PATCH /api/v1/households/me`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Body**: `UpdateHouseholdInput`
  - **Purpose**: Updates citizen's household details.
- `POST /api/v1/households/me/members`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Body**: `CreateMemberInput`
  - **Purpose**: Adds a new family member to citizen's household.
- `GET /api/v1/households/me/members`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Purpose**: Lists all members of citizen's household.
- `PATCH /api/v1/households/me/members/:memberId`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Body**: `UpdateMemberInput`
  - **Purpose**: Updates an existing family member.
- `DELETE /api/v1/households/me/members/:memberId`
  - **Auth**: Required (`requireAuth`, `requireConsent`)
  - **Purpose**: Removes a family member from citizen's household.
