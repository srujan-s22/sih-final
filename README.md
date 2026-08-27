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

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React.
- **Backend**: Node.js, TypeScript, Fastify v5 with correlation ID tracking, RFC-compliant error responses, and Zod runtime schema validation.
- **Shared Layer (`shared/`)**: Canonical TypeScript types and Zod schemas shared across frontend and backend.
- **Database & Platform**: Cloud Firestore managed strictly through the server-side Firebase Admin SDK (`firebase-admin`).
- **Security & Ownership**: Role-based access control (`CITIZEN`, `ASHA`, `ADMIN`), strict token-based household ownership (`ownerUid = request.user.uid`), and IDOR protection.
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
│   ├── services/                 # api-client.ts, auth-service.ts, household-service.ts
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
│   │   ├── routes/               # health.ts, auth.ts, household.ts, test-auth.ts, index.ts
│   │   ├── services/             # user.service.ts, household.service.ts, firebase, etc.
│   │   └── repositories/         # user.repository.ts, household.repository.ts, base.repository.ts
│   ├── tests/                    # health.test.ts, auth.test.ts, household.test.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── shared/                       # Canonical Shared Contracts
│   ├── types/                    # auth.ts, household.ts, eligibility.ts, gaps.ts, api.ts
│   ├── schemas/                  # auth.schema.ts, household.schema.ts, health.schema.ts, common.schema.ts
│   └── package.json
│
├── docs/                         # Technical Specifications
│   ├── architecture.md           # Master system architecture, role, consent & household ownership
│   ├── firestore-architecture.md # Planned 11-collection Firestore data model & subcollections
│   ├── design-system.md          # Restrained neutral-first design tokens & typography
│   ├── api-specification.md      # API versioning, correlation IDs, auth & household contracts
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

### Backend Vitest Test Suite (28 Tests)
```bash
npm test
```

### Full Production Build (Backend + Frontend)
```bash
npm run build
```

---

## 5. Phase 3 Implemented Capabilities

- **Household Management**: Idempotent creation, retrieval, and updating of citizen household profiles.
- **Family Member Subcollections**: Adding, editing, listing, and removing members (`/households/{householdId}/members/{memberId}`).
- **Strict Server-Side Ownership**: `ownerUid` derived exclusively from verified Firebase tokens.
- **IDOR Protection**: Complete isolation preventing cross-household data access.
- **Restrained Citizen UI**: Clean, mobile-first, short human wording on `/citizen`.
