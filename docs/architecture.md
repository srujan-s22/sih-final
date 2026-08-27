# SwasthyaSetu — System Architecture & Architectural Principles

## 1. System Overview

SwasthyaSetu is an enterprise-grade healthcare access gap identification, entitlement matching, and action resolution platform for SIH 2026. The platform bridges the divide between national/state healthcare schemes (such as AB-PMJAY, state universal health schemes, and maternal programs) and underserved households.

The platform uses a unified, end-to-end TypeScript architecture:

```
                         CITIZEN / ASHA
                               |
                               v
                     Next.js 16 (React 19)
                   (App Router, Tailwind v4)
                               |
                   Centralized API Client
                   (Bearer <Firebase ID Token>)
                               |
                    Shared TypeScript Contracts
                   (shared/types & shared/schemas)
                               |
                               v
                   Node.js + TypeScript Backend
                             (Fastify)
                               |
             +-----------------+-----------------+
             |                 |                 |
             v                 v                 v
       Core Services      AI Services       Integration
     (Config, Auth,       (Future:          (Future:
      Role Guards,         Lyzr / Gemini)    Tavily, n8n,
      Consent Service,                       Sarvam, Exotel,
      Household Service,                     Swytchcode)
      Error Envelope)
             |
             v
       Firebase Service Layer
      (Admin SDK, Token Verification)
             |
             v
       Firestore Repository Layer
      (UserRepository, HouseholdRepository)
             |
             v
        Cloud Firestore
        ├── /users/{uid}
        │   └── /consent_history/{consentId}
        └── /households/{householdId}
            └── /members/{memberId}
```

---

## 2. Authentication, Roles & Authorization (Phase 2)

### 2.1 Authentication vs. Authorization vs. Consent
- **Authentication**: Proves *WHO* the user is via Firebase Authentication ID tokens.
- **Authorization**: Determines *WHAT* the user is permitted to do via server-side role resolution from `/users/{uid}`.
- **Consent**: Determines whether the user has reviewed and accepted healthcare data processing terms (`CURRENT_CONSENT_VERSION = "1.0"`).

### 2.2 Role Architecture & Authoritative Source
- Supported Roles: `CITIZEN`, `ASHA`, `ADMIN`.
- **Single Source of Truth**: The server-managed Firestore document `/users/{uid}`.
- **Role Preservation**: User sync upon sign-in is strictly idempotent. Existing `ASHA` or `ADMIN` roles are **never** overwritten or reset.
- **Role Assignment**: Only an authenticated user with `ADMIN` role can assign privileged roles via `POST /api/v1/auth/role/assign`.

---

## 3. Household Onboarding & Management (Phase 3)

### 3.1 Ownership Model & Security
- **Single Household per Citizen**: Each authenticated citizen manages their family household (`id = "hh_" + ownerUid`).
- **Authoritative Ownership**: Ownership is derived strictly from verified token context (`request.user.uid`).
- **Tamper Protection**: Any client-provided `ownerUid` or `id` payload fields are ignored during creation and strictly forbidden from updates.
- **IDOR Protection**: Citizens can only query, update, and manage members within their own household. Cross-user access is rejected with HTTP 404 / 403.

### 3.2 Member Subcollection Isolation
- Members are stored in subcollection `/households/{householdId}/members/{memberId}`.
- Cascades ownership scoping directly from parent household, ensuring isolated queries and preventing global document enumeration.

---

## 4. Observability & Correlation Tracing

All requests entering the Fastify backend pass through the `correlationPlugin`:
- Incoming requests with `X-Correlation-ID` or `X-Request-ID` headers preserve their ID; otherwise a unique ID is generated.
- The correlation ID is attached to `request.correlationId`, injected into all Pino structured logs, and returned in HTTP response headers.

---

## 5. Deployment Target

- **Target Platform**: Render (Node.js Native Web Service)
- **Node Runtime**: Node.js 20+ / 22+
- **TypeScript Strictness**: Strict mode enabled across all workspaces.
