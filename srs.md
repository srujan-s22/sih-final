# SwasthyaSetu — Software Requirements Specification (SRS)

**Document Version:** 2.0.0  
**Current Implementation Status:** Production Core Verified (Phases 1–11, Voice Multilingual, NFC Phases 1–7, Citizen Onboarding Architecture)  
**System Classification:** Digital Public Health Infrastructure & Assisted Healthcare Delivery System  
**Last Updated:** September 10, 2026  
**Authoritative Location:** `/srs.md` (Repository Root)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [System Objectives](#3-system-objectives)
4. [System Scope & Boundaries](#4-system-scope--boundaries)
5. [User Roles & Authorization Matrix](#5-user-roles--authorization-matrix)
6. [High-Level System Architecture](#6-high-level-system-architecture)
7. [Complete Technology Stack](#7-complete-technology-stack)
8. [Frontend Architecture & Route Inventory](#8-frontend-architecture--route-inventory)
9. [Landing Page & Public Access Experience](#9-landing-page--public-access-experience)
10. [Authentication, Authorization & Consent Flow](#10-authentication-authorization--consent-flow)
11. [Citizen ↔ Household Architecture](#11-citizen--household-architecture)
12. [Citizen First-Time Onboarding & Portal](#12-citizen-first-time-onboarding--portal)
13. [ASHA Caseload Workspace Functional Specification](#13-asha-caseload-workspace-functional-specification)
14. [ASHA ↔ Citizen Connection & Case Assignment](#14-asha--citizen-connection--case-assignment)
15. [ASHA Leave Coverage & Caseload Delegation](#15-asha-leave-coverage--caseload-delegation)
16. [NFC System Architecture & Physical Tag Management](#16-nfc-system-architecture--physical-tag-management)
17. [Public NFC Access vs Authenticated Citizen Access](#17-public-nfc-access-vs-authenticated-citizen-access)
18. [Admin Console Functional Specification](#18-admin-console-functional-specification)
19. [Healthcare Scheme & Deterministic Eligibility Engine](#19-healthcare-scheme--deterministic-eligibility-engine)
20. [Evidence & Policy Guidance Subsystem](#20-evidence--policy-guidance-subsystem)
21. [Assistance Requests & Case Management Engine](#21-assistance-requests--case-management-engine)
22. [Follow-Up Scheduling & Task Engine](#22-follow-up-scheduling--task-engine)
23. [Multilingual Website & UI Localization](#23-multilingual-website--ui-localization)
24. [Interactive PSTN Voice & Telephony Architecture](#24-interactive-pstn-voice--telephony-architecture)
25. [Artificial Intelligence Services & Guardrails](#25-artificial-intelligence-services--guardrails)
26. [Database & Firestore Data Model](#26-database--firestore-data-model)
27. [Complete API Specification](#27-complete-api-specification)
28. [Security, Privacy & IDOR Protection Architecture](#28-security-privacy--idor-protection-architecture)
29. [Non-Functional Requirements](#29-non-functional-requirements)
30. [Implementation Status Matrix & Known Limitations](#30-implementation-status-matrix--known-limitations)
31. [Glossary of Terms](#31-glossary-of-terms)

---

## 1. Executive Summary

**SwasthyaSetu** ("Health Bridge") is an assisted digital healthcare delivery platform designed to eliminate the structural and informational barriers separating India’s central and state welfare health programs from the vulnerable populations entitled to their benefits. Rather than serving as an informational static directory, SwasthyaSetu functions as an active, human-in-the-loop operational ecosystem linking three key user groups:

1. **Citizens:** Individuals and household heads seeking transparent entitlement evaluation, document readiness guidance, and doorstep assistance.
2. **ASHA Workers (Accredited Social Health Activists):** Community healthcare facilitators managing assigned caseloads, conducting home visits, resolving enrollment bottlenecks, issuing NFC cards, and tracking high-priority health events.
3. **Health Administrators:** District and regional supervisory officers monitoring caseload equity, assigning cases, validating scheme definitions, managing leave coverage delegations, and inspecting system telemetry.

SwasthyaSetu incorporates a deterministic eligibility engine covering central and state schemes including **Ayushman Bharat (AB-PMJAY)**, **Janani Suraksha Yojana (JSY)**, **Janani Shishu Suraksha Karyakram (JSSK)**, **Pradhan Mantri Matru Vandana Yojana (PMMVY)**, and state programs such as **Ayushman Bharat - Arogya Karnataka (AB-ARK)**.

To overcome severe digital literacy and accessibility hurdles in rural and peri-urban populations, SwasthyaSetu implements:
- **Trilingual Web Interface:** English (`en`), Kannada (`kn`), and Hindi (`hi`).
- **NFC Physical Card System:** Secure household health entitlement cards powered by NTAG213 tags, resolving privacy-minimal public benefit summaries via Web NFC and standard smartphones.
- **Carrier PSTN Multilingual Voice Assistant:** Powered by **Exotel Telephony** and **Sarvam AI** (`saaras:v3` STT and `bulbul:v3` TTS at 8kHz μ-law), enabling voice interactions over regular 2G/feature phones in Kannada, Hindi, and English.

---

## 2. Problem Statement

Hundreds of millions of low-income citizens qualify for life-saving welfare and healthcare schemes in India. However, real-world utilization is impeded by five critical friction points:

1. **Fragmented Scheme Rules:** Eligibility criteria intersect across age thresholds (e.g., universal senior citizen 70+ PM-JAY coverage regardless of income), socio-economic categories (BPL, Antyodaya Anna Yojana, NFSA), maternal status, infant age, and state residency. Families struggle to navigate these matrices.
2. **Documentation Gaps:** Families often qualify in theory but lack mandatory paperwork (e.g., Mother & Child Protection [MCP] card, ration card linkage, or Aadhaar e-KYC). Incomplete documentation leads to hospital turnaways during emergencies.
3. **ASHA Worker Caseload Friction:** Frontline workers are overburdened with physical registers and lack automated triage to identify critical health gaps (unvaccinated infants, unregistered high-risk pregnancies, or unassisted elderly citizens).
4. **Administrative Blind Spots:** District officers lack real-time visibility into ASHA caseload distribution, overdue patient interactions, and unresolved field enrollment blockers.
5. **Digital & Language Exclusions:** Over 60% of rural beneficiaries lack smartphones or high-speed data, and cannot read formal administrative Hindi or English text.

---

## 3. System Objectives

### Citizen Objectives
- **Household-Centric Evaluation:** Register household and family members once during first-time onboarding to unlock deterministic eligibility evaluations across all supported schemes.
- **Actionable Guidance:** Receive checklists of required documents, step-by-step application actions, and official policy citations.
- **Direct ASHA Linkage:** Discover, link with, and request direct doorstep assistance from designated local ASHA workers using service codes.
- **Physical NFC Cards:** Access simplified household benefit cards via physical NFC card taps without requiring continuous internet or login credentials.
- **PSTN Voice Accessibility:** Request an automated phone callback or dial in from any mobile or landline phone to query entitlements in Kannada, Hindi, or English.

### ASHA Worker Objectives
- **Digital Caseload Management:** Maintain assigned households, member rosters, and health indicators digitally.
- **Attention Signals & Gap Triage:** Automatically review households with urgent healthcare gaps flagged by deterministic rules.
- **Assistance Request Handling:** Review, accept, or decline citizen assistance requests, converting accepted requests into tracked field cases.
- **Structured Field Follow-Ups:** Schedule, track, and complete home visits categorized into `Due Today`, `Overdue`, `Upcoming`, and `Completed`.
- **Physical NFC Card Provisioning:** Provision, write, rotate, and revoke household NFC cards via Web NFC.
- **Leave Coverage & Delegation:** Submit leave requests with automatic temporary delegation of active cases to a designated coverage ASHA.

### Administrator Objectives
- **Caseload Oversight:** Monitor registered households, active cases, overdue follow-ups, and worker workloads across districts.
- **Workforce Assignment & Roster:** Inspect ASHA jurisdictions and assign or reassign cases across workers.
- **Leave Approval:** Review and approve ASHA leave requests, confirming temporary caseload delegation.
- **Scheme & Evidence Governance:** Inspect authoritative scheme metadata, versioned criteria, document requirements, and policy evidence citations.
- **System Telemetry:** Monitor real-time telemetry for Exotel telephony, Sarvam voice pipelines, and n8n webhook automations.

---

## 4. System Scope & Boundaries

### In Scope (Implemented & Verified in Codebase)
- Next.js 16 (React 19) App Router web application with Tailwind CSS design tokens.
- Fastify 5 REST API backend daemon with native WebSocket support (`@fastify/websocket`).
- Deterministic scheme eligibility engine seeded with 6 authoritative schemes: `ab-pmjay`, `jsy`, `jssk`, `pmmvy`, `state-health-assurance`, and `ab-ark-karnataka`.
- Citizen First-Time Onboarding: Atomic household and initial head-of-household creation in a single transaction.
- 1 Citizen ↔ 1 Household invariant enforced with `409 Conflict` (`HOUSEHOLD_ALREADY_EXISTS`).
- Frontline ASHA Caseload Workspace: Caseload management, case detail drawer, journey step milestones, health gap triage, follow-up scheduling, and field notes.
- ASHA Household Registration Deprecation: ASHA household creation UI removed, and `POST /api/v1/asha/cases` blocked with `403 FORBIDDEN_ROLE`.
- NFC Card System: Provisioning, one-time token retrieval, SHA-256 hash storage, rate-limited public resolution, NTAG213 capacity optimization (<117 bytes), Web NFC writer with retry, and card rotation.
- Citizen ↔ ASHA Connection System: Service code lookup, connection requests, and acceptance-based assignment.
- Citizen Assistance Request Workflow: Submitting, accepting, declining, and tracking scheme assistance requests.
- ASHA Leave & Temporary Reassignment Subsystem: Leave creation, admin approval, automated temporary case delegation, and expiration restoration.
- Administrator Console: Caseload oversight, ASHA roster, scheme registry inspector, evidence management, and telemetry dashboards.
- Trilingual UI localization in English (`en`), Kannada (`kn`), and Hindi (`hi`).
- Exotel Telephony + Sarvam AI Voice Pipeline: Saaras STT (`saaras:v3`) and Bulbul TTS (`bulbul:v3`) at 8kHz μ-law, 20ms frame chunking, and deterministic multilingual NLU.
- Conversational Healthcare Assistant: Grounded Google Gemini 2.5 Flash drawer.
- External Legal Document Search: Tavily Search API for Admin evidence management.
- Asynchronous Domain Event Automation: n8n webhook dispatcher.
- Google Cloud Firestore NoSQL storage with strict subcollections and security rules.

### Out of Scope (Explicit Non-Goals)
- **Clinical Diagnosis or Prescription:** SwasthyaSetu does not provide medical diagnoses or prescribe medications.
- **Direct Financial Disbursement:** The system tracks DBT eligibility but does not execute direct bank transfers or interface with PFMS/NPCI.
- **Hospital Bed Booking:** The platform does not manage real-time ICU or bed occupancies.
- **Native Carrier SMS Broadcasting:** Notifications are dispatched via webhook automations (e.g., n8n); no direct SMPP modem is embedded.
- **Languages Outside en-IN, kn-IN, hi-IN:** Other regional languages are reserved for future phases.

---

## 5. User Roles & Authorization Matrix

The platform enforces three distinct roles (`shared/types/auth.ts`):
1. **`CITIZEN`:** A household representative seeking healthcare entitlements.
2. **`ASHA`:** A community health worker authorized to manage an assigned caseload.
3. **`ADMIN`:** A supervisory officer or platform administrator.

### Permission Matrix

| Functional Capability | Citizen | ASHA Worker | Administrator | Enforcement Mechanism |
|---|:---:|:---:|:---:|---|
| Browse Public Schemes & Citations | Yes | Yes | Yes | Public (`GET /v1/schemes`) |
| Register / Authenticate Account | Yes | Yes (Secret Required) | Yes (Secret Required) | `/v1/auth/prevalidate` & `/v1/auth/register` |
| View Own User Profile (`/auth/me`) | Yes | Yes | Yes | `requireAuth` Guard |
| Submit Data Consent | Yes | Yes | Yes | `requireAuth` + `POST /v1/auth/consent` |
| First-Time Onboarding: Create Household | Yes | **No (403)** | **No (403)** | `requireRole(["CITIZEN"])` |
| Add / Edit / Remove Family Members | Yes | No | No | `requireRole(["CITIZEN"])` + `ownerUid` check |
| View Own Household Eligibility & Guidance | Yes | No | No | `requireRole(["CITIZEN"])` + `ownerUid` check |
| Resolve Public NFC Card | Yes | Yes | Yes | Public (`POST /v1/nfc/resolve`) |
| Connect with ASHA via Service Code | Yes | No | No | `requireRole(["CITIZEN"])` |
| Submit Scheme Assistance Request | Yes | No | No | `requireRole(["CITIZEN"])` |
| Request PSTN Callback (`/voice/citizen/request-call`)| Yes | No | No | `requireRole(["CITIZEN"])` |
| Chat with AI Assistant Drawer | Yes | Yes | Yes | `requireAuth` + Role-Scoped Context |
| View Assigned Community Caseload | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Register/Create New Household | **No (403)** | **No (403)** | **No (403)** | `POST /v1/asha/cases` returns **403 FORBIDDEN_ROLE** |
| Provision / Rotate Household NFC Card | No | Yes (Assigned) | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Review / Accept / Decline Assistance Requests | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Create / Update Case Tasks & Notes | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Schedule / Complete Follow-Ups | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Trigger Outbound PSTN Call to Household | No | Yes | Yes | `requireRole(["ASHA", "ADMIN"])` |
| Submit Leave Request | No | Yes | No | `requireRole(["ASHA"])` |
| Approve / Reject ASHA Leave Requests | No | No | Yes | `requireRole(["ADMIN"])` |
| Reassign Cases Between ASHA Workers | No | No | Yes | `requireRole(["ADMIN"])` |
| Inspect All Platform Follow-Ups & Telemetry | No | No | Yes | `requireRole(["ADMIN"])` |
| Query External Evidence via Tavily Search | No | No | Yes | `requireRole(["ADMIN"])` |

---

## 6. High-Level System Architecture

```
                                +---------------------------------------+
                                |      Browser / Mobile Web Client      |
                                |  (Next.js 16 App Router + Tailwind)   |
                                +---------------------------------------+
                                     |                         |
               Firebase Auth Tokens  |                         | REST / JSON
                                     v                         v
+------------------------------------------------------------------------------------+
|                         Fastify 5 API Backend Daemon (Node.js)                     |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  | Authentication & RBAC Middleware Plugin                                      |  |
|  | - Token Verification: Firebase Admin SDK                                     |  |
|  | - Pre-Handler Guards: requireAuth, requireRole(roles), requireConsent         |  |
|  | - Security Headers: nosniff, DENY, strict-origin-when-cross-origin             |  |
|  +------------------------------------------------------------------------------+  |
|                                        |                                           |
|                                        v                                           |
|  +------------------------------------------------------------------------------+  |
|  | Domain Services Layer                                                        |  |
|  | - HouseholdService (1:1 Invariant, Atomic Onboarding)                       |  |
|  | - CaseService (Caseload, Tasks, Follow-ups, Journeys)                        |  |
|  | - NfcService (Provisioning, Rate-Limited Public Resolver, Two-Phase Rotation) |  |
|  | - LeaveService (Leave Management, Automated Temporary Case Delegation)     |  |
|  | - EligibilityService (Deterministic Rule Engine)                             |  |
|  | - ConnectionService (Service Code Resolution, Connection Requests)           |  |
|  | - AssistanceService (Citizen Assistance Lifecycle)                           |  |
|  | - VoiceGatewayService (Exotel Stream Gateway, Sarvam STT/TTS, Multilingual)  |  |
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

---

## 7. Complete Technology Stack

| Layer | Component | Version / Spec | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js (Turbopack) | `16.3.3` | App Router, Server Components, client-side dynamic state |
| **UI Library** | React | `19.0.0` | UI component tree and lifecycle |
| **Styling Engine** | Tailwind CSS | `3.4.1` | Curated design tokens, responsive layouts, accessibility |
| **Icons** | Lucide React | `^1.16.0` | Modern SVG iconography |
| **Backend Runtime** | Node.js | `>=20.0.0` | High-throughput asynchronous backend daemon |
| **Backend Framework** | Fastify | `5.2.1` | Low-overhead HTTP server and plugin ecosystem |
| **WebSockets** | `@fastify/websocket` | `^11.0.2` | Full-duplex audio streaming for Exotel PSTN gateway |
| **Authentication** | Firebase Admin / Client | `^13.1.0` / `^11.4.0` | Cryptographic JWT verification and identity management |
| **Database** | Google Cloud Firestore | Native NoSQL | Document storage with collection/subcollection hierarchies |
| **Contract Validation** | Zod | `3.24.2` | Strict runtime schema validation across frontend and backend |
| **Telephony Gateway** | Exotel Telephony | REST + WebSockets | Inbound/outbound carrier PSTN calls |
| **Speech-to-Text** | Sarvam AI Saaras | `saaras:v3` | 8kHz μ-law streaming speech recognition (`kn-IN`, `hi-IN`, `en-IN`) |
| **Text-to-Speech** | Sarvam AI Bulbul | `bulbul:v3` | 8kHz μ-law streaming speech synthesis (`kn-IN`, `hi-IN`, `en-IN`) |
| **Conversational AI** | Google Gemini | `gemini-2.5-flash` | Grounded multi-turn conversational health assistant |
| **Policy Search** | Tavily Search API | REST v1 | External official gazette and policy guideline retrieval |
| **Event Automation** | n8n | Webhook v1 | Asynchronous domain event orchestration |
| **Testing Suite** | Vitest | `3.2.7` | 54 test suites covering 689 unit, integration, and security tests |

---

## 8. Frontend Architecture & Route Inventory

### Complete Route Matrix

| Route Path | Access Level | Purpose | Major Components & Actions |
|---|---|---|---|
| `/` | Public | Landing page & entry point | Hero banner, "Tap / Scan NFC Card" CTA, public scheme cards, role quick-start cards, language toggle |
| `/nfc` | Public | Simplified NFC card reader | Physical Web NFC scanner, URL query resolver (`?hh=...&t=...`), privacy-minimal public view, multilingual support |
| `/auth/sign-in` | Public (Unauthenticated) | Role sign-in / registration | Role selector (Citizen, ASHA, Admin), credentials input, ASHA/Admin registration secret validation |
| `/auth/consent` | Authenticated (Pending Consent) | Statutory data consent | Privacy policy review, acceptance submission, redirection to role portal |
| `/citizen` | Role: `CITIZEN` + Consented | Citizen Onboarding & Portal | **First-Time Onboarding:** Unified household + head member form.<br>**Active Portal:** Overview, Household Members, Scheme Eligibility, Guidance Action Plan, ASHA Connection |
| `/asha` | Role: `ASHA` + Consented | ASHA Caseload Workspace | Caseload overview, attention signals, case detail inspection drawer (journey, gaps, notes, follow-ups, NFC modal), requests, leave |
| `/admin` | Role: `ADMIN` + Consented | Administrator Console | Platform overview, household caseload explorer, case reassignment, ASHA roster, scheme registry, evidence manager, leave approvals, telemetry |
| `/unauthorized` | Authenticated | Access denied | 403 Forbidden redirection screen |

---

## 9. Landing Page & Public Access Experience

The public homepage (`/frontend/app/page.tsx`) provides open access for all visitors:
1. **Header Navigation:** Brand logo, links to *About, Schemes, How It Works*, language selector (English, ಕನ್ನಡ, हिन्दी), **"NFC Card"** navigation link with active signal icon, and Authentication CTA.
2. **Hero Section:** Clear healthcare access value proposition with two primary action buttons:
   - **"Check Family Benefits"** (Directs to sign-in / registration).
   - **"Tap / Scan NFC Card"** (Pulsing radio icon, directs directly to `/nfc`).
3. **Role Quick-Start Cards:** Citizen, ASHA Worker, and Administrator entry pathways.
4. **Verified Scheme Showcase:** Authoritative scheme cards fetched from `GET /v1/schemes` detailing benefits and required documents.
5. **Session Detection:** Automatically routes authenticated users to their authorized workspace (`/citizen`, `/asha`, or `/admin`).

---

## 10. Authentication, Authorization & Consent Flow

### Authentication Flow
1. **User Sign-In / Registration:** Users authenticate via Firebase Authentication (email/password or phone).
2. **Privileged Role Secret Validation:**
   - When registering as `ASHA` or `ADMIN`, the client calls `POST /api/v1/auth/prevalidate` with `{ requestedRole, registrationSecret }`.
   - The backend validates the secret against SHA-256 hashed environment variables (`ASHA_REGISTRATION_SECRET_HASH`, `ADMIN_REGISTRATION_SECRET_HASH`).
   - If invalid, registration is rejected immediately with `401 Unauthorized`.
3. **Profile Synchronization (`/v1/auth/sync` or `/v1/auth/register`):**
   - The Fastify backend verifies the Firebase JWT token via Firebase Admin SDK.
   - The user profile in Firestore `/users/{uid}` is created or retrieved.
   - Initial role hint is respected only if verified; otherwise defaults to `CITIZEN`.
4. **Mandatory Consent Gate (`requireConsent`):**
   - Every protected API route enforces accepted consent (`userProfile.consentStatus === "accepted"`).
   - Unconsented users are redirected to `/auth/consent` to sign terms before accessing any data.

---

## 11. Citizen ↔ Household Architecture

### Architectural Invariants
1. **Citizens Exclusively Create Households:** ASHA workers and Administrators are prohibited from creating households.
2. **Strict 1 Citizen ↔ 1 Household Invariant:** Each authenticated Citizen account can own at most ONE household document.
3. **Deterministic Household Identifier:** The household document ID is deterministically derived from the Citizen's Firebase UID:
   $$\text{householdId} = \text{"hh\_"} + \text{ownerUid}$$
4. **Server-Enforced Ownership:** The `ownerUid` field is derived strictly from `request.user.uid` (the cryptographically verified JWT). Client-supplied `ownerUid` values are ignored.
5. **Duplicate Creation Prevention:** Any subsequent attempt by the same Citizen to create a household triggers:
   $$\text{HTTP } 409 \text{ Conflict} \quad \text{with code: } \text{"HOUSEHOLD\_ALREADY_EXISTS"}$$
6. **Role Guard:** `POST /api/v1/households` requires `requireRole(["CITIZEN"])`.
7. **Atomic Creation & Rollback:**
   - Household profile and initial Head-of-Household member are created together in a single atomic transaction/batch write (`HouseholdRepository.createHouseholdWithMembers`).
   - If household creation fails, no member is persisted.
   - If member creation fails, the household document is rolled back and deleted.
8. **Permanent Linking:** Once created, the Citizen Portal immediately renders the household dashboard; no duplicate setup prompts or buttons are displayed.

---

## 12. Citizen First-Time Onboarding & Portal

### First-Time Onboarding Experience
When an authenticated Citizen signs in and does not yet have an associated household (`!household && !isLoading`):
1. **Dedicated Onboarding View:** The tab navigation is hidden, and a single onboarding setup view is presented.
2. **Information Collected:**
   - **Address Information:** State, District, Village/Town, Pincode (6-digit numeric validation).
   - **Socio-Economic Category:** Income category (`BPL`, `AAY`, `APL`, `OTHER`), Ration card number.
   - **Head of Household Details:** Full Name, Age (numeric), Gender (`male`, `female`, `other`), Contact Phone (10-digit).
3. **Atomic Submission:** Submits to `POST /api/v1/households` with `headAge` and `headGender`.
4. **Instant Transition:** Upon success, the onboarding view dismisses, revealing the full Citizen Portal without page reloads.

### Citizen Portal Features
- **Overview Tab:** Quick family health coverage score, linked ASHA contact card, active assistance status, quick actions.
- **Household Members Tab:** Manage family roster. Add new members (relationship, age, gender, pregnancy, lactation, disability, chronic illness), edit existing members, remove members with full confirmation.
- **Scheme Eligibility Tab:** Deterministic eligibility evaluation cards across schemes (Eligible, Action Required, Ineligible) with detailed explanations, required documents, and legal citations.
- **Guidance & Action Plan Tab:** Personalized step-by-step roadmap to unlock pending entitlements and resolve coverage gaps.
- **ASHA Support Tab:** Search ASHA directory by service code, view active connection status, request assistance for specific family members and schemes.
- **Voice Helpline CTA:** Trigger an outbound phone callback via Exotel PSTN gateway.
- **Assistant Drawer:** AI-assisted interactive drawer powered by Google Gemini 2.5 Flash, grounded in household context.

---

## 13. ASHA Caseload Workspace Functional Specification

### Deprecation of ASHA Household Creation
- **UI Removal:** All "Register Household" buttons, register modals, and registration states were removed from the ASHA interface (`frontend/app/asha/page.tsx`).
- **Backend Blocking:** `POST /api/v1/asha/cases` is deprecated and rejects all requests with:
  $$\text{HTTP } 403 \text{ Forbidden} \quad \text{with code: } \text{"FORBIDDEN\_ROLE"}$$
- **Assigned Caseload Model:** ASHA workers manage households exclusively through Citizen Connection Request acceptance or Admin assignment.

### Implemented ASHA Capabilities
1. **Caseload Overview:** Real-time metrics on total assigned households, active cases, urgent attention signals, overdue follow-ups, and pending assistance requests.
2. **Assigned Caseload Directory:** Search assigned households by name, ration card, or district. Filter by status (`NEW`, `ACTIVE`, `NEEDS_ATTENTION`, `FOLLOW_UP`, etc.) and priority (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
3. **Case Detail Inspection Drawer:**
   - **Overview:** Household profile, address, socio-economic category, family roster.
   - **Journey Steps:** Multi-step scheme enrollment milestones (`PENDING`, `CURRENT`, `COMPLETED`, `BLOCKED`) with task completion checklists.
   - **Healthcare Gaps:** Deterministically detected gaps (unregistered pregnancy, unimmunized infant, senior citizen coverage gap).
   - **Scheme Eligibility:** Member-level scheme eligibility breakdown for the household.
   - **Field Notes:** Timestamped notes recorded during home visits.
   - **Follow-Up Scheduling:** Schedule upcoming visits with reasons and due dates; complete visits with outcome notes.
   - **Activity Timeline:** Immutable audit log of all case events (`CASE_CREATED`, `NOTE_ADDED`, `FOLLOWUP_SCHEDULED`, etc.).
   - **NFC Management Modal:** Launch `AshaNfcModal` to provision, write, rotate, or revoke the household's physical NFC card.
   - **Outbound Telephony:** Trigger an outbound voice call to the household's contact phone via Exotel.
4. **Proactive Attention Signals:** Deterministic cross-caseload engine flagging high-priority health vulnerabilities requiring immediate home visits.
5. **Assistance Requests Subtab:** Review inbound citizen assistance requests, accept requests into active cases, or decline with written reasons.
6. **Connection Requests Subtab:** Review citizen connection requests using the ASHA worker's unique Service Code.

---

## 14. ASHA ↔ Citizen Connection & Case Assignment

### Connection Mechanism
1. **ASHA Service Code:** Each ASHA worker is assigned a formatted service code (e.g., `ASHA-KA-7K42`).
2. **Directory Lookup (`GET /v1/asha/directory/:serviceCode`):** Citizens resolve the ASHA worker's public identity (display name, service area, code). Personal phone number, email, and UID are strictly excluded.
3. **Citizen Connection Request (`POST /v1/citizen/asha-connection/request`):** Citizen submits a connection request from their portal.
4. **ASHA Acceptance (`POST /v1/asha/connection-requests/:id/accept`):**
   - The connection request status updates to `ACCEPTED`.
   - The household is linked to the ASHA worker.
   - An `AshaCase` record is automatically created or assigned in the `cases` collection.
5. **Admin Case Assignment (`POST /v1/admin/cases/assign`):** Administrators can assign or reassign any household case to a valid ASHA worker across jurisdictions.

---

## 15. ASHA Leave Coverage & Caseload Delegation

### Leave Management Workflow
1. **Leave Submission (`POST /v1/asha/leave-requests`):** ASHA worker submits a leave request with start date, end date, and reason.
2. **Admin Review (`GET /v1/admin/leave-requests`):** Administrators view all pending leave requests.
3. **Available Worker Discovery (`GET /v1/admin/leave-requests/available-workers`):** Identifies active ASHA workers in nearby districts who are not currently on leave.
4. **Approval & Automated Delegation (`POST /v1/admin/leave-requests/:id/approve`):**
   - Admin approves the leave request and designates a temporary coverage ASHA worker.
   - The system automatically executes temporary delegation: all active cases assigned to the on-leave worker receive a `temporaryAssignment` metadata block pointing to the coverage worker.
   - The coverage worker gains authorized read/write access to the delegated caseload for the duration of the leave.
   - All delegations are logged in `asha_leave_audit_logs`.
5. **Automatic Restoration:** When the leave period expires, the background service evaluates and restores primary ownership back to the returning ASHA worker.

---

## 16. NFC System Architecture & Physical Tag Management

### Purpose & Hardware Requirements
SwasthyaSetu utilizes standard **NTAG213** NFC tags (Type 2 Tag, 144 bytes total user memory, 137 bytes usable NDEF storage). Tags are issued to households by authorized ASHA workers.

### Security Architecture & Invariants
1. **Zero Sensitive Data on Tag:** The physical NFC tag stores **ONLY** a minimal URL record:
   $$\text{https://<origin>/nfc?hh=hh\_<ownerUid>\&t=<token>}$$
   The tag strictly contains:
   - **NO** names or Aadhaar numbers.
   - **NO** phone numbers or addresses.
   - **NO** medical conditions or health records.
   - **NO** case notes or documents.
   - **NO** Firebase UIDs or cryptographic hashes.
2. **High-Entropy One-Time Token:** Provisioning generates a 16-byte cryptographically secure random token (32-character hex).
3. **One-Time Token Retrieval:** The raw token is returned to the ASHA client **exactly once** during provisioning to write to the physical card.
4. **Server Storage of Token Hash:** The server stores **ONLY** the SHA-256 hash (`tokenHash`) in `household_nfc/{nfcId}`. The raw token is never written to disk or database.
5. **NTAG213 Payload Capacity Optimization:**
   - For version 1 tags, the optional parameter `&v=1` is omitted, saving 4 bytes.
   - On client-side Web NFC writing, the writer prioritizes `window.location.origin` over long preview URLs.
   - Encoded NDEF URL records are guaranteed to stay under 117 bytes, fitting reliably into NTAG213 memory without causing Android `ERROR_IO` write errors.
6. **Web NFC Write Resilience:**
   - Physical writing uses `NDEFReader.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true })`.
   - Transient `NetworkError` exceptions are retried exactly once after a 250ms delay.
7. **Two-Phase Card Rotation:**
   - Initiation (`/rotate`): Generates a new pending token without invalidating the existing active card.
   - Confirmation (`/rotate/confirm`): Activates the new card only after the physical write succeeds, archiving the previous credential.
   - Cancellation (`/rotate/cancel`): Aborts rotation if physical writing fails, leaving the old card intact.

---

## 17. Public NFC Access vs Authenticated Citizen Access

| Dimension | Public NFC Tap View (`/nfc`) | Authenticated Citizen Portal (`/citizen`) |
|---|---|---|
| **Authentication** | Unauthenticated (requires physical card token) | Firebase JWT Bearer Token |
| **Identity Display** | Generic display name (e.g., "Ramesh Kumar Household") | Full authenticated user profile & names |
| **Ration Card Number** | **Hidden / Excluded** | Full number visible to household owner |
| **Income Category** | **Hidden / Excluded** | Visible (BPL, AAY, APL) |
| **Contact Phone Number** | **Hidden / Excluded** | Visible & editable |
| **Individual Family Members** | **Hidden / Excluded** (No individual roster) | Full member roster, ages, genders, relationships |
| **Health Indicators** | **Hidden / Excluded** (No pregnancy, chronic illness data) | Full health conditions & indicators |
| **Scheme Benefits** | High-level eligible scheme names & benefits summary | Detailed eligibility evaluations, criteria traces, document checklists |
| **ASHA Worker Information** | Safe public display name, service area, and service code | Direct messaging, assistance tracking, connection status |
| **Actions Permitted** | Read-only benefit overview, language toggle | Add/edit members, submit assistance requests, request phone callback |
| **Security Protection** | IP Rate Limiting (10 req/min), Constant-Time SHA-256 | RBAC (`requireRole(["CITIZEN"])`), IDOR ownership verification |

---

## 18. Admin Console Functional Specification

### Implemented Administrative Features
1. **Platform Caseload Oversight:** Real-time platform metrics: total registered households, active cases, urgent attention signals, overdue follow-ups, and system health status.
2. **Household Directory & Case Reassignment:** Search and inspect any household across jurisdictions. Reassign cases between ASHA workers via `POST /api/v1/admin/cases/assign`.
3. **ASHA Workforce Roster:** Track active ASHA workers, district assignments, active caseloads, overdue follow-up counts, and active leave status.
4. **Scheme Registry Inspector:** Inspect versioned scheme criteria, benefit rules, legal definitions, and required documentation.
5. **Evidence & Policy Management:** Explore official evidence documents, perform external gazette queries via Tavily Search API, and resolve knowledge conflicts.
6. **Cross-Jurisdiction Follow-Ups:** Monitor platform-wide follow-up schedules across all field workers.
7. **ASHA Leave Administration:** Inspect incoming leave requests, discover available coverage workers, and approve leaves with automatic caseload delegation.
8. **Telemetry & System Health:** Live monitors for Exotel telephony gateway status, Sarvam STT/TTS health, and n8n webhook automation health.

---

## 19. Healthcare Scheme & Deterministic Eligibility Engine

### Core Scheme Registry
The platform is seeded with 6 authoritative health schemes:
1. **`ab-pmjay` (Ayushman Bharat - PM-JAY):** Secondary and tertiary hospitalization cover up to ₹5,00,000 per family per year for BPL/AAY families, and universal coverage for senior citizens aged 70+ regardless of income.
2. **`jsy` (Janani Suraksha Yojana):** Conditional cash assistance for institutional delivery among pregnant women in low-performing states.
3. **`jssk` (Janani Shishu Suraksha Karyakram):** Free zero-expense delivery and sick newborn care up to 1 year of age in public health facilities.
4. **`pmmvy` (Pradhan Mantri Matru Vandana Yojana):** Maternity cash benefits for first and second living children.
5. **`state-health-assurance` (National Health Assurance Framework):** Baseline state health protection package.
6. **`ab-ark-karnataka` (Ayushman Bharat - Arogya Karnataka):** State-specific co-branded health assurance for Karnataka residents.

### Deterministic Engine Execution (`rule-engine.ts`)
- Evaluates household and member attributes against active scheme version criteria JSON.
- Checks: Age, Gender, Pregnancy status, Lactating status, Income category, State residency, Family size, and Disability status.
- Returns structured results per scheme:
  - `status`: `ELIGIBLE` | `ACTION_REQUIRED` | `INELIGIBLE`
  - `matchedCriteria`: List of satisfied criteria.
  - `unmatchedCriteria`: List of unsatisfied criteria.
  - `requiredDocuments`: Mandatory documentation required for card issuance/hospital admission.
  - `legalCitation`: Direct citation to authoritative government gazette or operational guidelines.

---

## 20. Evidence & Policy Guidance Subsystem

### Evidence System
- Stored in Firestore `/evidence` (10 authoritative policy records preserved during database resets).
- Contains gazette notification numbers, issuing ministries, effective dates, and verified source URLs.
- **Source Validator (`source-validator.ts`):** Validates external URLs and policy documents against official government domains (`.gov.in`, `.nic.in`).
- **Tavily Search Integration (`tavily.service.ts`):** Allows administrators to query external legal databases for updated policy amendments.
- **Evidence Cache (`evidence_search_cache`):** Caches search results to optimize external API quota.

---

## 21. Assistance Requests & Case Management Engine

### Assistance Request Lifecycle
1. `SUBMITTED`: Citizen submits assistance request specifying scheme, member, category, and message.
2. `ACCEPTED`: ASHA worker reviews and accepts request, linking it to an active field case.
3. `DECLINED`: ASHA declines request with an explanatory note.
4. `RESOLVED`: Field assistance is completed.

### Case Management Engine (`AshaCase`)
- Tracks status transitions: `NEW` $\rightarrow$ `ACTIVE` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `NEEDS_ATTENTION` $\rightarrow$ `FOLLOW_UP` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED`.
- Priority levels: `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- Multi-step scheme journey milestone tracker (`SchemeJourneyStep`).
- Subcollections:
  - `activities`: Immutable event log.
  - `notes`: Field observations.
  - `follow_ups`: Scheduled visits.
  - `tasks`: Actionable tasks assigned to the case.

---

## 22. Follow-Up Scheduling & Task Engine

### Follow-Up Workflow
- Scheduled with `scheduledAt`, `reason`, and priority.
- Statuses: `SCHEDULED` $\rightarrow$ `COMPLETED` | `RESCHEDULED` | `CANCELLED`.
- Categorized dynamically into:
  - **Due Today:** Scheduled for current date.
  - **Overdue:** Past scheduled date and still open.
  - **Upcoming:** Scheduled for future dates.
  - **Completed:** Successfully finished with notes.

---

## 23. Multilingual Website & UI Localization

- Complete UI translation parity across **English (`en`)**, **Kannada (`kn`)**, and **Hindi (`hi`)**.
- Stored in structured translation dictionaries (`frontend/i18n/`).
- Includes localized routes, navigation items, status badges, NFC scanner instructions, and error messages.
- Language selection is preserved across sessions via `localStorage` and URL parameters.

---

## 24. Interactive PSTN Voice & Telephony Architecture

### Telephony Specifications
- **Gateway:** Exotel Telephony.
- **Voice Pipeline:** Exotel REST API triggers outbound calls; connects audio stream to Fastify backend over full-duplex WebSocket (`/api/v1/voice/stream`).
- **Audio Codec:** Standard carrier G.711 μ-law at 8000Hz.
- **Frame Chunking:** Audio transcoded and chunked in precise 20ms (160-byte) frames.
- **Speech-to-Text (STT):** Sarvam AI `saaras:v3` supporting Kannada, Hindi, and Indian English.
- **Text-to-Speech (TTS):** Sarvam AI `bulbul:v3` supporting natural speech synthesis in regional languages.
- **Conversational NLU (`multilingual-nlu.ts`):** Deterministic intent recognition for scheme inquiries, eligibility checks, and assistance requests. Zero hallucination of medical advice.

---

## 25. Artificial Intelligence Services & Guardrails

### AI Providers & Roles
1. **Google Gemini 2.5 Flash (`assistant.service.ts`):**
   - Powers the interactive Healthcare Assistant Drawer.
   - Context is strictly bounded by deterministic eligibility outputs and verified household data.
   - Guardrail: AI is explicitly prompted never to invent schemes, diagnosis codes, or prescription advice.
2. **Lyzr AI Studio V3 (`lyzr.service.ts`):**
   - Contextual scheme explanations cached in `ai_intelligence_cache`.
3. **Tavily Search API:**
   - Admin-only legal document retrieval.

---

## 26. Database & Firestore Data Model

### Reference vs Operational Data Separation

#### Official Government Reference Collections (PRESERVED ACROSS RESETS)
- **`schemes`:** 6 authoritative health scheme documents.
  - Subcollection: `versions` (criteria JSON, effective dates, document checklists).
- **`evidence`:** 10 official government gazette citations and policy guidelines.

#### Operational / Runtime Collections (RESET IN TESTING / CLEAN ENVIRONMENTS)
- **`users`:** User profiles and `consent_history` subcollections.
- **`households`:** Household profile documents (`hh_${ownerUid}`) and `members` subcollections.
- **`cases`:** ASHA field cases and subcollections (`activities`, `notes`, `follow_ups`, `tasks`).
- **`household_nfc`:** Household NFC credential records (SHA-256 token hashes).
- **`asha_connection_requests`:** Citizen-to-ASHA connection links.
- **`asha_assistance_requests`:** Inbound assistance tickets.
- **`asha_leave_requests`:** ASHA leave requests.
- **`asha_temporary_assignments`:** Temporary caseload delegations.
- **`asha_leave_audit_logs`:** Audit trail of leave approvals and delegations.
- **`voice_sessions`:** PSTN call session records and turn transcripts.
- **`ai_intelligence_cache` & `evidence_search_cache`:** Volatile AI response caches.

---

## 27. Complete API Specification

### Authentication & Consent (`/api/v1/auth`)
- `POST /v1/auth/prevalidate`: Pre-validates ASHA/Admin registration secrets.
- `POST /v1/auth/register`: Registers profile with validated role.
- `POST /v1/auth/sync`: Syncs Firebase user to Firestore profile.
- `GET /v1/auth/me`: Retrieves authenticated user profile.
- `POST /v1/auth/consent`: Submits statutory data consent.

### Household & Members (`/api/v1/households`)
- `POST /v1/households`: **Citizen-only** atomic creation of household + head member. Returns `409 Conflict` on duplicate.
- `GET /v1/households/me`: Retrieves authenticated Citizen's household and members.
- `PATCH /v1/households/me`: Updates household profile.
- `POST /v1/households/me/members`: Adds a family member.
- `PATCH /v1/households/me/members/:memberId`: Updates a member.
- `DELETE /v1/households/me/members/:memberId`: Deletes a member.

### Public NFC Resolution (`/api/v1/nfc`)
- `POST /v1/nfc/resolve`: Resolves public privacy-minimal household summary. Rate-limited.

### ASHA NFC Management (`/api/v1/asha/households/:householdId/nfc`)
- `POST /v1/asha/households/:householdId/nfc`: Provisions NFC tag; returns raw token once.
- `GET /v1/asha/households/:householdId/nfc`: Gets NFC status metadata.
- `DELETE /v1/asha/households/:householdId/nfc`: Revokes tag.
- `POST /v1/asha/households/:householdId/nfc/rotate`: Starts rotation.
- `POST /v1/asha/households/:householdId/nfc/rotate/confirm`: Confirms physical write.
- `POST /v1/asha/households/:householdId/nfc/rotate/cancel`: Cancels rotation.

### ASHA Case Management (`/api/v1/asha/cases`)
- `POST /v1/asha/cases`: **DISABLED / REJECTED WITH 403 FORBIDDEN_ROLE**.
- `GET /v1/asha/cases`: Lists assigned cases.
- `GET /v1/asha/cases/summary`: Summary metrics.
- `GET /v1/asha/cases/:caseId`: Detailed case record with journey, gaps, schemes.
- `PATCH /v1/asha/cases/:caseId`: Updates status or priority.
- `POST /v1/asha/cases/:caseId/notes`: Adds field note.
- `POST /v1/asha/cases/:caseId/follow-ups`: Schedules follow-up.
- `PATCH /v1/asha/cases/:caseId/follow-ups/:followUpId/complete`: Completes follow-up.
- `GET /v1/asha/cases/:caseId/activities`: Activity history log.
- `GET /v1/asha/intelligence/attention-signals`: Deterministic attention signals.

### Citizen ↔ ASHA Connection (`/api/v1/connection`)
- `GET /v1/asha/directory/:serviceCode`: Resolves safe public ASHA profile.
- `POST /v1/citizen/asha-connection/request`: Citizen submits connection request.
- `GET /v1/citizen/asha-connection/status`: Citizen checks connection status.
- `DELETE /v1/citizen/asha-connection`: Citizen revokes connection.
- `GET /v1/asha/connection-requests`: ASHA lists connection requests.
- `POST /v1/asha/connection-requests/:id/accept`: ASHA accepts request and assigns case.
- `POST /v1/asha/connection-requests/:id/decline`: ASHA declines request.

### Citizen Assistance Requests (`/api/v1/assistance`)
- `POST /v1/citizen/assistance/request`: Submits assistance request.
- `GET /v1/citizen/assistance`: Lists own requests.
- `GET /v1/asha/assistance`: ASHA lists incoming requests.
- `PATCH /v1/asha/assistance/:id`: ASHA updates status (`ACCEPTED`, `DECLINED`, `RESOLVED`).

### ASHA Leave & Delegation (`/api/v1/leave`)
- `POST /v1/asha/leave-requests`: ASHA submits leave request.
- `GET /v1/asha/leave-requests`: ASHA lists own requests.
- `GET /v1/admin/leave-requests`: Admin lists platform leave requests.
- `GET /v1/admin/leave-requests/available-workers`: Discovers available coverage workers.
- `POST /v1/admin/leave-requests/:id/approve`: Approves leave with temporary caseload delegation.
- `POST /v1/admin/leave-requests/:id/reject`: Rejects leave request.

### Admin Management (`/api/v1/admin`)
- `GET /v1/admin/cases`: Lists all platform cases.
- `POST /v1/admin/cases/assign`: Assigns/reassigns case to ASHA worker.
- `GET /v1/admin/follow-ups`: Lists all platform follow-ups.
- `GET /v1/admin/automation/health`: n8n webhook health.
- `GET /v1/admin/voice/telemetry`: Telephony gateway health.

### Voice & Telephony (`/api/v1/voice`)
- `GET /v1/voice/stream`: WebSocket audio streaming endpoint for Exotel carrier gateway.
- `POST /v1/voice/citizen/request-call`: Citizen requests callback.
- `POST /v1/voice/asha/call-beneficiary`: ASHA initiates outbound call.
- `GET /v1/voice/public-config`: Public helpline number and languages.

---

## 28. Security, Privacy & IDOR Protection Architecture

1. **Role-Based Access Control (RBAC):** Every route checks token signature, role membership (`requireRole`), and consent (`requireConsent`).
2. **Server-Enforced Ownership:**
   - Citizen endpoints derive `ownerUid` from `request.user.uid`.
   - Citizens cannot read or modify households owned by other UIDs (tested and verified).
3. **Caseload IDOR Defense:**
   - ASHA workers can only access cases where `assignedAshaUid === userProfile.uid` or where an active `temporaryAssignment` exists.
   - Access attempts to unassigned cases return `404 Not Found` (tested and verified).
4. **NFC Security Architecture:**
   - Raw tokens are never stored on the server.
   - Server validates SHA-256 hashes using constant-time comparisons (`crypto.timingSafeEqual`).
   - Resolution endpoint enforces IP rate limiting (10 attempts/min).
   - NFC possession grants access strictly to privacy-minimal public DTO, never full citizen portal access.
5. **Secret Protection:**
   - Zero exposure of API keys (`SARVAM_API_KEY`, `EXOTEL_API_TOKEN`, `FIREBASE_PRIVATE_KEY`, `TAVILY_API_KEY`) to clients or public endpoints.

---

## 29. Non-Functional Requirements

### Security & Privacy
- Zero leakage of Personally Identifiable Information (PII) or Personal Health Identifiers (PHI) over public endpoints or voice streams.
- All network traffic encrypted over TLS 1.3.
- HTTP security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

### Reliability & Atomicity
- Single atomic transaction for household and head member onboarding: zero partially configured households.
- Automatic transactional rollback in repository layer on batch write failure.
- Two-phase commit for NFC card rotation: failed writes never invalidate existing physical cards.

### Performance
- Fastify server throughput: <50ms response times for deterministic scheme evaluations.
- Telephony audio stream latency: <300ms round-trip latency for speech recognition and synthesis.
- Frontend Next.js Turbopack build: Clean production compilation in under 1 second.

### Accessibility & Device Compatibility
- Fully responsive across desktop, tablet, and low-cost mobile Android browsers.
- Web NFC writing compliant with Chrome Android and NTAG213 physical memory boundaries.
- Offline-safe fallback instructions for devices without NFC hardware.

---

## 30. Implementation Status Matrix & Known Limitations

### Implementation Status Matrix

| Module / Feature | Implemented | Partially Implemented | Future / Not Implemented | Details |
|---|:---:|:---:|:---:|---|
| **Citizen First-Time Onboarding** | **Yes** | | | Unified atomic household + head member setup. |
| **1 Citizen ↔ 1 Household Invariant** | **Yes** | | | Rejects duplicate creations with 409 Conflict. |
| **ASHA Household Creation Deprecation** | **Yes** | | | UI removed; API blocked with 403 Forbidden. |
| **ASHA Caseload Workspace** | **Yes** | | | Caseload list, filters, metrics, and case drawer. |
| **NFC Provisioning & Card Writing** | **Yes** | | | Web NFC, NTAG213 optimization, retry on error. |
| **NFC Public Resolver** | **Yes** | | | Rate-limited, timing-safe SHA-256 validation. |
| **Two-Phase NFC Rotation** | **Yes** | | | Init, confirm, and cancel lifecycle. |
| **Deterministic Eligibility Engine** | **Yes** | | | 6 authoritative central/state health schemes. |
| **Evidence & Policy Guidance** | **Yes** | | | 10 gazette records, Tavily legal search. |
| **Citizen ↔ ASHA Connections** | **Yes** | | | Service code lookup, request, accept, decline. |
| **Citizen Assistance Requests** | **Yes** | | | Submit, accept into case, decline, resolve. |
| **ASHA Leave & Caseload Delegation** | **Yes** | | | Leave request, admin approval, case delegation. |
| **Trilingual UI Localization** | **Yes** | | | English, Kannada, Hindi full parity. |
| **Exotel PSTN Telephony Gateway** | **Yes** | | | Full-duplex WebSocket, 8kHz μ-law streaming. |
| **Sarvam AI Voice STT & TTS** | **Yes** | | | `saaras:v3` STT, `bulbul:v3` TTS in 3 languages. |
| **Conversational Assistant Drawer** | **Yes** | | | Gemini 2.5 Flash grounded in household data. |
| **n8n Webhook Automation** | **Yes** | | | Asynchronous domain event dispatcher. |
| **Direct Bank PFMS Integration** | | | **Future** | Out of scope; DBT tracking only. |
| **Native Carrier SMS Broadcasting** | | **Partial** | | Dispatched via n8n; no direct SMPP modem. |
| **Languages outside en, kn, hi** | | | **Future** | Planned for Telugu, Tamil, Marathi in Phase G. |

---

## 31. Glossary of Terms

- **ASHA (Accredited Social Health Activist):** Frontline community healthcare worker appointed under India's National Rural Health Mission.
- **AB-PMJAY:** Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana.
- **AB-ARK:** Ayushman Bharat - Arogya Karnataka.
- **JSY:** Janani Suraksha Yojana (safe motherhood cash assistance).
- **JSSK:** Janani Shishu Suraksha Karyakram (zero-expense delivery and neonatal care).
- **PMMVY:** Pradhan Mantri Matru Vandana Yojana.
- **NTAG213:** High-frequency NFC IC conforming to ISO/IEC 14443 Type A with 144 bytes total user memory.
- **NDEF (NFC Data Exchange Format):** Standardized data format for NFC physical cards.
- **IDOR (Insecure Direct Object Reference):** Access control vulnerability prevented by server-enforced UID ownership and caseload assignment checks.
- **PSTN (Public Switched Telephone Network):** Traditional circuit-switched carrier telephone network.
- **G.711 μ-law:** Companded pulse-code modulation (PCM) standard operating at 8000 samples per second.
