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
                (Authorization: Bearer <token>)
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
      Error Envelope)                        Swytchcode)
             |
             v
       Firebase Service Layer
      (Admin SDK, Token Verification)
             |
             v
       Firestore Repository Layer
      (UserRepository, BaseFirestoreRepository)
             |
             v
        Cloud Firestore (/users/{uid}, /consent_history)
```

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React. Contains no business or eligibility rules.
- **Backend**: Node.js, TypeScript, Fastify with correlation ID tracking, RFC-compliant error responses, and Zod runtime schema validation.
- **Shared Layer (`shared/`)**: Canonical TypeScript types and Zod schemas shared across frontend and backend.
- **Database & Platform**: Cloud Firestore (persistent source of truth) managed strictly through the server-side Firebase Admin SDK (`firebase-admin`).
- **Security & Consent**: Role-based access control (`CITIZEN`, `ASHA`, `ADMIN`) with server-side role resolution and structured consent tracking (`CURRENT_CONSENT_VERSION = "1.0"`).
- **Development Tooling**: Graphify persistent knowledge graph, Git, Vitest.
- **Deployment Target**: Render (Node.js Native Web Service).

---

## 2. Repository Structure

```
/
├── frontend/                     # Next.js 16 App Router Application
│   ├── app/                      # App router layout, auth, citizen, asha, admin pages
│   ├── components/
│   │   ├── auth/                 # ProtectedRoute wrapper
│   │   ├── ui/                   # Button, Input, Select, Textarea, Card, Badge, Modal, etc.
│   │   ├── layout/               # Header, Footer, MobileNav, Shell
│   │   └── dev/                  # Isolated Developer Diagnostics bar
│   ├── lib/
│   │   ├── auth/                 # AuthContext, AuthProvider, useAuth hook
│   │   ├── firebase/             # client.ts (Auth SDK), errors.ts (sanitizer)
│   │   └── utils.ts
│   ├── services/                 # api-client.ts, auth-service.ts
│   ├── types/                    # UI-specific definitions
│   ├── config/                   # site.ts, env.ts, constants.ts
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Node.js + TypeScript + Fastify Application
│   ├── src/
│   │   ├── server.ts             # HTTP listener entrypoint
│   │   ├── app.ts                # Fastify application factory
│   │   ├── config/               # Zod-validated env.ts & constants.ts
│   │   ├── plugins/              # correlation.ts, cors.ts, errors.ts, firebase.ts, auth.ts, guards.ts
│   │   ├── routes/               # health.ts, auth.ts, test-auth.ts, index.ts
│   │   ├── services/             # user.service.ts, firebase, eligibility, gaps, etc.
│   │   └── repositories/         # user.repository.ts, base.repository.ts
│   ├── tests/                    # health.test.ts, auth.test.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── shared/                       # Canonical Shared Contracts
│   ├── types/                    # auth.ts, api.ts, household.ts, eligibility.ts, gaps.ts, actions.ts
│   ├── schemas/                  # auth.schema.ts, health.schema.ts, common.schema.ts
│   └── package.json
│
├── docs/                         # Technical Specifications
│   ├── architecture.md           # Master system architecture, role & consent model
│   ├── firestore-architecture.md # Planned 11-collection Firestore data model & rules
│   ├── design-system.md          # Restrained neutral-first design tokens & typography
│   ├── api-specification.md      # API versioning, correlation IDs, auth contracts
│   └── graphify.md               # Knowledge graph workflow & CLI guide
│
├── firestore.rules               # Restrictive baseline Firestore security rules
├── graphify-out/                 # Graphify knowledge graph directory (preserved)
├── .gitignore                    # Master security & runtime gitignore
├── package.json                  # Root npm workspaces configuration
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

3. **Start Development Servers**:
   - Start backend: `npm run dev:backend` (runs at `http://localhost:8000`)
   - Start frontend: `npm run dev:frontend` (runs at `http://localhost:3000`)
   - Or start from root: `npm run dev`

---

## 4. Running Automated Tests & Builds

### Backend Vitest Test Suite (17 Tests)
```bash
npm test
```

### Full Production Build (Backend + Frontend)
```bash
npm run build
```

---

## 5. Authentication, Roles & Consent (Phase 2)

- **Authentication**: Firebase Authentication (Email/Password + optional Google Sign-In).
- **Session Handling**: Bearer token transmitted in `Authorization: Bearer <ID_TOKEN>`.
- **Role Verification**: Server-side resolved from `/users/{uid}`.
  - `CITIZEN`: Standard citizen access (`/citizen`).
  - `ASHA`: Frontline healthcare worker workspace (`/asha`).
  - `ADMIN`: System governance and role assignment (`/admin`).
- **Role Preservation**: User sync is idempotent; existing ASHA or ADMIN roles are never overwritten on sign-in.
- **Consent Versioning**: `CURRENT_CONSENT_VERSION = "1.0"` verified by `requireConsent` and `ProtectedRoute`.
- **403 Unauthorized**: Dedicated `/unauthorized` route for role violations.
