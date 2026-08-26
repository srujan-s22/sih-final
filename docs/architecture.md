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
      Correlation,         Lyzr / Gemini)    Tavily, n8n,
      Error Envelope)                        Sarvam, Exotel,
             |                               Swytchcode)
             v
       Firebase Service Layer
      (Admin SDK, Token Verification)
             |
             v
       Firestore Repository Layer
             |
             v
        Cloud Firestore (Single Source of Truth)
```

---

## 2. Core Architectural Principles

### 2.1 Unified TypeScript Ecosystem
1. **Frontend (Next.js 16 + React 19)**:
   - Responsible for presentation, UI components, client accessibility, and responsive layouts.
   - Contains **zero** business, eligibility, or gap identification logic.
   - Does **not** query Firestore directly for consequential application domain data.
2. **Backend (Node.js + Fastify + TypeScript)**:
   - High-throughput, low-overhead HTTP engine with native TypeScript plugins and Zod runtime schema validation.
   - The single authoritative gatekeeper for business logic, rule processing, and persistence.
   - Manages all privileged operations via the server-side Firebase Admin SDK (`firebase-admin`).
3. **Shared Contracts (`shared/`)**:
   - Canonical types and Zod validation schemas shared between frontend and backend.
   - Eliminates contract drift and duplicated models.
4. **Database (Cloud Firestore)**:
   - The persistent source of truth.
   - Direct client mutations on domain data are blocked by default via `firestore.rules`.
5. **AI Layer (Future Phases)**:
   - AI outputs (Gemini, Lyzr) are treated as recommendations and structured drafts; they are **never** the direct, unvalidated source of truth. All AI outputs are validated with Zod schemas before being used in business logic.

---

## 3. Observability & Correlation Tracing

All requests entering the Fastify backend pass through the `correlationPlugin`:
- Incoming requests with `X-Correlation-ID` or `X-Request-ID` headers preserve their ID; otherwise a unique ID (`req_<random>_<timestamp>`) is generated.
- The correlation ID is attached to `request.correlationId`, injected into all Pino structured logs, and returned in HTTP response headers.
- This provides seamless end-to-end tracing across Next.js, Fastify, Firebase, and future external microservices (Lyzr, Gemini, Tavily, n8n, Sarvam, Exotel, Swytchcode).

---

## 4. Deployment Target

- **Target Platform**: Render (Node.js Native Web Service)
- **Node Runtime**: Node.js 20+ / 22+
- **TypeScript Strictness**: Strict mode enabled across all workspaces.
