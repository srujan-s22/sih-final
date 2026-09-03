# SwasthyaSetu — Software Requirements Specification (SRS)

**Document Version:** 1.0.0  
**Current Implementation Status:** Production-Ready Core Implementation (Phases 1–11 & Phases A–F Verified)  
**System Classification:** Digital Public Health Infrastructure & Assisted Healthcare Delivery System  
**Last Updated:** September 1, 2026  
**Authoritative Location:** `/srs.md` (Repository Root)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [System Objectives](#3-system-objectives)
4. [System Scope](#4-system-scope)
5. [User Roles & Permission Matrix](#5-user-roles--permission-matrix)
6. [High-Level System Architecture](#6-high-level-system-architecture)
7. [Complete Technology Stack](#7-complete-technology-stack)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Landing Page & Public Experience](#9-landing-page--public-experience)
10. [Authentication, Authorization & Consent Flow](#10-authentication-authorization--consent-flow)
11. [Citizen Portal Functional Specification](#11-citizen-portal-functional-specification)
12. [ASHA Workspace Functional Specification](#12-asha-workspace-functional-specification)
13. [Admin Console Functional Specification](#13-admin-console-functional-specification)
14. [Healthcare Scheme & Deterministic Eligibility Engine](#14-healthcare-scheme--deterministic-eligibility-engine)
15. [Case Management & Beneficiary Journey Engine](#15-case-management--beneficiary-journey-engine)
16. [Assistance Request & Connection Lifecycle](#16-assistance-request--connection-lifecycle)
17. [Follow-Up & Scheduling Subsystem](#17-follow-up--scheduling-subsystem)
18. [Multilingual Website & UI Localization (Phase E)](#18-multilingual-website--ui-localization-phase-e)
19. [Sarvam Multilingual Voice Architecture (Phase F & Phase 11)](#19-sarvam-multilingual-voice-architecture-phase-f--phase-11)
20. [End-to-End PSTN Voice Call Flow](#20-end-to-end-pstn-voice-call-flow)
21. [Sarvam Saaras Speech-to-Text (STT) Specification](#21-sarvam-saaras-speech-to-text-stt-specification)
22. [Sarvam Bulbul Text-to-Speech (TTS) Specification](#22-sarvam-bulbul-text-to-speech-tts-specification)
23. [Voice Assistant Conversational Intelligence](#23-voice-assistant-conversational-intelligence)
24. [Telephony Audio Pipeline & Codec Transcoding](#24-telephony-audio-pipeline--codec-transcoding)
25. [Exotel Telephony & WebSocket Streaming Integration](#25-exotel-telephony--websocket-streaming-integration)
26. [n8n Automation & Domain Event Architecture](#26-n8n-automation--domain-event-architecture)
27. [Database & Firestore Data Model](#27-database--firestore-data-model)
28. [Complete API Specification](#28-complete-api-specification)
29. [Security, Privacy & RBAC Architecture](#29-security-privacy--rbac-architecture)
30. [Error Handling, Fallback & System Resilience](#30-error-handling-fallback--system-resilience)
31. [Accessibility & Usability Engineering](#31-accessibility--usability-engineering)
32. [Responsive Design Strategy](#32-responsive-design-strategy)
33. [Global Design System](#33-global-design-system)
34. [Data Flow Diagrams](#34-data-flow-diagrams)
35. [Complete A-to-Z User Journeys](#35-complete-a-to-z-user-journeys)
36. [Status Enums & Finite State Machines](#36-status-enums--finite-state-machines)
37. [Observability, Auditability & Telemetry](#37-observability-auditability--telemetry)
38. [Testing & Quality Assurance Strategy](#38-testing--quality-assurance-strategy)
39. [Performance, Scalability & Reliability](#39-performance-scalability--reliability)
40. [Environment Configuration Reference](#40-environment-configuration-reference)
41. [Deployment & Infrastructure Topology](#41-deployment--infrastructure-topology)
42. [Current Implementation Status Matrix](#42-current-implementation-status-matrix)
43. [Known Limitations](#43-known-limitations)
44. [Future Extensions](#44-future-extensions)
45. [Requirements Traceability Matrix](#45-requirements-traceability-matrix)
46. [Glossary of Terms](#46-glossary-of-terms)
47. [Machine-Readable Data & Identifier Rules](#47-machine-readable-data--identifier-rules)

---

## 1. Executive Summary

**SwasthyaSetu** ("Health Bridge") is an assisted digital healthcare delivery platform designed to bridge the structural gap between India’s central/state health assurance schemes and the vulnerable citizens entitled to their protection. Rather than functioning as a passive informational portal, SwasthyaSetu operates as an active, human-in-the-loop operational ecosystem linking three core stakeholders:

1. **Citizens:** Vulnerable individuals and household decision-makers seeking coverage, entitlement evaluation, and guided assistance.
2. **ASHA Workers (Accredited Social Health Activists):** Frontline community healthcare facilitators managing household caseloads, assisting with document verification, conducting physical home visits, and navigating enrolment blockers.
3. **Health Administrators:** Supervisory medical and district officers maintaining policy compliance, overseeing ASHA caseload allocations, validating scheme guidelines, and monitoring operational telemetry.

SwasthyaSetu integrates an authoritative, deterministic rule engine that evaluates family-level eligibility across schemes such as **Ayushman Bharat (AB-PMJAY)**, **Janani Suraksha Yojana (JSY)**, **Janani Shishu Suraksha Karyakram (JSSK)**, and state programs like **Ayushman Bharat - Arogya Karnataka (AB-ARK)**.

To overcome severe digital and linguistic literacy barriers in rural and peri-urban demographics, SwasthyaSetu incorporates a **two-tier multilingual delivery architecture**:
- **Trilingual Web Interface:** Full parity across English (`en`), Kannada (`kn`), and Hindi (`hi`).
- **Interactive Multilingual Voice Assistant via Real PSTN:** Powered by **Exotel Telephony** and **Sarvam AI** (`saaras:v3` STT and `bulbul:v3` TTS at 8kHz μ-law), supporting full interactive voice calls over regular non-smartphone mobile networks in Kannada (`kn-IN`), Hindi (`hi-IN`), and English (`en-IN`).

The platform guarantees strict privacy, client-side encryption of authentication secrets, zero leakage of personal health identifiers (PHI) over voice streams, and deterministic governance: AI never hallucinated medical or eligibility rules, acting solely as a speech transcription, speech synthesis, and contextual explanation interface.

---

## 2. Problem Statement

Across India, hundreds of millions of low-income citizens qualify for life-saving welfare and healthcare schemes funded by central and state governments. In practice, utilization remains severely constrained due to five systemic friction points:

1. **Complex, Disjointed Scheme Rules:** Eligibility rules depend on intersecting criteria—age thresholds (e.g., universal PM-JAY for senior citizens 70+ irrespective of income), socio-economic categories (BPL, Antyodaya Anna Yojana, NFSA), maternal status, infant age, and state residency. Families struggle to determine who in their household qualifies for what benefit.
2. **The "Last-Mile" Documentation Gap:** A family might qualify in theory, but lacks knowledge of exact mandatory documentation (e.g., Mother & Child Protection [MCP] card, Aadhaar e-KYC on the Ayushman app, or linked bank passbooks). Incomplete paperwork causes hospital turnaways during emergency admissions.
3. **Frontline ASHA Worker Overload:** Frontline ASHA workers are burdened with paper registers, fragmented home visit schedules, missed follow-ups for high-risk maternal patients, and lack of real-time visibility into which households face critical coverage gaps.
4. **Administrative Blind Spots:** District health administrators have no centralized telemetry to assess ASHA caseload distribution, overdue patient interactions, or unresolved field enrollment blockers.
5. **Digital & Language Barriers:** Over 60% of rural beneficiaries lack smartphones or high-speed data access, and cannot read English or formal administrative Hindi/Kannada text. Traditional web-only portals fail completely for illiterate or non-smartphone populations.

SwasthyaSetu addresses these challenges by uniting deterministic eligibility computation, frontline ASHA field case tracking, and standard telephone (PSTN) voice interaction in regional mother tongues.

---

## 3. System Objectives

### Citizen Objectives
- **Household-Centric Evaluation:** Enable citizens to register their household and family members once, instantly unlocking deterministic eligibility evaluations for every member across all supported schemes.
- **Actionable Guidance:** Provide transparent checklists of required documents, enrollment steps, and official scheme citations rather than generic advice.
- **Direct ASHA Linkage:** Allow citizens to discover, link with, and request direct assistance from their local designated ASHA worker.
- **PSTN Voice Accessibility:** Allow citizens to request a call back or dial in via traditional feature phones to query their household eligibility and case status in Kannada, Hindi, or English without requiring an active internet connection.

### ASHA Worker Objectives
- **Digital Caseload Management:** Provide a consolidated, offline-friendly mobile workspace replacing physical registers with digital household records.
- **Attention Signals & Gap Triage:** Automatically flag households with urgent healthcare gaps (e.g., unvaccinated infants, unregistered pregnancies, unassisted 70+ seniors).
- **Assistance Request Workflow:** Enable workers to review, accept, or decline citizen assistance requests, automatically converting accepted requests into tracked field cases.
- **Structured Field Follow-Ups:** Maintain an integrated scheduling system categorizing home visits into `Due Today`, `Overdue`, `Upcoming`, and `Completed`.

### Administrator Objectives
- **Real-Time Caseload Oversight:** Monitor total registered households, active cases, overdue follow-ups, and ASHA worker workloads across administrative jurisdictions.
- **Workforce Roster & Assignment:** Inspect ASHA jurisdictions, active caseload counts, and reassign stalled or overloaded cases between workers.
- **Scheme & Rule Governance:** Maintain authoritative scheme metadata, source legal citations, document requirements, and rule definitions with strict versioning.
- **Auditability & Telemetry:** Inspect full system telemetry, including automated n8n event dispatches, PSTN call records, and security audit logs.

### Platform & Technical Objectives
- **Deterministic Truth Boundary:** Healthcare eligibility and assistance decisions must be executed by validated rule engines and relational services, never delegated to non-deterministic LLMs.
- **Strict Role-Based Access Control (RBAC):** Cryptographic verification of Firebase Bearer tokens on every API call, enforcing separation between Citizen, ASHA, and Admin roles.
- **Zero Secret Exposure:** Zero exposure of server secrets (`SARVAM_API_KEY`, `EXOTEL_API_TOKEN`, `FIREBASE_PRIVATE_KEY`, `TAVILY_API_KEY`) to clients, telemetry, or public config endpoints.
- **Audio Telephony Invariance:** Deliver G.711 μ-law compliant 8000Hz audio chunked in precise 20ms (160-byte) frames over full-duplex WebSockets for seamless carrier telephony.

---

## 4. System Scope

### In Scope (Fully Implemented & Verified)
- Single-page responsive web applications for Citizen, ASHA, and Administrator roles built with Next.js 16 (React 19).
- Fastify 5 REST API backend with native WebSocket support (`@fastify/websocket`).
- Deterministic scheme evaluation engine seeded with 5 authoritative schemes: `ab-pmjay`, `jsy`, `state-health-assurance`, `jssk`, and `ab-ark-karnataka`.
- Household and family member lifecycle management (CRUD, health indicators, socio-economic classifications).
- Frontline ASHA caseload workspace: Case detail inspection drawer, task tracking, follow-up scheduling, and field registrations.
- Administrator control center: Caseload oversight, ASHA roster, scheme registry, and system health monitors.
- Full UI localization in English (`en`), Kannada (`kn`), and Hindi (`hi`).
- Full interactive PSTN voice system using Exotel telephony, Sarvam Saaras STT (`saaras:v3`), and Sarvam Bulbul TTS (`bulbul:v3`) in `en-IN`, `kn-IN`, and `hi-IN`.
- Automated voice VAD (Voice Activity Detection), G.711 μ-law transcoding, and 160-byte frame chunking.
- Multi-turn conversational healthcare assistant (Gemini 2.5 Flash) grounded in verified household data.
- Asynchronous domain event automation architecture dispatching to n8n webhook orchestrators.
- Google Cloud Firestore NoSQL storage with strict subcollection hierarchies and security rules.

### Out of Scope (Explicitly Excluded / Non-Goals)
- **Direct Clinical Diagnosis or Prescription:** SwasthyaSetu does not diagnose illnesses, interpret medical imagery, or prescribe medications.
- **Direct Financial Disbursement / Banking Integration:** The system tracks eligibility for DBT (Direct Benefit Transfer) but does not execute direct bank transfers or integrate with PFMS/NPCI.
- **Hospital Bed Management:** The system does not manage real-time ICU/hospital bed occupancies.
- **SMS/WhatsApp Gateway Broadcasting (Native):** Handled externally via webhook automations (e.g. n8n); no direct SMPP SMS modem is managed by the core Fastify daemon.
- **Languages Outside en-IN, kn-IN, hi-IN:** Other regional languages (e.g., Telugu, Tamil, Marathi) are intentionally deferred to future extension phases.

---

## 5. User Roles & Permission Matrix

The platform enforces three strictly separated roles defined in `shared/types/auth.ts`:

1. **`CITIZEN`:** A household representative or individual seeking healthcare entitlements.
2. **`ASHA`:** A frontline health worker authorized to manage a local community caseload.
3. **`ADMIN`:** A health department supervisor or system administrator with platform-wide oversight.

### Role Permission Matrix

| Functional Capability | Citizen | ASHA Worker | Administrator | Enforcement Mechanism |
|---|:---:|:---:|:---:|---|
| Browse Public Schemes & Citations | Yes | Yes | Yes | Public Endpoint (`/v1/schemes`) |
| Register / Authenticate Account | Yes | Yes (Secret Required) | Yes (Secret Required) | `/v1/auth/prevalidate` & `/v1/auth/register` |
| View Own User Profile (`/auth/me`) | Yes | Yes | Yes | `requireAuth` Guard |
| Submit Data Consent | Yes | Yes | Yes | `requireAuth` + `/v1/auth/consent` |
| Create / Manage Own Household Profile | Yes | No | No | `requireRole(["CITIZEN"])` |
| Add / Edit / Remove Own Family Members | Yes | No | No | `requireRole(["CITIZEN"])` |
| View Own Household Eligibility & Guidance | Yes | No | No | `requireRole(["CITIZEN"])` |
| Search Public ASHA Directory | Yes | Yes | Yes | Authenticated Route |
| Link to ASHA via Service Code | Yes | No | No | `requireRole(["CITIZEN"])` |
| Submit Scheme Assistance Request | Yes | No | No | `requireRole(["CITIZEN"])` |
| Request PSTN Callback (`/voice/citizen/request-call`) | Yes | No | No | `requireRole(["CITIZEN"])` |
| Chat with AI Assistant Drawer | Yes | Yes | Yes | `requireAuth` + Role-Scoped Context |
| View Assigned Community Caseload | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Field-Register New Household | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Review / Accept / Decline Assistance Requests | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Create / Update Case Tasks & Notes | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Schedule / Reschedule / Complete Follow-Ups | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Trigger Outbound ASHA Call to Beneficiary | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Reassign Cases Between ASHA Workers | No | No | Yes | `requireRole(["ADMIN"])` |
| View All Platform Follow-Ups & Telemetry | No | No | Yes | `requireRole(["ADMIN"])` |
| Assign Platform Roles to Users | No | No | Yes | `requireRole(["ADMIN"])` |
| Query External Evidence via Tavily Search | No | No | Yes | `requireRole(["ADMIN"])` |
| Resolve Knowledge Conflicts | No | No | Yes | `requireRole(["ADMIN"])` |
| View Voice Telemetry & Automation Health | No | No | Yes | `requireRole(["ADMIN"])` |

---

## 6. High-Level System Architecture

### 6.1 Web Application & Data Plane Architecture

```
                                  +---------------------------------------+
                                  |     User Browser / Mobile Device      |
                                  |  (Next.js 16 App Router + Tailwind)   |
                                  +---------------------------------------+
                                        |                           |
                  Firebase Auth Tokens  |                           | REST / JSON
                                        v                           v
+------------------------------------------------------------------------------------+
|                         Fastify 5 API Backend Daemon (Node.js)                     |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  | Authentication & RBAC Middleware Plugin                                      |  |
|  | - Token Verification: Firebase Admin SDK                                     |  |
|  | - Pre-Handler Guards: requireAuth, requireRole(roles), requireConsent         |  |
|  | - Correlation ID Injector & Audit Logger                                     |  |
|  +------------------------------------------------------------------------------+  |
|                                        |                                           |
|                                        v                                           |
|  +------------------------------------------------------------------------------+  |
|  | Domain Services & Business Logic Layer                                       |  |
|  | - UserService            - HouseholdService         - SchemeService          |  |
|  | - EligibilityService     - GuidanceService          - ConnectionService      |  |
|  | - AssistanceService      - CaseService              - EvidenceService        |  |
|  | - VoiceGatewayService    - VoiceActionService       - AutomationService      |  |
|  +------------------------------------------------------------------------------+  |
|         |                     |                     |                     |        |
|         v                     v                     v                     v        |
|  +--------------+     +---------------+     +---------------+     +-------------+  |
|  | Firestore    |     | Google Gemini |     | Lyzr AI Agent |     | Tavily      |  |
|  | Repositories |     | 2.5 Flash     |     | (Studio V3)   |     | Search API  |  |
|  +--------------+     +---------------+     +---------------+     +-------------+  |
+------------------------------------------------------------------------------------+
         |                                                                   |
         v                                                                   v
+-----------------------+                                           +----------------+
| Google Cloud Firestore|                                           | n8n Webhook    |
| (NoSQL Cloud Database)|                                           | Orchestration  |
+-----------------------+                                           +----------------+
```

### 6.2 Real-Time PSTN Voice & Telephony Architecture

```
+------------------+
| Citizen Mobile   |  (Traditional GSM/PSTN Feature Phone or Smartphone)
| Phone (+91...)   |
+------------------+
         ^
         | PSTN Audio Call (8kHz Standard Carrier Line)
         v
+------------------+
|  Exotel Telecom  |
|  PSTN Gateway    |
+------------------+
         |
         | Outbound / Inbound Call Initiation via REST API
         v
+------------------+         Full-Duplex WebSocket (/api/v1/voice/stream)
|  Exotel Voice    | <====================================================> +-----------------------+
|  Stream Applet   |        JSON: connected, start, media, mark, stop        | Fastify WebSocket     |
+------------------+                                                        | Gateway Handler       |
                                                                            +-----------------------+
                                                                                        |
                                                                                        v
                                                                            +-----------------------+
                                                                            | ExotelStreamGateway   |
                                                                            | - Audio Buffering     |
                                                                            | - RMS Voice Activity  |
                                                                            | - Silence Boundary    |
                                                                            +-----------------------+
                                                                                        |
                                         +----------------------------------------------+
                                         | Accumulated Speech Buffer (8kHz 16-bit PCM WAV)
                                         v
                                +-------------------------------+
                                | Sarvam Saaras STT API         |
                                | model: saaras:v3              |
                                | language: en-IN / kn-IN/ hi-IN|
                                +-------------------------------+
                                         |
                                         | High-Accuracy Native Transcript
                                         v
                                +-------------------------------+
                                | SarvamService Intent Parser   |
                                | - Keyword & Code-Switching    |
                                | - Multilingual Entity Extract |
                                +-------------------------------+
                                         |
                                         | Parsed Intent & Target Member
                                         v
                                +-------------------------------+
                                | VoiceActionService            |
                                | (Deterministic Business Logic)|
                                | - Scheme & Eligibility Lookup |
                                | - Identity Verification       |
                                | - Assistance Case Status      |
                                +-------------------------------+
                                         |
                                         | Neutral Domain Result & Session Language
                                         v
                                +-------------------------------+
                                | VoiceResponseFormatter        |
                                | Generates Spoken Dialog Text  |
                                | in en-IN, kn-IN, or hi-IN     |
                                +-------------------------------+
                                         |
                                         | Localized Spoken Text
                                         v
                                +-------------------------------+
                                | Sarvam Bulbul TTS API         |
                                | model: bulbul:v3              |
                                | target_language: kn/hi/en-IN  |
                                | sample_rate: 8000Hz           |
                                +-------------------------------+
                                         |
                                         | Synthesized 8kHz Audio WAV
                                         v
                                +-------------------------------+
                                | audio-codec.ts                |
                                | - Extract 16-bit Linear PCM   |
                                | - Transcode via G.711 Table   |
                                | - Chunk into 160-byte (20ms)  |
                                |   μ-law (PCMU) Frames         |
                                +-------------------------------+
                                         |
                                         | Base64 Encoded Media Frames
                                         v
                                +-------------------------------+
                                | WebSocket -> Exotel -> Caller |
                                +-------------------------------+
```

---

## 7. Complete Technology Stack

| Component Layer | Technology / Package | Verified Version | Purpose in SwasthyaSetu |
|---|---|:---:|---|
| **Frontend Framework** | Next.js (App Router) | `16.3.3` | React 19 server/client hybrid rendering, responsive routing, and asset serving |
| **UI Library** | React | `19.0.0` | Declarative user interface components and state hooks |
| **CSS & Styling** | Tailwind CSS (with PostCSS) | `4.3.3` | Custom utility design system, responsive breakpoints, and custom form primitives |
| **Client Icons** | Lucide React | `1.34.0` | Consistent iconography across dashboards, drawers, status badges, and buttons |
| **Client Validation** | Zod | `4.4.3` | Client-side input validation for registration, forms, and modal interactions |
| **Client Auth SDK** | Firebase Web SDK | `12.18.0` | Client authentication, token lifecycle, and session maintenance |
| **Backend Runtime** | Node.js | `v22.x` | Modern server-side asynchronous execution environment |
| **Backend Framework** | Fastify | `5.2.1` | High-throughput, low-overhead HTTP web framework with robust plugin lifecycle |
| **WebSocket Engine** | `@fastify/websocket` / `ws` | `11.3.0` / `8.21.3` | Low-latency duplex communication engine handling Exotel telephony audio frames |
| **CORS Middleware** | `@fastify/cors` | `10.1.0` | Cross-Origin Resource Sharing security configuration for web clients |
| **Schema Validation** | Zod | `3.24.2` | Runtime API payload validation and schema contracts shared across frontend/backend |
| **Backend Auth SDK** | Firebase Admin SDK | `13.10.0` | Cryptographic verification of Firebase ID tokens and server-side profile syncing |
| **Database** | Google Cloud Firestore | Native API | Serverless NoSQL document database storing users, households, cases, and sessions |
| **Conversational AI** | `@google/genai` (Gemini) | `2.19.0` | Grounded multi-turn contextual assistance via model `gemini-3.6-flash` |
| **Voice STT** | Sarvam AI (Saaras) | `saaras:v3` | High-accuracy Indian English, Kannada, and Hindi speech-to-text transcription |
| **Voice TTS** | Sarvam AI (Bulbul) | `bulbul:v3` | Natural regional speech synthesis at 8000Hz (Speaker: `shubh`) |
| **Telephony Gateway** | Exotel PSTN & Stream Applet | Cloud REST / WSS | Carrier-grade PSTN inbound/outbound call bridging with real-time WebSocket streaming |
| **Search / Provenance** | Tavily Search API | REST v1 | Automated discovery and verification of official government scheme circulars |
| **External Agent AI** | Lyzr AI Agent Studio | REST v3 | Secondary health entitlement gap analysis and document readiness evaluation |
| **Workflow Automation**| n8n Workflow Engine | Webhooks | Asynchronous event dispatching, follow-up polling, and overdue escalations |
| **Testing Framework** | Vitest | `3.0.6` | Comprehensive automated unit, integration, route, and audio codec test suite |
| **TypeScript** | TypeScript Compiler | `5.7.3` | Strict type safety across frontend, backend, and shared domain models |

---

## 8. Frontend Architecture

The frontend is organized under the Next.js 16 App Router hierarchy (`/frontend/app/`):

```
frontend/
├── app/
│   ├── layout.tsx             # Root HTML layout, font bindings, I18nProvider, AuthProvider
│   ├── page.tsx               # Public landing page with role-selection & scheme overview
│   ├── globals.css            # Custom CSS properties, theme design tokens, animations
│   ├── error.tsx              # Error boundary component
│   ├── loading.tsx            # Global route transition loader
│   ├── not-found.tsx          # 404 handler
│   ├── unauthorized/page.tsx  # Explicit 403 access denial screen
│   ├── auth/
│   │   ├── sign-in/page.tsx   # Multi-role sign-in & privileged registration tab
│   │   └── consent/page.tsx   # Mandatory data consent acceptance gate
│   ├── citizen/page.tsx       # Citizen Dashboard (Household, Family, Schemes, Actions)
│   ├── asha/page.tsx          # ASHA Workspace (Caseload, Requests, Follow-Ups, Drawer)
│   └── admin/page.tsx         # Admin Console (Oversight, Workforce, Scheme Registry)
├── components/
│   ├── assistant/             # HealthcareAssistantDrawer (Gemini chat)
│   ├── auth/                  # ProtectedRoute wrapper with RBAC & consent validation
│   ├── dev/                   # DevDiagnosticPanel (environment debug toggles)
│   ├── i18n/                  # LanguageSelector dropdown
│   ├── layout/                # AuthenticatedShell, Header, Footer, MobileNav
│   ├── ui/                    # Badge, Button, Card, Modal, Input, Textarea, StatusBadge
│   └── voice/                 # CitizenCallModal, AshaCallModal (PSTN trigger modals)
├── config/                    # env.ts, site.ts
├── hooks/                     # Custom UI & interaction hooks
├── i18n/                      # I18nContext, translation dictionaries (en.ts, kn.ts, hi.ts)
└── services/                  # Strongly-typed API client services wrapping fetch
```

### Complete Route Inventory

| Route Path | Access Boundary | Purpose & Major Sections | Consumed Backend APIs |
|---|---|---|---|
| `/` | Public | Landing page; hero banner, scheme overview, feature breakdown, role quick-start cards, language toggle | `GET /v1/schemes` |
| `/auth/sign-in` | Public (Unauthenticated) | Role-based sign-in tabs (Citizen, ASHA, Admin); password/phone credentials; registration secret input | `POST /v1/auth/prevalidate`, `POST /v1/auth/sync`, `POST /v1/auth/register` |
| `/auth/consent` | Authenticated (Pending Consent) | Statutory healthcare data consent agreement; terms of data sharing and privacy policy | `POST /v1/auth/consent`, `GET /v1/auth/me` |
| `/citizen` | Role: `CITIZEN` + Consented | Citizen Dashboard: Household profile card, Family members table, ASHA worker connection status, Recommended scheme cards, Next Steps priority action list | `GET /v1/households/me`, `GET /v1/eligibility/me`, `GET /v1/guidance/me`, `GET /v1/connections/citizen/status`, `POST /v1/assistance/requests`, `POST /v1/voice/citizen/request-call` |
| `/asha` | Role: `ASHA` + Consented | ASHA Workspace: Metric counters, Attention signal triage cards, Assigned household roster, Pending assistance requests, Follow-up scheduling list, Case inspection drawer | `GET /v1/cases/my-cases`, `GET /v1/cases/summary`, `GET /v1/cases/follow-ups/summary`, `GET /v1/assistance/requests/asha`, `PATCH /v1/cases/:id/tasks/:taskId/status`, `POST /v1/voice/asha/call-citizen` |
| `/admin` | Role: `ADMIN` + Consented | Admin Console: Platform metric KPIs, Complete household directory, ASHA workforce distribution table, Platform-wide case oversight, Scheme registry inspector, System health monitors | `GET /v1/admin/cases`, `GET /v1/admin/follow-ups`, `GET /v1/admin/automation/health`, `GET /v1/admin/voice/telemetry`, `POST /v1/admin/cases/assign` |
| `/unauthorized` | Authenticated | Explicit access denial screen displayed when an authenticated user attempts to access a route outside their RBAC privileges | None |

---

## 9. Landing Page & Public Experience

The public landing page (`/frontend/app/page.tsx`) serves as the entry point:

1. **Top Navigation Bar:** Contains the SwasthyaSetu branding, quick-navigation links (*About, Schemes, How It Works*), active Language Selector (English, ಕನ್ನಡ, हिन्दी), and the Primary Authentication CTA (*Sign In / Register*).
2. **Hero Section:** Clear value proposition highlighting universal healthcare entitlement discovery, assisted delivery through local ASHA workers, and feature-phone voice accessibility.
3. **Role Quick-Start Cards:**
   - *Citizen Card:* Highlights instant household eligibility checks and direct ASHA support.
   - *ASHA Worker Card:* Directs frontline health workers to caseload management and task tracking.
   - *Administrator Card:* Directs supervisory officers to the system oversight console.
4. **Verified Scheme Showcase:** Interactive card grid rendering authoritative schemes fetched dynamically from `GET /v1/schemes`, displaying benefit caps (e.g., ₹5,00,000 for PM-JAY), target demographics, and required documentation.
5. **Interactive Helpline Teaser:** Displays the national toll-free helpline number and explains the feature-phone callback mechanism.
6. **Active Session Detection:** If a user is already signed in with a valid token, the hero CTA dynamically converts from *Sign In* to *Go to Your Dashboard*, routing them to `/citizen`, `/asha`, or `/admin` based on their resolved role.

---

## 10. Authentication, Authorization & Consent Flow

### 10.1 Multi-Stage Authentication Flow

```
1. Citizen/Staff Enters Credentials on /auth/sign-in
       |
       v
2. If Privileged (ASHA or Admin):
   Client calls POST /api/v1/auth/prevalidate with { requestedRole, registrationSecret }
   Backend compares secret against SHA-256 hash environment variable
       |
       +--> If Invalid Secret: Rejects immediately with 401 Unauthorized
       |
       v
3. Firebase Client SDK Authenticates User (Email/Password or Phone Auth)
   Returns Firebase ID Token (JWT)
       |
       v
4. Client sends Bearer Token to POST /api/v1/auth/sync or /register
       |
       v
5. Fastify Auth Plugin verifies token with Firebase Admin SDK
   - Inspects decodedToken.uid
   - Retrieves or creates Firestore record in /users/{uid}
   - Assigns validated role (CITIZEN default, or ASHA/ADMIN if verified)
       |
       v
6. User Profile returned to Client with isConsentRequired flag
       |
       +--> If isConsentRequired == true: Redirect to /auth/consent
       +--> If isConsentRequired == false: Redirect to Role Portal (/citizen, /asha, /admin)
```

### 10.2 Server-Side Security Guards

Every protected API route in the Fastify backend is guarded by preHandler hooks defined in `backend/src/plugins/guards.ts`:

- **`requireAuth`:** Verifies the `Authorization: Bearer <token>` header against Firebase Admin. Binds `request.user` (decoded token) and `request.userProfile` (Firestore user record).
- **`requireRole(allowedRoles: UserRole[])`:** Inspects `request.userProfile.role`. If the role is not included in `allowedRoles`, halts execution immediately with HTTP 403 `INSUFFICIENT_ROLE`.
- **`requireConsent`:** Checks whether `request.userProfile.consent` is recorded for `CURRENT_CONSENT_VERSION` ("2026.1"). If not accepted, halts with HTTP 403 `CONSENT_REQUIRED`.

---

## 11. Citizen Portal Functional Specification

Accessible exclusively to users with role `CITIZEN` at `/citizen`.

### 11.1 Household Profile Management
- **Household Head Information:** Head of Household full name, contact phone number, and gender.
- **Socio-Economic Classification:** Ration card category selection (`BPL` - Below Poverty Line, `AAY` - Antyodaya Anna Yojana, `APL` - Above Poverty Line, `NON_RATION`).
- **Location Hierarchy:** State, district, taluk/block, village/ward, and PIN code.
- **Ration Card Tracking:** Registered ration card number used for cross-referencing public beneficiary registries and verifying voice caller identity.

### 11.2 Family Member Roster
- **Member Attributes:** Full name, relationship to head (Self, Spouse, Son, Daughter, Father, Mother, Grandfather, Grandmother), age in years, and gender.
- **Vulnerability & Healthcare Indicators:**
  - `isPregnant`: Boolean flag indicating active pregnancy.
  - `isLactating`: Boolean flag indicating nursing mother (postpartum < 6 months).
  - `hasDisability`: Boolean flag indicating physical or sensory disability.
  - `hasChronicIllness`: Boolean flag for non-communicable disease tracking.
- **Automatic Triggers:** Updating family member attributes immediately invalidates cached eligibility and triggers a re-evaluation across all active schemes.

### 11.3 ASHA Worker Connection Card
- **Connection Status:** Displays current linkage state (`NONE`, `PENDING`, `ACTIVE`, `REJECTED`).
- **Linked Worker Details:** If connected, displays the designated ASHA worker’s full name, assigned service code (e.g., `ASHA-BLR-042`), operational jurisdiction, and official contact phone.
- **Connection Actions:** Allows the citizen to search for an ASHA worker by service code and transmit a connection request, or revoke an existing connection.

### 11.4 Recommended Schemes & Entitlement Status
- **Dynamic Scheme Cards:** Displays all schemes for which at least one household member is determined `ELIGIBLE` or `NEEDS_MORE_INFO`.
- **Card Content:** Scheme official name, authority, maximum financial coverage (e.g. ₹5 Lakhs for PM-JAY, ₹1,400–₹6,000 for JSY), qualifying household members, required document checklist, and official policy source citation.
- **Request ASHA Assistance CTA:** Directly embedded button on every eligible scheme card allowing the citizen to request physical home assistance from their linked ASHA worker with one click.

### 11.5 Next Steps & Priority Action Checklist
- **Deterministic Action Prioritization:** Consolidates all required enrollment steps across eligible schemes into an ordered action list (e.g., *"Complete 70+ Senior Citizen e-KYC on Ayushman App for Eerappa"*).
- **Status Badges:** Clearly delineates items requiring citizen action versus items pending ASHA verification.

### 11.6 PSTN Callback Modal & Voice Assistant
- **PSTN Callback Trigger:** Embedded modal (`CitizenCallModal`) allowing the citizen to confirm their phone number and preferred language (English, Kannada, Hindi) to request an immediate outbound phone call from the SwasthyaSetu voice assistant.
- **In-Browser Gemini Assistant Drawer:** Slide-out drawer (`HealthcareAssistantDrawer`) allowing the citizen to type or speak questions in natural language, receiving responses strictly grounded in their household's actual members and eligibility.

---

## 12. ASHA Workspace Functional Specification

Accessible to users with role `ASHA` or `ADMIN` at `/asha`.

### 12.1 Operational Metric Dashboard
- **Total Assigned Caseload:** Total count of registered households under the worker's jurisdiction.
- **Active Cases:** Number of households with ongoing assistance workflows.
- **Attention Signals:** Number of households with unaddressed health entitlement gaps.
- **Due Follow-Ups:** Number of scheduled field visits due today or overdue.

### 12.2 Attention Signal Triage
- **Proactive Gap Detection:** Evaluates household profiles to highlight vulnerable conditions:
  - Senior citizens (70+) lacking Ayushman Vay Vandana card generation.
  - Pregnant mothers without registered MCP cards or JSY institutional delivery linkages.
  - Low-income households with pending document submissions.
- **One-Click Case Initiation:** Allows the ASHA worker to convert an attention signal directly into an active tracked case.

### 12.3 Caseload Directory & Search
- **Search & Filters:** Real-time filtering of assigned households by family head name, ration card number, or village.
- **Household Health Cards:** Compact cards rendering family size, head of household, income category, active cases, and contact details.
- **Call Citizen Action:** Embedded modal (`AshaCallModal`) allowing the worker to trigger an assisted telephony call to the beneficiary household.

### 12.4 Assistance Request Management
- **Citizen Request Inbox:** Lists incoming assistance requests submitted by citizens via their portal or telephony calls.
- **Workflow Actions:**
  - *Accept Request:* Binds the request to the household’s active case (or creates a new case) and initializes standard milestone tasks.
  - *Decline Request:* Records a mandatory administrative explanation note and notifies the citizen.
  - *Resolve Request:* Marks the workflow completed upon successful benefit receipt.

### 12.5 Case Detail Inspection Drawer
Clicking any case opens the comprehensive Case Detail Drawer containing five functional tabs:
1. **Journey & Milestones:** Visual progress tracker showing the current journey stage (e.g., `DOCUMENT_COLLECTION` → `VERIFICATION` → `ENROLMENT` → `CARD_ISSUANCE` → `BENEFIT_DELIVERY`).
2. **Tasks Checklist:** Granular actionable tasks (e.g., *"Collect Aadhaar Card of Grandfather"*, *"Submit MCP card copy to PHC"*). Workers can toggle tasks between `PENDING`, `IN_PROGRESS`, `COMPLETED`, and `BLOCKED`.
3. **Follow-Up Visits:** Interface to schedule upcoming home visits with a specific date, time, and visit agenda.
4. **Field Notes:** Chronological audit log of notes recorded by the worker during home visits.
5. **Beneficiary Profile:** Household roster and deterministic scheme eligibility summary.

### 12.6 Field Registration Flow
- **In-Field Household Onboarding:** Allows ASHA workers to register new households encountered during field surveys directly from their workspace, capturing ration details, family members, and health indicators without requiring prior citizen self-registration.

---

## 13. Admin Console Functional Specification

Accessible exclusively to users with role `ADMIN` at `/admin`.

### 13.1 Platform Overview Dashboard
- Aggregates platform-wide Key Performance Indicators (KPIs): Total Registered Households, Total ASHA Workforce, Active Caseloads, Total Completed Follow-Ups, and System Operational Health.

### 13.2 Complete Household Directory
- Full-text search and multi-parameter filtering across all registered households in the database.
- Provides supervisory inspection of household members, assigned ASHA workers, and active cases.

### 13.3 ASHA Workforce Management
- Tabular roster of all registered ASHA workers, displaying their unique service codes, assigned jurisdictions (state, district, taluk), active case counts, and overdue visit ratios.
- **Case Reassignment:** Administrative modal to reassign households or individual cases from an overloaded or absent worker to another active worker.

### 13.4 Platform-Wide Case Oversight
- Real-time audit stream of all cases across the system.
- Ability to filter by priority (`URGENT`, `HIGH`, `NORMAL`, `LOW`) and status (`BLOCKED`, `NEEDS_ATTENTION`, `IN_PROGRESS`).
- Direct access to inspect journey blockers, overdue follow-ups, and field notes.

### 13.5 Scheme Registry & Policy Governance
- Comprehensive inspector for all registered health schemes and ruleset versions.
- Displays administrative authority, benefit summaries, required document lists, and official government policy citations.

### 13.6 System Monitoring & Telemetry
- **API & Service Health:** Live connection status for Firestore, Sarvam AI, Exotel Telephony, and n8n Webhooks.
- **Voice Telemetry:** Call completion rates, turn distribution metrics, average latency per speech turn, and error rate tracking.
- **Automation Orchestration Telemetry:** Live health status of the n8n webhook dispatcher, displaying recent domain event dispatches, payload deliveries, and retry states.

---

## 14. Healthcare Scheme & Deterministic Eligibility Engine

SwasthyaSetu implements an authoritative, deterministic rule engine (`backend/src/services/eligibility/rule-engine.ts`) to ensure zero hallucinations in welfare allocation.

### 14.1 Verified Production Schemes

```
+---------------------------------------------------------------------------------------------------+
| 1. Ayushman Bharat - PMJAY (ab-pmjay)                                                             |
| Authority: National Health Authority (NHA), MoHFW, Government of India                            |
| Benefit: Up to ₹5,00,000 yearly hospitalization coverage per family across empaneled hospitals.   |
| Pathways:                                                                                         |
|   a) Universal 70+ Senior Citizen Pathway: Any citizen aged >= 70 years is deterministically      |
|      ELIGIBLE regardless of income, caste, or socio-economic criteria.                            |
|   b) Socio-Economic Pathway: Households categorized as BPL or AAY are ELIGIBLE.                   |
| Required Documents: Aadhaar Card (with e-KYC on Ayushman App), Ration Card.                       |
+---------------------------------------------------------------------------------------------------+
| 2. Janani Suraksha Yojana - JSY (jsy)                                                             |
| Authority: Ministry of Health and Family Welfare (MoHFW), Government of India                     |
| Benefit: Cash assistance (₹1,400 in rural / ₹1,000 in urban) for institutional delivery.          |
| Criteria: Any female household member who is actively pregnant (isPregnant == true) or lactating. |
| Required Documents: Mother & Child Protection (MCP) Card, Bank Passbook linked to Aadhaar.        |
+---------------------------------------------------------------------------------------------------+
| 3. Janani Shishu Suraksha Karyakram - JSSK (jssk)                                                 |
| Authority: Ministry of Health and Family Welfare (MoHFW), Government of India                     |
| Benefit: 100% completely free and cashless delivery and pediatric care up to 1 year of age.       |
| Criteria: Active pregnancy, nursing mothers, or infants aged <= 1 year.                           |
| Required Documents: Hospital Admission Slip, Government Hospital MCP Card.                       |
+---------------------------------------------------------------------------------------------------+
| 4. State Health Assurance Scheme (state-health-assurance)                                         |
| Authority: State Department of Health and Family Welfare                                          |
| Benefit: Secondary and tertiary hospitalization cover supplementing central schemes.             |
| Criteria: Household possesses valid state residency and BPL / NFSA ration card.                   |
| Required Documents: State Ration Card, Income Certificate.                                        |
+---------------------------------------------------------------------------------------------------+
| 5. Ayushman Bharat - Arogya Karnataka - AB-ARK (ab-ark-karnataka)                                 |
| Authority: Suvarna Arogya Suraksha Trust (SAST), Government of Karnataka                          |
| Benefit: Cashless co-branded health protection for Karnataka residents up to ₹5,00,000.           |
| Criteria: State residency in Karnataka AND valid NFSA Ration Card (BPL/AAY).                      |
| Required Documents: Karnataka Ration Card (BPL/AAY), Aadhaar Card.                                |
+---------------------------------------------------------------------------------------------------+
```

### 14.2 Deterministic Evaluation Logic
The evaluation engine processes a household document through the following sequence:
1. **Household Evaluation:** Evaluates household-level attributes (state of residence, income/ration category).
2. **Member-Level Evaluation:** Iterates through every family member in the household:
   - Evaluates age boundaries (e.g. `age >= 70`).
   - Evaluates maternal indicators (`isPregnant`, `isLactating`).
   - Evaluates vulnerability tags (`hasDisability`, `hasChronicIllness`).
3. **Condition Classification:** Evaluates rules using strict Boolean logic:
   - `ELIGIBLE`: All mandatory criteria satisfied. Returns qualifying member ID, benefit details, and action plan.
   - `NEEDS_MORE_INFO`: Potential entitlement identified, but critical documentation or age/income verification is pending.
   - `NOT_ELIGIBLE`: Deterministic criteria failed. Generates an explicit explanation (e.g., *"Household income category APL does not meet BPL requirements, and no senior citizens aged 70+ reside in the household"*).
4. **Action Plan Synthesis:** Maps every eligible scheme directly to required documents and concrete next steps.

---

## 15. Case Management & Beneficiary Journey Engine

The case engine (`backend/src/services/case.service.ts`) governs the operational lifecycle of assisted delivery:

### 15.1 Case Lifecycle State Machine

```
              [Assistance Request Accepted OR Field Registration]
                                       |
                                       v
                                  +---------+
                                  |   NEW   |
                                  +---------+
                                       |
                                       | Worker reviews record
                                       v
                                  +---------+
                 +--------------> | ACTIVE  | <--------------+
                 |                +---------+                |
                 |                     |                     |
                 | Task in progress    | Milestone blocked   | Task unblocked
                 v                     v                     |
          +-------------+       +-------------+              |
          | IN_PROGRESS |       |   BLOCKED   | -------------+
          +-------------+       +-------------+
                 |                     |
                 | Action needed       | Critical failure
                 v                     v
          +------------------+  +-------------+
          | NEEDS_ATTENTION  |  |  ESCALATED  |
          +------------------+  +-------------+
                 |                     |
                 | Follow-up due       | Resolved by Admin
                 v                     v
          +------------------+  +-------------+
          |FOLLOW_UP_REQUIRED|  |  RESOLVED   |
          +------------------+  +-------------+
                                       |
                                       | Case closed
                                       v
                                  +---------+
                                  | CLOSED  |
                                  +---------+
```

### 15.2 Case Data Structure & Subcollections
Each case document in `/cases/{caseId}` maintains:
- `householdId`: Reference to target household.
- `assignedAshaUid`: UID of the assigned frontline worker.
- `status`: Current `CaseStatus` enum.
- `priority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- `schemeId` & `beneficiaryMemberId`: Optional linkage to specific scheme and member.
- **Subcollections:**
  - `/cases/{caseId}/tasks`: Ordered checklist of action items.
  - `/cases/{caseId}/followups`: Scheduled home visits and calls.
  - `/cases/{caseId}/notes`: Field visit notes with timestamps and author metadata.
  - `/cases/{caseId}/activities`: Immutable audit trail of every status change and assignment.

---

## 16. Assistance Request & Connection Lifecycle

### 16.1 Citizen-to-ASHA Connection Lifecycle
1. **Search:** Citizen queries public ASHA directory (`GET /v1/connections/directory/ashas`).
2. **Request Link:** Citizen submits connection request using ASHA service code (`POST /v1/connections/citizen/link`). Connection status set to `PENDING`.
3. **ASHA Review:** ASHA reviews pending link requests in their workspace (`GET /v1/connections/asha/requests`).
4. **Accept / Reject:** ASHA accepts (`POST /v1/connections/asha/requests/:id/respond`). Connection becomes `ACTIVE`. The citizen's household is now linked to the ASHA worker's caseload.

### 16.2 Assistance Request Flow
1. **Citizen Request:** Citizen clicks *"Request ASHA Assistance"* on a scheme card (`POST /v1/assistance/requests`).
2. **Inbox Notification:** ASHA receives the request in their workspace inbox (`GET /v1/assistance/requests/asha`).
3. **Action:**
   - *Accept (`POST /v1/assistance/requests/:id/accept`):* The system automatically creates a new tracked `AshaCase` (or binds to an existing active case), initializes scheme journey milestones, and links the request.
   - *Decline (`POST /v1/assistance/requests/:id/decline`):* Records the decline reason and notifies the citizen.

---

## 17. Follow-Up & Scheduling Subsystem

Follow-ups represent scheduled real-world interactions between frontline workers and beneficiaries.

### 17.1 Categorization Rules
The system evaluates `dueAt` timestamps relative to the local operational date (`todayStr` in `Asia/Kolkata`):
- **`Due Today`:** Status is `PENDING` AND date matches current calendar day (`dueDateStr == todayStr`).
- **`Overdue`:** Status is `PENDING` AND `dueDate < now` AND date is strictly prior to today (`dueDate < now && !isToday`).
- **`Upcoming`:** Status is `PENDING` AND `dueDate > today`.
- **`Completed`:** Status is `COMPLETED` (`completedAt` populated).
- **`Cancelled`:** Status is `CANCELLED` (`cancelReason` populated).

### 17.2 Actions
- **Mark Complete (`PATCH /v1/cases/:id/follow-ups/:followUpId/status`):** Sets status to `COMPLETED`, records outcome notes, and updates case `lastContactAt`.
- **Reschedule (`PATCH /v1/cases/:id/follow-ups/:followUpId/reschedule`):** Sets new `dueAt` date and records mandatory rescheduling rationale.
- **Cancel:** Marks visit cancelled with recorded reason.

---

## 18. Multilingual Website & UI Localization (Phase E)

The web frontend implements complete trilingual parity across **English (`en`)**, **ಕನ್ನಡ (Kannada, `kn`)**, and **हिन्दी (Hindi, `hi`)**.

### 18.1 Implementation Architecture
- **Central Context:** `I18nContext` (`frontend/i18n/i18n-context.tsx`) provides the `useTranslation()` hook.
- **Dictionary Files:**
  - `frontend/i18n/translations/en.ts`: English baseline (18 KB).
  - `frontend/i18n/translations/kn.ts`: Complete Kannada translations (34 KB).
  - `frontend/i18n/translations/hi.ts`: Complete Hindi translations (33 KB).
- **Key Namespace Structure:** Dictionaries are structured by functional areas: `nav`, `landing`, `auth`, `citizen`, `asha`, `admin`, `voice`, `schemes`, and `common`.
- **Dynamic Variable Interpolation:** Supports template placeholders (e.g., `t("voice.verifyingIdentity", { name: "Ramesh" })`).
- **Persistence:** Selected language is stored in browser `localStorage` (`swasthyasetu_lang`), defaulting to `en`.

---

## 19. Sarvam Multilingual Voice Architecture (Phase F & Phase 11)

SwasthyaSetu’s voice assistant operates natively across **English (`en-IN`)**, **ಕನ್ನಡ (`kn-IN`)**, and **हिन्दी (`hi-IN`)**.

### 19.1 Website-to-Voice Language Binding & Precedence Rules
A common failure in voice telephony is language flapping caused by carrier defaults. SwasthyaSetu resolves this via **Authoritative Session Precedence**:

```
Precedence Hierarchy:
1. Explicit Pre-Existing VoiceSession Language (Set when citizen clicked "Call" on website)
   [HIGHEST PRIORITY - IMMUTABLE ONCE BOUND]
2. Valid Exotel Start Event Custom Parameter (kn-IN | hi-IN | en-IN)
3. Persisted User Language Preference
4. Safe Default: en-IN [FALLBACK]
```

When a citizen on the Kannada website (`lang = kn`) clicks *"Call Assistant"*, the client calls `requestCitizenCall({ language: "kn-IN" })`. The backend creates a `VoiceSession` with `language = "kn-IN"`. When Exotel dials the phone and connects the WebSocket, Exotel’s generic start event metadata (which might default to Hindi or English) is **strictly overridden** by the pre-existing session's `kn-IN` language.

---

## 20. End-to-End PSTN Voice Call Flow

```
1. Citizen triggers call via website UI or dials inbound virtual number
2. Exotel PSTN connects call and initiates WebSocket to /api/v1/voice/stream
3. Fastify WebSocket receives connection
4. Exotel sends 'connected' event
5. Exotel sends 'start' event with streamSid and callSid
6. ExotelStreamGateway binds streamSid to VoiceSession and locks authoritative language
7. Initial greeting synthesized via Sarvam Bulbul TTS in session language
8. Audio transcoded to 8kHz μ-law, chunked into 160-byte frames, and sent to Exotel
9. Caller hears greeting through regular mobile phone receiver
10. Caller speaks (e.g., "ನನಗೆ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಯೋಜನೆ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು")
11. Exotel streams 20ms incoming μ-law media chunks to WebSocket
12. ExotelStreamGateway computes RMS audio energy for Voice Activity Detection (VAD)
13. Silence threshold detected (~900ms silence after speech) -> triggers speech turn
14. Media chunks assembled into 8kHz 16-bit linear PCM WAV container
15. Audio sent to Sarvam Saaras STT API with language_code = session.language
16. Saaras STT returns native transcript
17. SarvamService parses intent (e.g. CHECK_SCHEMES) and extracts entities
18. VoiceActionService executes deterministic healthcare logic
19. VoiceResponseFormatter generates empathetic natural spoken text in session language
20. Text sent to Sarvam Bulbul TTS API with target_language_code and 8000Hz rate
21. Bulbul returns 8kHz WAV; audio-codec extracts PCM and converts to μ-law
22. μ-law chunks streamed back to Exotel over WebSocket
23. Caller hears localized response; loop continues until farewell or hangup
```

---

## 21. Sarvam Saaras Speech-to-Text (STT) Specification

- **Provider:** Sarvam AI
- **Model:** `saaras:v3`
- **Endpoint:** `https://api.sarvam.ai/speech-to-text`
- **Supported Telephony Languages:** `en-IN`, `kn-IN`, `hi-IN`
- **Audio Input Container:** Standard 44-byte RIFF header 8000Hz 16-bit Linear PCM Mono WAV (`mulawToWav()`).
- **Request Format:** `multipart/form-data` with `file` buffer, `model = "saaras:v3"`, and explicit `language_code`.
- **Error Handling:** 500ms timeout safeguards, graceful handling of empty transcripts (background noise rejection), and safe error logging without credential leakage.

---

## 22. Sarvam Bulbul Text-to-Speech (TTS) Specification

- **Provider:** Sarvam AI
- **Model:** `bulbul:v3`
- **Endpoint:** `https://api.sarvam.ai/text-to-speech`
- **Speaker:** `shubh`
- **Configured Sample Rate:** `8000` (Direct telephony sample rate)
- **Supported Target Languages:** `en-IN`, `kn-IN`, `hi-IN`
- **Payload:** JSON with `inputs: [text]`, `target_language_code`, `speaker = "shubh"`, and `speech_sample_rate = 8000`.
- **Response Processing:** Extracts base64 audio string, strips WAV RIFF container, and converts 16-bit Linear PCM samples directly to G.711 μ-law bytes.

---

## 23. Voice Assistant Conversational Intelligence

### 23.1 Supported Voice Intents

| Intent Type | Example Spoken Input (Kannada / Hindi / English) | Triggered Healthcare Logic |
|---|---|---|
| `GREETING` | "ನಮಸ್ಕಾರ" / "नमस्ते" / "Hello" | Returns localized helpline welcome prompt |
| `CHECK_SCHEMES` | "ಯೋಜನೆ ಮಾಹಿತಿ ಬೇಕು" / "योजना की जानकारी" / "Tell me about schemes" | Returns public summary of PM-JAY and JSY |
| `CHECK_ELIGIBILITY` | "ನನ್ನ ತಾತನಿಗೆ 71 ವರ್ಷ, ಆಯುಷ್ಮಾನ್ ಬರುತ್ತಾ?" / "Kya dada eligible hain?" | Deterministically evaluates senior 70+ PM-JAY rule |
| `REQUEST_ASSISTANCE`| "ನನಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಆಶಾ ಸಹಾಯ ಬೇಕು" / "Form bharne me madad chahiye"| Creates assistance request and binds active case |
| `CHECK_ASSISTANCE_STATUS`| "ನನ್ನ ಕೇಸ್ ಸ್ಥಿತಿ ಏನು?" / "Mera case status kya hai?" | Checks case journey step and completed task counts |
| `CHECK_FOLLOW_UP` | "ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಯಾವಾಗ ಬರುತ್ತಾರೆ?" / "Next visit kab hai?" | Checks scheduled date of upcoming home follow-up |
| `CONTACT_ASHA` | "ಆಶಾ ಅವರ ಫೋನ್ ನಂಬರ್ ಬೇಕು" / "ASHA ka number chahiye" | Returns linked ASHA worker name and phone |
| `VERIFY_IDENTITY` | "ನನ್ನ ರೇಷನ್ ಕಾರ್ಡ್ 4821" / "Mera code 4821 hai" | Verifies caller identity against household ration card |
| `EMERGENCY` | "ಆಂಬ್ಯುಲೆನ್ಸ್ ಬೇಕು, ತುರ್ತು ಪರಿಸ್ಥಿತಿ" / "Emergency ambulance chahiye"| Immediate redirection to national 108 / 102 lines |
| `END_CALL` | "ಧನ್ಯವಾದಗಳು, ಇಷ್ಟೇ" / "Bas itna hi, dhanyawad" | Localized farewell and clean call termination |

### 23.2 Code-Switching & Kanglish / Hinglish Tolerance
Beneficiaries routinely mix English administrative terms into regional speech (e.g., *"Ayushman Bharat scheme ಬಗ್ಗೆ information ಬೇಕು"* or *"Mujhe PM-JAY scheme ke baare mein help chahiye"*).
The intent parser in `sarvam.service.ts` uses word-boundary regexes and phonetic matches across mixed vocabulary while **strictly locking session language**—preventing code-switched queries from accidentally flipping the speech output to English.

---

## 24. Telephony Audio Pipeline & Codec Transcoding

Telephony carriers (PSTN) exchange audio strictly formatted as **ITU-T G.711 μ-law (PCMU)** at **8000 Hz** mono, packaged into **20ms frames**.

### 24.1 Precomputed ITU-T G.711 Transcoding Table
To guarantee zero garbage-collection latency on audio frames, `backend/src/services/telephony/audio-codec.ts` utilizes a precomputed 256-entry lookup table (`MULAW_TO_LINEAR_TABLE`):

```typescript
const MULAW_TO_LINEAR_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const byte = ~i & 0xff;
  const sign = byte & 0x80;
  const exponent = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_TO_LINEAR_TABLE[i] = sign !== 0 ? -sample : sample;
}
```

### 24.2 Frame Invariants
- **Sampling Rate:** 8,000 samples per second.
- **Frame Duration:** 20 milliseconds (50 frames per second).
- **μ-law Frame Size:** `8000 * 1 byte * 0.02s = 160 bytes` (`FRAME_CHUNK_SIZE_MULAW`).
- **Linear PCM Frame Size:** `8000 * 2 bytes * 0.02s = 320 bytes` (`FRAME_CHUNK_SIZE_PCM`).
- **WAV Packaging:** 44-byte standard RIFF header synthesized on the fly for STT submission.

---

## 25. Exotel Telephony & WebSocket Streaming Integration

- **Inbound PSTN Webhook:** `POST /api/v1/voice/webhooks/exotel/inbound` returns Exotel Voice Applet HTTP instructions.
- **Call Status Callback:** `POST /api/v1/voice/callbacks/exotel/status` records telephony call outcomes (`completed`, `busy`, `no-answer`).
- **WebSocket Streaming Route:** `GET /api/v1/voice/stream` with `{ websocket: true }`.
- **Exotel Protocol Event Handling:**
  - `connected`: Handshake event logging initial connection.
  - `start`: Binds `streamSid` and `callSid`, initializes audio buffers, locks authoritative language, and triggers the initial greeting.
  - `media`: Transports base64-encoded 20ms μ-law audio frames from caller.
  - `mark`: Marker tracking indicating Exotel has finished playing back a specific audio block.
  - `stop`: Signals call termination; triggers resource cleanup, timer clearance, and session persistence.

---

## 26. n8n Automation & Domain Event Architecture

The automation subsystem (`backend/src/services/automation/automation.service.ts`) dispatches asynchronous domain events to an external **n8n Workflow Engine**.

### 26.1 Core Non-Blocking Invariant
SwasthyaSetu remains the authoritative source of truth. If the `N8N_WEBHOOK_URL` is unset, unreachable, or fails, the core system continues execution normally without throwing unhandled exceptions or degrading user response times.

### 26.2 Verified n8n Workflows (`/docs/n8n-workflows/`)
1. **`SwasthyaSetu_Case_Lifecycle_Orchestrator.json`:** Listens for `CASE_CREATED`, `TASK_COMPLETED`, and `CASE_SCHEME_INITIATED` events to update external caseload metrics.
2. **`SwasthyaSetu_Due_FollowUp_Poller.json`:** Periodically queries `GET /api/v1/automation/due-follow-ups` to discover pending home visits.
3. **`SwasthyaSetu_FollowUp_Dispatcher.json`:** Dispatches reminder notifications for upcoming visits.
4. **`SwasthyaSetu_Overdue_Escalator.json`:** Detects overdue visits (`isOverdue == true`) and triggers administrative escalations.
5. **`SwasthyaSetu_Voice_FollowUp_Caller.json`:** Automates outbound telephony follow-up calls via Exotel for critical maternal and senior citizen reminders.

---

## 27. Database & Firestore Data Model

The platform utilizes Google Cloud Firestore with strict document schemas:

```
Firestore Database Root
├── /users/{uid}                                    # User profiles (Citizen, ASHA, Admin)
│   └── /consent_history/{consentId}               # Immutable user consent audit records
├── /households/{householdId}                       # Household socio-economic profiles
│   └── /members/{memberId}                        # Individual family members & health tags
├── /schemes/{schemeId}                             # Master scheme registry
│   └── /versions/{versionId}                      # Versioned scheme rulesets
├── /cases/{caseId}                                 # Frontline ASHA caseload records
│   ├── /tasks/{taskId}                            # Actionable milestone tasks
│   ├── /followups/{followUpId}                    # Scheduled field home visits
│   ├── /notes/{noteId}                            # ASHA field visit notes
│   └── /activities/{activityId}                   # Immutable case audit events
├── /connections/{connectionId}                     # Citizen <-> ASHA linkage records
├── /assistance_requests/{requestId}                # Citizen scheme assistance requests
├── /voice_sessions/{sessionId}                     # Telephony voice session metadata
├── /evidence/{evidenceId}                          # Verified policy circulars & evidence
├── /evidence_search_cache/{queryHash}              # Tavily search result cache
├── /evidence_conflicts/{conflictId}                # Flagged policy conflicts for admin review
├── /evidence_audit_logs/{logId}                    # Evidence governance audit trail
└── /ai_intelligence_cache/{cacheKey}               # Cached Lyzr/Gemini reasoning responses
```

---

## 28. Complete API Specification

All endpoints are mounted under `/api/v1/` (or `/health`):

### 28.1 Health & Diagnostics
- `GET /health` | Public | System uptime, node environment, timestamp.
- `GET /v1/health` | Public | Service health check.

### 28.2 Authentication & User Governance
- `POST /v1/auth/prevalidate` | Public | Validates staff registration secret before Firebase account creation.
- `POST /v1/auth/sync` | `requireAuth` | Idempotently creates/syncs user profile without role clobbering.
- `POST /v1/auth/register` | `requireAuth` | Explicit registration for citizen or prevalidated staff.
- `GET /v1/auth/me` | `requireAuth` | Returns authenticated user profile and consent status.
- `POST /v1/auth/consent` | `requireAuth` | Records statutory data consent agreement.
- `POST /v1/auth/role/assign` | `requireRole(["ADMIN"])` | Assigns platform role to target user.

### 28.3 Household & Family Management
- `POST /v1/households` | `requireRole(["CITIZEN"])` | Creates household socio-economic profile.
- `GET /v1/households/me` | `requireRole(["CITIZEN"])` | Retrieves authenticated citizen's household.
- `PATCH /v1/households/me` | `requireRole(["CITIZEN"])` | Updates household metadata.
- `POST /v1/households/me/members` | `requireRole(["CITIZEN"])` | Adds family member to household.
- `GET /v1/households/me/members` | `requireRole(["CITIZEN"])` | Lists family members in household.
- `PATCH /v1/households/me/members/:memberId` | `requireRole(["CITIZEN"])` | Updates family member attributes.
- `DELETE /v1/households/me/members/:memberId` | `requireRole(["CITIZEN"])` | Removes family member from household.
- `GET /v1/admin/households` | `requireRole(["ADMIN"])` | Lists all platform households.
- `GET /v1/admin/households/:id` | `requireRole(["ADMIN"])` | Retrieves specific household details.

### 28.4 Scheme Registry & Eligibility
- `GET /v1/schemes` | Public | Lists all active welfare schemes.
- `GET /v1/schemes/:id` | Public | Retrieves specific scheme details and ruleset.
- `GET /v1/eligibility/me` | `requireRole(["CITIZEN"])` | Deterministically evaluates citizen's household.
- `POST /v1/eligibility/evaluate` | `requireAuth` | Evaluates arbitrary household payload against rulesets.
- `GET /v1/guidance/me` | `requireRole(["CITIZEN"])` | Retrieves prioritized action plan for citizen.

### 28.5 ASHA Connection & Caseload
- `GET /v1/connections/directory/ashas` | `requireAuth` | Searches public ASHA worker directory.
- `POST /v1/connections/citizen/link` | `requireRole(["CITIZEN"])` | Requests linkage to ASHA worker.
- `GET /v1/connections/citizen/status` | `requireRole(["CITIZEN"])` | Checks current ASHA linkage status.
- `GET /v1/connections/asha/requests` | `requireRole(["ASHA", "ADMIN"])` | Lists pending linkage requests.
- `POST /v1/connections/asha/requests/:id/respond` | `requireRole(["ASHA", "ADMIN"])` | Accepts or declines linkage request.
- `GET /v1/connections/asha/caseload` | `requireRole(["ASHA", "ADMIN"])` | Lists connected households.
- `POST /v1/connections/citizen/revoke` | `requireRole(["CITIZEN"])` | Revokes ASHA connection.

### 28.6 Assistance Requests & Case Management
- `POST /v1/assistance/requests` | `requireRole(["CITIZEN"])` | Submits scheme assistance request.
- `GET /v1/assistance/requests/citizen` | `requireRole(["CITIZEN"])` | Lists citizen's assistance requests.
- `GET /v1/assistance/requests/asha` | `requireRole(["ASHA", "ADMIN"])` | Lists incoming requests for worker.
- `POST /v1/assistance/requests/:id/accept` | `requireRole(["ASHA", "ADMIN"])` | Accepts request and creates/binds Case.
- `POST /v1/assistance/requests/:id/decline` | `requireRole(["ASHA", "ADMIN"])` | Declines request with reason note.
- `GET /v1/cases/my-cases` | `requireRole(["ASHA", "ADMIN"])` | Lists assigned cases for worker.
- `POST /v1/cases/field-register` | `requireRole(["ASHA", "ADMIN"])` | Registers new household during field visit.
- `GET /v1/cases/summary` | `requireRole(["ASHA", "ADMIN"])` | Returns caseload KPI metrics.
- `GET /v1/cases/:id` | `requireRole(["ASHA", "ADMIN"])` | Retrieves full case detail with tasks and visits.
- `PATCH /v1/cases/:id/status` | `requireRole(["ASHA", "ADMIN"])` | Updates case lifecycle status.
- `POST /v1/cases/:id/tasks` | `requireRole(["ASHA", "ADMIN"])` | Adds task to case checklist.
- `PATCH /v1/cases/:id/tasks/:taskId/status` | `requireRole(["ASHA", "ADMIN"])` | Updates task status.
- `POST /v1/cases/:id/follow-ups` | `requireRole(["ASHA", "ADMIN"])` | Schedules home follow-up visit.
- `GET /v1/cases/follow-ups/summary` | `requireRole(["ASHA", "ADMIN"])` | Categorized follow-up summary.
- `PATCH /v1/cases/:id/follow-ups/:followUpId/status` | `requireRole(["ASHA", "ADMIN"])` | Marks visit completed/cancelled.
- `PATCH /v1/cases/:id/follow-ups/:followUpId/reschedule` | `requireRole(["ASHA", "ADMIN"])` | Reschedules follow-up visit.
- `POST /v1/cases/:id/notes` | `requireRole(["ASHA", "ADMIN"])` | Adds field visit note.
- `GET /v1/admin/cases` | `requireRole(["ADMIN"])` | Admin oversight of all platform cases.
- `POST /v1/admin/cases/assign` | `requireRole(["ADMIN"])` | Admin reassigns case to ASHA worker.
- `GET /v1/admin/follow-ups` | `requireRole(["ADMIN"])` | Admin oversight of all platform follow-ups.

### 28.7 Voice & Telephony
- `GET /v1/voice/stream` | Public (WebSocket) | Full-duplex Exotel audio streaming gateway.
- `GET /v1/voice/config` | Public | Returns public voice helpline metadata without secrets.
- `POST /v1/voice/webhooks/exotel/inbound` | Public (Exotel) | Exotel inbound call routing webhook.
- `POST /v1/voice/callbacks/exotel/status` | Public (Exotel) | Exotel call status outcome webhook.
- `POST /v1/voice/sessions` | Public / System | Creates voice session and binds language.
- `GET /v1/voice/sessions/:id` | `requireAuth` | Retrieves voice session metadata.
- `POST /v1/voice/sessions/:id/turn` | `requireAuth` | Processes single conversational voice turn.
- `POST /v1/voice/sessions/:id/verify` | `requireAuth` | Verifies identity via ration card digits.
- `POST /v1/voice/citizen/request-call` | `requireRole(["CITIZEN"])` | Citizen requests immediate voice callback.
- `GET /v1/voice/citizen/calls` | `requireRole(["CITIZEN"])` | Retrieves citizen's call history.
- `POST /v1/voice/asha/call-citizen` | `requireRole(["ASHA", "ADMIN"])` | ASHA triggers call to beneficiary.
- `GET /v1/voice/cases/:caseId/calls` | `requireRole(["ASHA", "ADMIN"])` | Call logs linked to specific case.
- `POST /v1/voice/outbound` | `requireRole(["ADMIN"])` | System triggers outbound automated reminder call.
- `GET /v1/admin/voice/telemetry` | `requireRole(["ADMIN"])` | Admin voice system metrics and error logs.

### 28.8 Automation & n8n Webhooks
- `POST /v1/automation/webhook` | Authenticated Webhook | Inbound webhook from n8n orchestrator.
- `GET /v1/automation/due-follow-ups` | Authenticated Webhook | Polls due visits for n8n automation.
- `GET /v1/automation/cases/:caseId/follow-ups/:followUpId/status` | Authenticated Webhook | Follow-up status check for n8n.
- `GET /v1/admin/automation/health` | `requireRole(["ADMIN"])` | Automation dispatcher telemetry.

### 28.9 AI & Evidence
- `POST /v1/assistant/chat` | `requireAuth` | Multi-turn conversational chat with Gemini 2.5 Flash.
- `POST /v1/ai/gaps` | `requireAuth` | Entitlement gap analysis via Lyzr AI.
- `GET /v1/evidence` | Public | Lists verified scheme evidence circulars.
- `POST /v1/evidence/search` | `requireRole(["ADMIN"])` | Admin searches official circulars via Tavily.
- `GET /v1/evidence/conflicts` | `requireRole(["ADMIN"])` | Lists flagged policy conflicts.
- `POST /v1/evidence/resolve` | `requireRole(["ADMIN"])` | Resolves policy conflict.
- `GET /v1/evidence/audit` | `requireRole(["ADMIN"])` | Evidence governance audit trail.

---

## 29. Security, Privacy & RBAC Architecture

1. **Client-Side Secret Shielding:** Server secrets (`FIREBASE_PRIVATE_KEY`, `SARVAM_API_KEY`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `TAVILY_API_KEY`, `LYZR_API_KEY`, `GEMINI_API_KEY`) are loaded exclusively into server environment variables and never bundled into client packages.
2. **Strict Cryptographic Authentication:** All incoming requests (except public endpoints) must provide a cryptographically verified Firebase ID token via `Authorization: Bearer <token>`.
3. **Defense Against Role Escalation:**
   - Registration of privileged roles (`ASHA`, `ADMIN`) requires passing a valid authorization secret verified against server-side SHA-256 hashes (`ASHA_REGISTRATION_SECRET_HASH`, `ADMIN_REGISTRATION_SECRET_HASH`).
   - Profile sync (`/v1/auth/sync`) preserves existing assigned roles and strictly rejects client attempts to self-promote.
4. **Data Isolation & IDOR Protection:**
   - Citizens can access only their own household (`/v1/households/me`), family members, and assistance requests.
   - Workers can view only households and cases within their assigned administrative jurisdiction.
5. **Privacy-Safe Telemetry:** Logs sanitize phone numbers (masking digits, e.g. `+91 98*** **210`), hashes phone numbers for identity lookups via SHA-256, and never outputs citizen names, health tags, or API keys in standard console logs.

---

## 30. Error Handling, Fallback & System Resilience

- **STT Failure / Blank Transcript:** If Sarvam STT encounters upstream network timeouts or receives pure background noise, it logs a sanitized warning and returns an empathetic recovery prompt in the session language without dropping the telephony call.
- **TTS Failure Resilience:** If Sarvam TTS encounters quota exhaustion (HTTP 402) or upstream 500 errors, the Fastify server catches the error, logs a privacy-safe diagnostic, and maintains session stability.
- **Telephony Disconnect Handling:** The WebSocket gateway tracks connection heartbeats. If a caller drops connection, all active timers, buffers, and VAD states are purged cleanly.
- **Language Fallback:** If an unsupported or malformed language string is received, the system falls back safely to `en-IN`.

---

## 31. Accessibility & Usability Engineering

- **Touch Target Sizing:** Interactive buttons, tabs, and drawer controls enforce a minimum touch target of `44x44` CSS pixels for reliable use on low-cost Android smartphones.
- **Visual Contrast:** Status badges and text elements adhere to WCAG 2.1 AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text).
- **Voice As Universal Access:** Non-literate beneficiaries are not forced to interact with text; they can conduct complete entitlement evaluations over regular PSTN voice calls.

---

## 32. Responsive Design Strategy

The application layout adapts seamlessly across three primary viewport tiers:
- **Mobile Viewport (360px – 640px):** Single-column layout, sticky mobile navigation bar (`MobileNav`), slide-out drawer drawers, stacked cards instead of wide data tables, and touch-optimized buttons.
- **Tablet Viewport (641px – 1024px):** Two-column card grids, responsive dashboard KPI metrics, and collapsible navigation sidebar.
- **Desktop Viewport (1025px+):** Three/four-column dashboard grids, side-by-side case inspection drawers, and persistent header navigation.

---

## 33. Global Design System

The visual design system adheres to a **calm, authoritative, government-service aesthetic**:
- **Design Philosophy:** Clean, accessible, highly legible, non-flashy, non-glassmorphic, and avoiding dark futuristic themes in favor of institutional trust.
- **Color Palette:**
  - *Primary Teal / Emerald:* Inspires healthcare confidence (`#0D9488` / `#059669`).
  - *Institutional Slate:* High-contrast typography and borders (`#0F172A`, `#334155`, `#E2E8F0`).
  - *Status Warning Amber:* Triage and attention signals (`#D97706`).
  - *Status Critical Red:* Emergency redirections and overdue visits (`#DC2626`).
  - *Status Success Green:* Verified identity and completed milestones (`#16A34A`).
- **Typography:** Modern clean sans-serif stack (`Inter`, system UI fallback) optimized for complex Indic scripts (Kannada and Devanagari).

---

## 34. Data Flow Diagrams

### 34.1 Citizen Entitlement & Assistance Flow

```
Citizen              Frontend               Fastify API            Firestore DB           ASHA Worker
   |                    |                        |                      |                      |
   |-- Fill Roster ---->|                        |                      |                      |
   |                    |-- POST /households --->|                      |                      |
   |                    |   and /members         |-- Write Household -->|                      |
   |                    |                        |   and Members        |                      |
   |                    |                        |                      |                      |
   |                    |-- GET /eligibility --->|                      |                      |
   |                    |                        |-- Rule Evaluation -->|                      |
   |                    |<- Eligible Schemes ----|                      |                      |
   |<-- View Cards -----|                        |                      |                      |
   |                    |                        |                      |                      |
   |-- Click Help ----->|                        |                      |                      |
   |                    |-- POST /assistance --->|                      |                      |
   |                    |   requests             |-- Create Request --->|                      |
   |                    |                        |                      |-- New Request ------>|
   |                    |                        |                      |                      |
   |                    |                        |<-- Accept Request --------------------------|
   |                    |                        |-- Create Case ------>|                      |
   |                    |<-- Case Active --------|   Initialize Journey |                      |
   |<-- Case Tracking --|                        |                      |                      |
```

### 34.2 Real-Time Multilingual Voice Stream Flow

```
Caller (PSTN)         Exotel Gateway         Fastify Stream Gateway        Sarvam STT / TTS
      |                     |                          |                          |
      |-- Dial / Answer --->|                          |                          |
      |                     |== WebSocket Connect ====>|                          |
      |                     |   event: 'start'         |                          |
      |                     |                          |-- TTS Greeting --------->|
      |                     |                          |<- 8kHz WAV --------------|
      |                     |<== Send μ-law Frames ====| (Chunked into 160B)      |
      |<-- Hear Greeting ---|                          |                          |
      |                     |                          |                          |
      |-- Spoken Query ---->|                          |                          |
      |   (Kannada/Hindi)   |== Media μ-law Chunks ===>|                          |
      |                     |                          |-- VAD Silence Detect     |
      |                     |                          |-- Transcode to PCM WAV   |
      |                     |                          |-- SpeechToText (Saaras)->|
      |                     |                          |<- Return Transcript -----|
      |                     |                          |                          |
      |                     |                          |-- Deterministic Logic    |
      |                     |                          |-- Localize Response      |
      |                     |                          |-- TextToSpeech (Bulbul)->|
      |                     |                          |<- Return 8kHz WAV -------|
      |                     |<== Send μ-law Frames ====|                          |
      |<-- Hear Answer -----|                          |                          |
```

---

## 35. Complete A-to-Z User Journeys

### Journey 1: Citizen Onboarding & Assistance Request
1. **Discovery:** Citizen lands on `/`, switches language to Kannada (`ಕನ್ನಡ`), reviews Ayushman Bharat benefits.
2. **Registration:** Clicks *Register*, enters phone number, receives OTP, and establishes session.
3. **Consent:** Reviews and accepts the statutory healthcare data consent agreement (`/auth/consent`).
4. **Household Setup:** Navigates to `/citizen`, registers household location, selects BPL ration card, and adds 72-year-old grandfather.
5. **Instant Evaluation:** Rule engine flags grandfather as `ELIGIBLE` for universal Ayushman Bharat PM-JAY.
6. **Request Help:** Citizen clicks *"Request ASHA Assistance"*, requesting home visit for e-KYC.
7. **Tracking:** Observes status shift from `PENDING` to `ACCEPTED`, viewing assigned ASHA worker details.

### Journey 2: ASHA Worker Field Caseload Management
1. **Sign-In:** Worker logs into `/auth/sign-in` using ASHA credentials and validated registration code.
2. **Triage:** Reviews workspace dashboard (`/asha`), observing a new incoming assistance request and 2 overdue visits.
3. **Acceptance:** Opens citizen request, clicks *Accept*, which automatically generates a new tracked case.
4. **Action:** Opens Case Detail Drawer, schedules a home follow-up visit for the coming Thursday.
5. **Field Visit:** Conducts home visit, assists with Ayushman app Aadhaar verification, marks task `COMPLETED`, adds a field note, and marks the visit completed.

### Journey 3: Administrator System Governance
1. **Oversight:** Administrator signs in at `/admin`, reviewing platform-wide metrics (1,200 households, 48 active cases).
2. **Workforce Audit:** Inspects ASHA workforce roster, noticing one worker has 12 overdue follow-ups due to illness.
3. **Reassignment:** Uses *Assign Case* modal to reassign 5 cases to an adjacent active worker.
4. **Policy Governance:** Inspects Scheme Registry, reviews latest operational guidelines for PM-JAY 70+ expansion.
5. **Telemetry Check:** Reviews automation health and voice telemetry, confirming zero telephony errors.

### Journey 4: Interactive Feature-Phone Voice Consultation
1. **Call Request:** Citizen clicks *"Call Assistant"* on Kannada web interface; system schedules outbound call with `language = kn-IN`.
2. **Ringing:** Exotel calls citizen’s feature phone; citizen picks up.
3. **Greeting:** Voice assistant speaks in natural Kannada: *"ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ... ಕರೆಯು ರೆಕಾರ್ಡ್ ಆಗಬಹುದು."*
4. **Query:** Citizen asks in Kanglish: *"Nanna grandfather ge 71 years, Ayushman Bharat card sigutha?"*
5. **VAD & STT:** ExotelStreamGateway detects speech end; Sarvam Saaras STT transcribes in `kn-IN`.
6. **Reasoning & Synthesis:** Rule engine confirms eligibility; Sarvam Bulbul TTS synthesizes natural Kannada response explaining that seniors aged 70+ qualify universally for ₹5 Lakh cover.
7. **Audio Delivery:** Audio transcoded to G.711 μ-law and streamed back to caller over mobile carrier connection.

---

## 36. Status Enums & Finite State Machines

### 36.1 Case Status Enum
`NEW` → `ACTIVE` → `IN_PROGRESS` → `NEEDS_ATTENTION` → `FOLLOW_UP_REQUIRED` → `BLOCKED` → `ESCALATED` → `RESOLVED` → `CLOSED`

### 36.2 Assistance Request Status Enum
`PENDING` → `REQUESTED` → `ACCEPTED` → `IN_PROGRESS` → `RESOLVED` (or `DECLINED`)

### 36.3 Follow-Up Status Enum
`PENDING` → `COMPLETED` (or `CANCELLED`)

### 36.4 Voice Session Status Enum
`INITIATED` → `ACTIVE` → `PROCESSING` → `RESPONDING` → `COMPLETED` (or `FAILED` / `ENDED`)

---

## 37. Observability, Auditability & Telemetry

1. **Correlation ID Tracking:** Every HTTP request and WebSocket frame is tagged with a unique `correlationId` passed through all logs and responses (`x-correlation-id`).
2. **Immutable Audit Trails:** Case activity logs (`/cases/{caseId}/activities`) record actor UID, role, timestamp, and detailed state delta.
3. **Voice Telemetry Endpoint:** `GET /api/v1/admin/voice/telemetry` provides administrators with:
   - Total call sessions initiated, completed, and dropped.
   - Speech turn distribution per call.
   - Provider latencies for STT and TTS.
   - Error rates categorized by provider (Exotel vs Sarvam).
4. **Automation Telemetry:** Tracks n8n event dispatches, webhook receipt acknowledgments, and payload delivery timestamps.

---

## 38. Testing & Quality Assurance Strategy

SwasthyaSetu implements an exhaustive automated test suite powered by **Vitest 3.0.6**.

### 38.1 Verified Test Execution Summary
- **Total Test Suites:** **42 passed (42 / 42)**
- **Total Unit & Integration Tests:** **389 passed (389 / 389)**
- **Failed Tests:** **0**
- **TypeScript Compilation:** Zero errors (`tsc --noEmit` clean on both backend and frontend).

### 38.2 Key Test Suites
- `tests/phase-f-multilingual-voice.test.ts`: Validates trilingual voice turn processing, code-switching tolerance, session language precedence, and G.711 framing invariants.
- `tests/exotel-websocket-stream.test.ts`: Validates WebSocket connection lifecycle, Exotel event handshakes (`connected`, `start`, `media`, `mark`, `stop`), and VAD silence boundaries.
- `tests/phase11-voice-telephony.test.ts`: Comprehensive integration tests for identity verification boundaries, deterministic senior eligibility evaluation, and telephony call outcome recording.
- `tests/voice-routes.test.ts`: Validates all voice REST endpoints, emergency 108 redirection boundaries, and credential non-exposure.
- `tests/rule-engine.test.ts`: Validates deterministic Boolean evaluation across all 5 production schemes.

---

## 39. Performance, Scalability & Reliability

1. **Allocation-Free Audio Transcoding:** Lookup-table based G.711 μ-law decoding and encoding executes in sub-millisecond time without heap allocations.
2. **Streaming Frame Chunking:** Audio playback streams in 20ms slices (160 bytes), minimizing buffer memory overhead on concurrent WebSocket connections.
3. **Turn Cost Controls:** Calls enforce strict turn caps (`VOICE_MAX_TURNS = 10`) and maximum duration limits (`VOICE_MAX_CALL_DURATION_SEC = 300`) to prevent runaway telephony billing.
4. **In-Memory Caching:** External evidence searches and AI intelligence responses utilize TTL-based Firestore caches (`EVIDENCE_CACHE_TTL_HOURS = 72`).

---

## 40. Environment Configuration Reference

| Environment Variable | Service Scope | Description & Safety Invariant |
|---|---|---|
| `NODE_ENV` | Backend | Runtime environment (`development`, `test`, `production`). |
| `PORT` / `HOST` | Backend | Fastify listening port (`8000`) and binding host (`0.0.0.0`). |
| `ALLOWED_ORIGINS` | Backend | Allowed CORS origins (e.g. `http://localhost:3000`). |
| `FIREBASE_PROJECT_ID` | Backend & Frontend | Firebase Cloud Project ID. |
| `FIREBASE_PRIVATE_KEY` | Backend Only | Private service account key. **NEVER EXPOSE TO CLIENT.** |
| `FIREBASE_CLIENT_EMAIL`| Backend Only | Service account client email. |
| `SARVAM_API_KEY` | Backend Only | Sarvam AI API secret key for STT & TTS. **NEVER EXPOSE.** |
| `SARVAM_BASE_URL` | Backend | Sarvam API gateway (`https://api.sarvam.ai`). |
| `SARVAM_MODEL` | Backend | Default Saaras STT model (`saaras:v3`). |
| `SARVAM_TTS_MODEL` | Backend | Default Bulbul TTS model (`bulbul:v3`). |
| `SARVAM_TTS_SPEAKER` | Backend | Configured voice speaker (`shubh`). |
| `EXOTEL_ACCOUNT_SID` | Backend Only | Exotel account identifier. **NEVER EXPOSE.** |
| `EXOTEL_API_KEY` | Backend Only | Exotel telephony API key. **NEVER EXPOSE.** |
| `EXOTEL_API_TOKEN` | Backend Only | Exotel telephony API token. **NEVER EXPOSE.** |
| `EXOTEL_VIRTUAL_NUMBER`| Backend & Public | Virtual phone number displayed on landing page for inbound calls. |
| `GEMINI_API_KEY` | Backend Only | Google Gemini API key for assistant chat. **NEVER EXPOSE.** |
| `GEMINI_MODEL` | Backend | Gemini model identifier (`gemini-3.6-flash`). |
| `TAVILY_API_KEY` | Backend Only | Tavily search API key for circular discovery. **NEVER EXPOSE.** |
| `LYZR_API_KEY` | Backend Only | Lyzr AI studio API key. **NEVER EXPOSE.** |
| `N8N_WEBHOOK_URL` | Backend Only | Outbound webhook endpoint for n8n orchestrator. |
| `N8N_WEBHOOK_SECRET` | Backend Only | Shared secret header for n8n webhook authentication. |
| `ASHA_REGISTRATION_SECRET_HASH` | Backend Only | SHA-256 hash of valid ASHA staff registration code. |
| `ADMIN_REGISTRATION_SECRET_HASH`| Backend Only | SHA-256 hash of valid Admin registration code. |

---

## 41. Deployment & Infrastructure Topology

### 41.1 Local Development Topology
- **Frontend Server:** Next.js Dev Server running on `http://localhost:3000`.
- **Backend Daemon:** Fastify TSX Watch Server running on `http://localhost:8000`.
- **Telephony Ingress:** **Cloudflare Tunnel** exposing local Fastify port 8000 to a public HTTPS/WSS URL configured in Exotel Stream Applet settings (`wss://<tunnel-subdomain>/api/v1/voice/stream`).

### 41.2 Production Topology
- **Frontend Hosting:** Next.js standalone container deployed on Cloud Run / Vercel.
- **Backend Hosting:** Node.js Fastify container deployed on auto-scaling container infrastructure (Google Cloud Run or AWS ECS).
- **Database:** Serverless Google Cloud Firestore Native Database in `asia-south1` (Mumbai).

---

## 42. Current Implementation Status Matrix

| Phase | Functional Scope | Status | Verification Detail |
|:---:|---|:---:|---|
| **Phase A** | Citizen Portal UI & Household Management | **COMPLETED** | Verified via full UI interaction & Vitest suite |
| **Phase B** | ASHA Workspace Caseload & Task Drawer | **COMPLETED** | Verified via field registration & drawer inspection |
| **Phase C** | Admin Console & Workforce Oversight | **COMPLETED** | Verified via platform KPIs & case reassignment tests |
| **Phase D** | Design System & Responsive Layout | **COMPLETED** | Calm government aesthetic verified on 360px–1440px viewports |
| **Phase E** | Trilingual Website Localization (en/kn/hi) | **COMPLETED** | 100% UI key coverage in English, Kannada, and Hindi |
| **Phase F** | Sarvam Multilingual Voice Integration | **COMPLETED** | Verified via 19 tests in `phase-f-multilingual-voice.test.ts` |
| **Phase 10**| n8n Event Automation & Dispatching | **COMPLETED** | 5 workflow JSON definitions & non-blocking dispatcher verified |
| **Phase 11**| Exotel Real-Time WebSocket Voice Streaming | **COMPLETED** | 22 tests in `exotel-websocket-stream.test.ts` passing |

---

## 43. Known Limitations

1. **Development Telephony Ingress Dependency:** Local testing of live Exotel PSTN calls requires an active Cloudflare Tunnel or ngrok instance to expose the local Fastify WebSocket endpoint.
2. **Third-Party Telephony Credit Dependency:** Live PSTN calls consume Exotel account credits and Sarvam AI synthesis credits; when quota is depleted, provider returns HTTP 402.
3. **Telephony PSTN Bandwidth (8kHz Limit):** Carrier voice lines are restricted to 8000Hz sampling rates; audio fidelity is constrained to standard telephone quality.
4. **Feature-Phone Screenless Limitation:** Beneficiaries on standard feature phones cannot view document images over voice calls; they must receive SMS links or await ASHA home visits for visual inspection.

---

## 44. Future Extensions

> [!NOTE]
> The following capabilities represent potential roadmap expansions and are **NOT** part of the current verified codebase.

1. **Additional Indic Languages:** Expanding Sarvam voice and UI localization to Telugu (`te-IN`), Tamil (`ta-IN`), Marathi (`mr-IN`), and Bengali (`bn-IN`).
2. **Automated WhatsApp Bot Channel:** Integrating official WhatsApp Business API to deliver localized document checklists and card generation links.
3. **ABDM / ABHA Integration:** Native linking with Ayushman Bharat Digital Mission (ABDM) to query health records directly via Ayushman Bharat Health Account (ABHA) IDs.
4. **Offline Mobile Application:** Progressive Web App (PWA) with background sync for ASHA workers operating in zero-connectivity remote rural villages.

---

## 45. Requirements Traceability Matrix

| Requirement ID | Specification Summary | Role | Implementation Component | Verification Test Suite |
|---|---|:---:|---|---|
| **FR-AUTH-001** | Multi-role authentication with Firebase ID tokens | All | `auth.ts`, `guards.ts` | `auth.test.ts` |
| **FR-AUTH-002** | Privileged registration secret validation | ASHA / Admin | `privileged-auth.service.ts` | `auth.test.ts` |
| **FR-AUTH-003** | Mandatory healthcare data consent gating | All | `guards.ts`, `/auth/consent` | `auth.test.ts` |
| **FR-CIT-001** | Household socio-economic profile management | Citizen | `household.service.ts` | `household.test.ts` |
| **FR-CIT-002** | Family member roster with health indicators | Citizen | `household.service.ts` | `household.test.ts` |
| **FR-CIT-003** | Deterministic scheme eligibility evaluation | Citizen | `eligibility.service.ts` | `rule-engine.test.ts` |
| **FR-CIT-004** | ASHA worker discovery and linking | Citizen | `connection.service.ts` | `connection-service.test.ts` |
| **FR-CIT-005** | Direct scheme assistance request submission | Citizen | `assistance.service.ts` | `assistance-routes.test.ts` |
| **FR-CIT-006** | Outbound voice callback request | Citizen | `voice-gateway.service.ts` | `voice-routes.test.ts` |
| **FR-ASHA-001** | Caseload directory and KPI summary | ASHA | `case.service.ts` | `case-routes.test.ts` |
| **FR-ASHA-002** | Proactive attention signal gap triage | ASHA | `case.service.ts` | `case-routes.test.ts` |
| **FR-ASHA-003** | Assistance request acceptance and case binding | ASHA | `assistance.service.ts` | `case-service.test.ts` |
| **FR-ASHA-004** | Case detail drawer task checklist management | ASHA | `case.service.ts` | `case-routes.test.ts` |
| **FR-ASHA-005** | Home visit scheduling and overdue triage | ASHA | `case.service.ts` | `case-service.test.ts` |
| **FR-ASHA-006** | In-field new household registration | ASHA | `case.service.ts` | `case-routes.test.ts` |
| **FR-ADM-001** | Platform-wide case inspection and assignment | Admin | `case.service.ts` | `case-routes.test.ts` |
| **FR-ADM-002** | ASHA workforce roster and jurisdiction audit | Admin | `case.service.ts` | `case-routes.test.ts` |
| **FR-ADM-003** | Scheme registry and policy rule governance | Admin | `scheme.service.ts` | `schemes.test.ts` |
| **FR-ADM-004** | Telephony and automation health monitoring | Admin | `voice.ts`, `automation.service.ts` | `voice-routes.test.ts` |
| **FR-VOI-001** | Exotel WebSocket telephony streaming | Public / PSTN | `exotel-stream-gateway.service.ts` | `exotel-websocket-stream.test.ts` |
| **FR-VOI-002** | G.711 μ-law 160-byte frame transcoding | System | `audio-codec.ts` | `phase-f-multilingual-voice.test.ts` |
| **FR-VOI-003** | Sarvam Saaras STT in en-IN, kn-IN, hi-IN | System | `sarvam.service.ts` | `phase-f-multilingual-voice.test.ts` |
| **FR-VOI-004** | Sarvam Bulbul TTS at 8000Hz telephony rate | System | `sarvam.service.ts` | `phase-f-multilingual-voice.test.ts` |
| **FR-VOI-005** | Authoritative session language precedence | System | `exotel-stream-gateway.service.ts` | `phase-f-multilingual-voice.test.ts` |
| **FR-VOI-006** | Instant 108/102 emergency redirection | System | `voice-action.service.ts` | `voice-routes.test.ts` |
| **NFR-SEC-001** | Zero server secret exposure to clients | Security | `env.ts`, `voice.ts` | `voice-routes.test.ts` |
| **NFR-SEC-002** | Phone number masking in public responses | Privacy | `voice-gateway.service.ts` | `phase11-voice-telephony.test.ts` |
| **NFR-PER-001** | Bounded voice turns (Max 10) and call duration | Reliability | `exotel-stream-gateway.service.ts` | `exotel-websocket-stream.test.ts` |
| **NFR-I18N-001**| Complete UI translation across en, kn, hi | Usability | `frontend/i18n` | `i18n-parity.test.ts` |

---

## 46. Glossary of Terms

- **ASHA (Accredited Social Health Activist):** Community health worker instituted by the Ministry of Health and Family Welfare to act as the primary interface between rural communities and the public health system.
- **AB-PMJAY (Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana):** Centrally-sponsored health assurance scheme offering up to ₹5 lakh per family per year for secondary and tertiary care.
- **JSY (Janani Suraksha Yojana):** Safe motherhood intervention providing conditional cash assistance for institutional delivery.
- **JSSK (Janani Shishu Suraksha Karyakram):** Scheme guaranteeing completely free and cashless delivery and infant healthcare across public health facilities.
- **AB-ARK (Ayushman Bharat — Arogya Karnataka):** Co-branded health assurance scheme implemented by the Government of Karnataka.
- **PSTN (Public Switched Telephone Network):** Aggregate of the world's circuit-switched telephone networks operated by national and regional carriers.
- **μ-law (PCMU):** Companding algorithm used in North American and Japanese digital telecommunication systems (ITU-T G.711) operating at 8000Hz.
- **VAD (Voice Activity Detection):** Algorithmic analysis of audio energy to distinguish between active human speech and background silence.
- **Sarvam Saaras:** High-accuracy Indic speech-to-text artificial intelligence foundation model.
- **Sarvam Bulbul:** Natural Indic text-to-speech artificial intelligence voice synthesis model.
- **Exotel:** Cloud telephony service provider providing virtual numbers, call bridging, and real-time audio WebSocket streams.
- **n8n:** Self-hostable, fair-code workflow automation tool used for asynchronous event orchestration.
- **RBAC (Role-Based Access Control):** Security method of restricting system access to authorized users based on defined organizational roles.

---

## 47. Machine-Readable Data & Identifier Rules

> [!IMPORTANT]
> To prevent system-wide data corruption across localized views, the following technical identifiers must **NEVER** be translated, localized, or phonetically transliterated:

1. **Scheme Codes:** `ab-pmjay`, `jsy`, `jssk`, `state-health-assurance`, `ab-ark-karnataka`.
2. **Official Acronyms:** `AB-PMJAY`, `PM-JAY`, `JSY`, `JSSK`, `MCP`, `UIDAI`, `NHA`, `DBT`.
3. **Database Document IDs:** Prefix-based identifiers such as `hh_*`, `mem_*`, `case_*`, `vses_*`, `req_*`, `conn_*`.
4. **Service Codes:** ASHA service identifiers (e.g., `ASHA-BLR-042`).
5. **Telephony Language Identifiers:** BCP-47 language codes `en-IN`, `kn-IN`, `hi-IN`.
6. **Backend Enums:** Values such as `ELIGIBLE`, `NEEDS_MORE_INFO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`.
7. **Official Government URLs:** Domain links such as `https://pmjay.gov.in`.
8. **Emergency Helpline Numbers:** Digits `108` and `102`.

---
*End of SwasthyaSetu Software Requirements Specification (SRS) Document.*
