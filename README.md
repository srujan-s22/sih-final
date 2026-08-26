# SwasthyaSetu — SIH 2026

> **SwasthyaSetu** helps households identify healthcare access gaps, understand what is needed, and connect those needs to action.

---

## 1. Architecture Overview

SwasthyaSetu is built on an end-to-end TypeScript architecture with strict separation of presentation, domain rules, and persistence:

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

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React. Contains no business or eligibility rules.
- **Backend**: Node.js, TypeScript, Fastify with correlation ID tracking, RFC-compliant error responses, and Zod runtime schema validation.
- **Shared Layer (`shared/`)**: Canonical TypeScript types and Zod schemas shared across frontend and backend.
- **Database & Platform**: Cloud Firestore (persistent source of truth) managed strictly through the server-side Firebase Admin SDK (`firebase-admin`).
- **Development Tooling**: Graphify persistent knowledge graph, Git, Vitest.
- **Deployment Target**: Render (Node.js Native Web Service).

---

## 2. Repository Structure

```
/
├── frontend/                     # Next.js 16 App Router Application
│   ├── app/                      # App router layout, pages, errors, globals.css
│   ├── components/
│   │   ├── ui/                   # Reusable base UI primitives
│   │   ├── layout/               # Header, Footer, MobileNav, Shell
│   │   └── dev/                  # Isolated Developer Diagnostics bar
│   ├── lib/
│   │   ├── firebase/client.ts    # Client Firebase Auth foundation
│   │   └── utils.ts              # Styling helpers
│   ├── hooks/                    # useHealthCheck, useMediaQuery
│   ├── services/                 # Centralized typed api-client.ts
│   ├── types/                    # UI-specific definitions
│   ├── config/                   # Site and validated env configurations
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Node.js + TypeScript + Fastify Application
│   ├── src/
│   │   ├── server.ts             # HTTP listener entrypoint
│   │   ├── app.ts                # Fastify application factory
│   │   ├── config/               # Zod-validated env & constants
│   │   ├── plugins/              # Correlation, CORS, Errors, Firebase, Auth
│   │   ├── routes/               # /api/health, /api/v1/health
│   │   ├── services/             # Firebase & future phase service boundaries
│   │   └── repositories/         # Generic BaseFirestoreRepository
│   ├── tests/                    # Vitest health check & error test suite
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                       # Canonical Shared Contracts
│   ├── types/                    # API, Household, Eligibility, Gaps, Actions
│   └── schemas/                  # Zod validation schemas
│
├── docs/                         # Technical Specifications
│   ├── architecture.md           # Master system architecture & service boundaries
│   ├── firestore-architecture.md # Planned 11-collection Firestore data model & rules
│   ├── design-system.md          # Restrained neutral-first design tokens & typography
│   ├── api-specification.md      # API versioning, correlation IDs, Zod schemas
│   └── graphify.md               # Knowledge graph workflow & CLI guide
│
├── firestore.rules               # Restrictive baseline Firestore security rules
├── graphify-out/                 # Graphify knowledge graph directory (preserved)
├── .gitignore                    # Master security & runtime gitignore
└── README.md
```

---

## 3. Local Development Setup

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `10+`

---

### Setup Instructions

1. **Install Root Workspaces & Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   ```bash
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

3. **Start Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
   The backend starts at `http://localhost:8000`.

4. **Start Frontend Server**:
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend starts at `http://localhost:3000`.

---

## 4. Health Check Endpoints

- **Public Fast Health Check**: `GET http://localhost:8000/api/health`
- **Versioned Health Check**: `GET http://localhost:8000/api/v1/health`

Example response:
```json
{
  "status": "ok",
  "app": "SwasthyaSetu API",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2026-08-26T17:00:00.000Z",
  "correlation_id": "req_1234567890",
  "services": {
    "api": "operational",
    "firebase": "operational"
  }
}
```

---

## 5. Running Automated Tests

### Backend Vitest Suite
```bash
cd backend
npm test
```

### Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 6. Graphify Knowledge Graph

- Run a full scan: `/Users/srujan/.local/bin/graphify .`
- Run an incremental update: `/Users/srujan/.local/bin/graphify . --update`
- Query the graph: `/Users/srujan/.local/bin/graphify query "<question>"`

---

## 7. Firebase Security & Data Boundary

1. **Client Boundary**: The frontend Firebase SDK is restricted solely to client authentication tokens.
2. **Server Boundary**: All domain entities (`households`, `members`, `schemes`, `gaps`, `actions`, `evidence`, `audit_logs`) are queried and mutated exclusively via Fastify using the server-side Firebase Admin SDK.
3. **Security Rules**: `firestore.rules` enforces a default deny-all posture against direct browser modifications.
