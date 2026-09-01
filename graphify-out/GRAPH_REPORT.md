# Graph Report - sih-final  (2026-09-01)

## Corpus Check
- 285 files · ~445,978 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1899 nodes · 5001 edges · 123 communities (104 shown, 19 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 415 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1a3e027`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- src/config/constants.ts
- auth-context.tsx
- .getUserById
- types/evidence.ts
- scheme.schema.ts
- types/guidance.ts
- dependencies
- dependencies
- .generateIntelligence
- AshaConnectionRequest
- types/eligibility.ts
- plugins/auth.ts
- assistant.service.ts
- citizen/page.tsx
- UserProfile
- ai.schema.ts
- compilerOptions
- compilerOptions
- AIContext
- package.json
- gap.service.ts
- SECTION I: CURRENT IMPLEMENTATION DEEP DIVE
- shared/package.json
- case.service.ts
- AiService
- AutomationService
- INotificationService
- ISchemeService
- ITelephonyService
- api.d.ts
- IEligibilityService
- FirebaseService
- types/voice.ts
- frontend/types/api.ts
- common.schema.ts
- types/index.ts
- actions.d.ts
- common.ts
- common.d.ts
- eligibility.d.ts
- gaps.d.ts
- use-media-query.ts
- health.schema.ts
- household.d.ts
- next.config.ts
- common.schema.d.ts
- common.schema.js
- health.schema.d.ts
- health.schema.js
- VoiceSession
- exotel-stream-gateway.service.ts
- asha/page.tsx
- ApiResult
- toVoiceLanguage
- SwasthyaSetu — Software Requirements Specification (SRS)
- AshaAssistanceRequest
- routes/index.ts
- SWASTHYASETU — COMPLETE SYSTEM DISCOVERY, END-TO-END FUNCTIONALITY AUDIT & USER-FLOW FORENSICS
- sarvam.service.ts
- i18n-context.tsx
- 2. DETAILED E2E TEST EVIDENCE & RESULTS (SECTIONS A — J)
- case.schema.ts
- types/ai.ts
- api-client.ts
- privileged-auth.service.ts
- 3. Forensic Root-Cause Analysis & Fixes Implemented
- voice.schema.ts
- header.tsx
- UserRepository
- routes/auth.ts
- SwasthyaSetu — Scheme-Assistance Workflow Specification
- routes/connection.ts
- SwasthyaSetu — Phase 10: Actions, Follow-ups & n8n Automation Engine
- evidence.schema.ts
- Production-Grade Bidirectional Voice Streaming Gateway
- SwasthyaSetu — Scheme Journey, Task & Milestone Counting Model Audit
- button.tsx
- ApiClient
- BaseFirestoreRepository
- Sarvam AI + Exotel Multilingual Voice & Telephony Assistance
- SwasthyaSetu — Scheme Registry & Deterministic Rule Engine Architecture
- VoiceServiceClient
- SwasthyaSetu — System Architecture & Architectural Principles
- SwasthyaSetu — SIH 2026
- routes/assistance.ts
- 2. Color Palette & Tokens
- Privileged Account Provisioning & Security Architecture
- 28. Complete API Specification
- LyzrService
- routes/household.ts
- 2.1 Collection Schemas
- 3. Usage & CLI Commands
- sign-in/page.tsx
- 3. Endpoints Summary
- SarvamService
- 11. Citizen Portal Functional Specification
- 12. ASHA Workspace Functional Specification
- 13. Admin Console Functional Specification
- firebase.ts
- 35. Complete A-to-Z User Journeys
- 36. Status Enums & Finite State Machines
- 3. System Objectives
- 10. Authentication, Authorization & Consent Flow
- 14. Healthcare Scheme & Deterministic Eligibility Engine
- 15. Case Management & Beneficiary Journey Engine
- 16. Assistance Request & Connection Lifecycle
- 17. Follow-Up & Scheduling Subsystem
- 23. Voice Assistant Conversational Intelligence
- 24. Telephony Audio Pipeline & Codec Transcoding
- 26. n8n Automation & Domain Event Architecture
- 34. Data Flow Diagrams
- 38. Testing & Quality Assurance Strategy
- 41. Deployment & Infrastructure Topology
- 4. System Scope
- 6. High-Level System Architecture
- AGENTS.md
- 18. Multilingual Website & UI Localization (Phase E)
- 5. User Roles & Permission Matrix

## God Nodes (most connected - your core abstractions)
1. `ApiResult` - 71 edges
2. `UserProfile` - 62 edges
3. `HouseholdRepository` - 54 edges
4. `CaseRepository` - 51 edges
5. `SwasthyaSetu — Software Requirements Specification (SRS)` - 49 edges
6. `SchemeRepository` - 46 edges
7. `toVoiceLanguage()` - 45 edges
8. `VoiceSession` - 43 edges
9. `CaseService` - 41 edges
10. `useTranslation()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `VerificationResult` --references--> `UserRole`  [EXTRACTED]
  backend/src/services/privileged-auth.service.ts → shared/types/auth.ts
- `buildApp()` --indirect_call--> `corsPlugin()`  [INFERRED]
  backend/src/app.ts → backend/src/plugins/cors.ts
- `FastifyRequest` --references--> `UserProfile`  [EXTRACTED]
  backend/src/plugins/auth.ts → shared/types/auth.ts
- `voiceRoutes()` --calls--> `toVoiceLanguage()`  [EXTRACTED]
  backend/src/routes/voice.ts → shared/types/voice.ts
- `StreamSessionContext` --references--> `VoiceSession`  [EXTRACTED]
  backend/src/services/telephony/exotel-stream-gateway.service.ts → shared/types/voice.ts

## Import Cycles
- None detected.

## Communities (123 total, 19 thin omitted)

### Community 0 - "cn"
Cohesion: 0.09
Nodes (27): Shell(), ShellProps, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle (+19 more)

### Community 1 - "src/config/constants.ts"
Cohesion: 0.13
Nodes (17): runSeed(), buildApp(), APP_NAME, APP_VERSION, CORRELATION_ID_HEADER, DEFAULT_USER_ROLE, HTTP_STATUS, REQUEST_ID_HEADER (+9 more)

### Community 2 - "auth-context.tsx"
Cohesion: 0.27
Nodes (14): CURRENT_CONSENT_VERSION, DEFAULT_USER_ROLE, AuthContext, AuthContextType, AuthProvider(), authSendPasswordReset(), authSignInWithEmail(), authSignInWithGoogle() (+6 more)

### Community 3 - ".getUserById"
Cohesion: 0.24
Nodes (3): authPlugin(), UserService, ConsentRecord

### Community 4 - "types/evidence.ts"
Cohesion: 0.08
Nodes (24): runPhase6FirestoreSmoke(), runPhase6TavilySmoke(), EvidenceRepository, EvidenceService, SourceValidator, ValidatedSourceResult, TavilySearchOptions, TavilyService (+16 more)

### Community 5 - "scheme.schema.ts"
Cohesion: 0.08
Nodes (28): EligibilityResultSchema, EligibilityStatusSchema, MissingRequirementDetailSchema, RuleEvaluationDetailSchema, ActionPlanItemSchema, DocumentReadinessItemSchema, DocumentStatusSchema, GapPrioritySchema (+20 more)

### Community 6 - "types/guidance.ts"
Cohesion: 0.23
Nodes (10): ActionPlanService, DocumentReadinessService, GapDetectionService, EligibilityResult, SchemeVersion, DocumentReadinessItem, DocumentStatus, Gap (+2 more)

### Community 7 - "dependencies"
Cohesion: 0.04
Nodes (47): dependencies, dotenv, fastify, @fastify/cors, fastify-plugin, @fastify/sensible, @fastify/websocket, firebase-admin (+39 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (40): clsx, firebase, dependencies, clsx, firebase, lucide-react, next, react (+32 more)

### Community 9 - ".generateIntelligence"
Cohesion: 0.23
Nodes (5): runPhase7FirestoreSmoke(), AICacheRepository, AIIntelligenceCacheRecord, AIIntelligenceRequest, AIIntelligenceResponse

### Community 10 - "AshaConnectionRequest"
Cohesion: 0.10
Nodes (5): ConnectionService, HouseholdService, AshaConnectionRequest, ConnectionRequestStatus, GuidanceResponse

### Community 11 - "types/eligibility.ts"
Cohesion: 0.11
Nodes (26): runPhase4FirestoreSmoke(), evaluateRule(), evaluateRuleSet(), evaluateScalarComparison(), evaluateScheme(), memberMatchesRule(), RuleEvaluationResult, RuleSetEvaluationResult (+18 more)

### Community 12 - "plugins/auth.ts"
Cohesion: 0.17
Nodes (17): fastify, FastifyInstance, AssistanceRepository, ConnectionRepository, HouseholdRepository, SchemeRepository, AIContextBuilder, AssistantService (+9 more)

### Community 13 - "assistant.service.ts"
Cohesion: 0.07
Nodes (19): migrateFirestorePhase4C(), AssistantServiceError, RateLimitRecord, GeminiGenerateOptions, GeminiProviderError, GeminiService, buildAssistantSystemInstruction(), ChatEntry (+11 more)

### Community 14 - "citizen/page.tsx"
Cohesion: 0.11
Nodes (25): ASSISTANCE_CATEGORIES, GENDER_OPTIONS, INCOME_OPTIONS, RELATIONSHIP_OPTIONS, Input, InputProps, CitizenCallModal(), CitizenCallModalProps (+17 more)

### Community 15 - "UserProfile"
Cohesion: 0.13
Nodes (8): runFirestoreCaseSmokeTest(), runSmokeTest(), FastifyRequest, CaseRepository, CaseService, UserProfile, CaseFollowUp, CaseTask

### Community 16 - "ai.schema.ts"
Cohesion: 0.11
Nodes (17): LyzrServiceConfig, AIActionPlanItemSchema, AICapabilitySchema, AICertaintyStateSchema, AIContextSchema, AIEligibilitySummarySchema, AIEvidenceReferenceSchema, AIExistingActionSummarySchema (+9 more)

### Community 17 - "compilerOptions"
Cohesion: 0.09
Nodes (23): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+15 more)

### Community 18 - "compilerOptions"
Cohesion: 0.07
Nodes (29): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+21 more)

### Community 19 - "AIContext"
Cohesion: 0.32
Nodes (7): buildActionPlanPrompt(), buildEvidenceSummaryPrompt(), buildGapPrioritizationPrompt(), buildNeedsInformationPrompt(), PROMPT_VERSION, SYSTEM_SAFETY_RULES, AIContext

### Community 20 - "package.json"
Cohesion: 0.13
Nodes (14): shared, name, private, scripts, build, dev, dev:backend, dev:frontend (+6 more)

### Community 21 - "gap.service.ts"
Cohesion: 0.22
Nodes (5): GapService, IGapService, GapSeverity, GapStatus, HealthcareGap

### Community 22 - "SECTION I: CURRENT IMPLEMENTATION DEEP DIVE"
Cohesion: 0.04
Nodes (47): 1. Calculation & Persistence, 1. Conceptual Shift: Two Equal Doors to the Same Journey, 1. Connection Document & Data Model, 1. Deterministic Attention Signals Matrix, 1. Gap Definition & Detection, 1. Proactively Initiate Scheme Assistance, 2. Can an ASHA Currently Discover Gaps Proactively?, 2. Current ASHA Access (+39 more)

### Community 23 - "shared/package.json"
Cohesion: 0.22
Nodes (8): dependencies, zod, zod, main, name, private, type, version

### Community 24 - "case.service.ts"
Cohesion: 0.10
Nodes (32): CaseServiceError, CancelCaseFollowUpInput, CompleteCaseFollowUpInput, CompleteCaseTaskInput, CreateCaseFollowUpInput, CreateCaseNoteInput, CreateCaseTaskInput, RescheduleCaseFollowUpInput (+24 more)

### Community 26 - "AutomationService"
Cohesion: 0.12
Nodes (4): AutomationService, IAutomationService, InboundAutomationWebhookInput, AutomationDomainEvent

### Community 30 - "api.d.ts"
Cohesion: 0.40
Nodes (4): ApiErrorResponse, ApiResult, ErrorDetail, HealthCheckResponse

### Community 33 - "types/voice.ts"
Cohesion: 0.08
Nodes (33): env, EnvConfig, envSchema, corsPlugin(), startServer(), ExotelCallResult, ExotelOutboundOptions, ExotelTelephonyError (+25 more)

### Community 34 - "frontend/types/api.ts"
Cohesion: 0.50
Nodes (3): ApiErrorResponse, ApiResult, HealthCheckResponse

### Community 35 - "common.schema.ts"
Cohesion: 0.50
Nodes (3): ApiErrorResponseDto, ApiErrorResponseSchema, ErrorDetailSchema

### Community 36 - "types/index.ts"
Cohesion: 0.33
Nodes (3): ActionResolution, EvidenceRecord, FollowUp

### Community 37 - "actions.d.ts"
Cohesion: 0.50
Nodes (3): ActionResolution, EvidenceRecord, FollowUp

### Community 38 - "common.ts"
Cohesion: 0.50
Nodes (3): AuditLogEntry, PaginationParams, StatusType

### Community 39 - "common.d.ts"
Cohesion: 0.50
Nodes (3): AuditLogEntry, PaginationParams, StatusType

### Community 40 - "eligibility.d.ts"
Cohesion: 0.50
Nodes (3): EligibilityResult, Scheme, SchemeRule

### Community 41 - "gaps.d.ts"
Cohesion: 0.50
Nodes (3): GapSeverity, GapStatus, HealthcareGap

### Community 50 - "VoiceSession"
Cohesion: 0.11
Nodes (6): VoiceSessionRepository, ExotelService, VoiceGatewayService, CallHistoryItem, ExotelInboundWebhookPayload, VoiceSession

### Community 51 - "exotel-stream-gateway.service.ts"
Cohesion: 0.11
Nodes (25): calculatePcmRms(), chunkAudioBuffer(), createWavHeader(), extractPcmFromWav(), linear16ToMulaw(), linear16ToMulawSample(), MULAW_TO_LINEAR_TABLE, mulawToLinear16() (+17 more)

### Community 52 - "asha/page.tsx"
Cohesion: 0.12
Nodes (29): AdminPage(), AshaWorkerSummary, AshaWorkspacePage(), ConsentPage(), CitizenPage(), HomePage(), UnauthorizedPage(), HealthcareAssistantDrawer() (+21 more)

### Community 53 - "ApiResult"
Cohesion: 0.11
Nodes (3): CaseServiceClient, ConnectionServiceClient, ApiResult

### Community 54 - "toVoiceLanguage"
Cohesion: 0.17
Nodes (3): VoiceActionService, VoiceResponseFormatter, toVoiceLanguage()

### Community 55 - "SwasthyaSetu — Software Requirements Specification (SRS)"
Cohesion: 0.07
Nodes (29): 19.1 Website-to-Voice Language Binding & Precedence Rules, 19. Sarvam Multilingual Voice Architecture (Phase F & Phase 11), 1. Executive Summary, 20. End-to-End PSTN Voice Call Flow, 21. Sarvam Saaras Speech-to-Text (STT) Specification, 22. Sarvam Bulbul Text-to-Speech (TTS) Specification, 25. Exotel Telephony & WebSocket Streaming Integration, 27. Database & Firestore Data Model (+21 more)

### Community 56 - "AshaAssistanceRequest"
Cohesion: 0.16
Nodes (7): AssistanceService, AshaAssistanceRequest, AssistanceCategory, AssistancePriority, AssistanceStatus, CreateAssistanceRequestInput, UpdateAssistanceRequestInput

### Community 57 - "routes/index.ts"
Cohesion: 0.26
Nodes (18): requireAuth(), requireConsent(), requireRole(), aiRoutes(), assistanceRoutes(), assistantRoutes(), authRoutes(), caseRoutes() (+10 more)

### Community 58 - "SWASTHYASETU — COMPLETE SYSTEM DISCOVERY, END-TO-END FUNCTIONALITY AUDIT & USER-FLOW FORENSICS"
Cohesion: 0.08
Nodes (23): Distinction of Workflows, Final Classification, Readiness Breakdown, SECTION A — EXECUTIVE SUMMARY, SECTION B — THE COMPLETE USER JOURNEY, SECTION C — SYSTEM ARCHITECTURE, SECTION D — ROLE RESPONSIBILITY MATRIX, SECTION E — CITIZEN FUNCTIONALITY AUDIT (+15 more)

### Community 59 - "sarvam.service.ts"
Cohesion: 0.17
Nodes (12): MultilingualNLU, NUMBER_WORDS, SemanticParseResult, SarvamIntentExtractionResult, SarvamSttResponse, SarvamTtsResponse, LocalizedKnowledgeItem, KnowledgeMatchResult (+4 more)

### Community 60 - "i18n-context.tsx"
Cohesion: 0.17
Nodes (14): I18nContext, I18nContextValue, I18nProvider(), interpolate(), resolveKey(), TRANSLATION_MAP, en, hi (+6 more)

### Community 61 - "2. DETAILED E2E TEST EVIDENCE & RESULTS (SECTIONS A — J)"
Cohesion: 0.10
Nodes (20): 1. EXECUTIVE SUMMARY & ACCEPTANCE TEST VERDICT, 2. DETAILED E2E TEST EVIDENCE & RESULTS (SECTIONS A — J), 3. GRANULAR PASS / FAIL MATRIX, 4. SIMPLE HUMAN LANGUAGE EXPLANATION, "How does the ASHA actually help the Citizen?" — The Real-World Story, "If I am the Admin, what do I do?", "If I am the ASHA, what do I do?", "If I am the Citizen, what do I do?" (+12 more)

### Community 62 - "case.schema.ts"
Cohesion: 0.17
Nodes (18): AssignCaseInput, AssignCaseInputSchema, CancelCaseFollowUpInputSchema, CasePrioritySchema, CaseStatusSchema, CaseTaskStatusSchema, CompleteCaseFollowUpInputSchema, CompleteCaseTaskInputSchema (+10 more)

### Community 65 - "types/ai.ts"
Cohesion: 0.19
Nodes (16): AIActionPlanItem, AICapability, AICertaintyState, AIEligibilitySummary, AIEvidenceReference, AIExistingActionSummary, AIGapSummary, AIHouseholdSummary (+8 more)

### Community 66 - "api-client.ts"
Cohesion: 0.18
Nodes (10): HealthState, AuthFailureCallback, authService, eligibilityService, evidenceService, guidanceService, ApiErrorResponse, HealthCheckResponse (+2 more)

### Community 67 - "privileged-auth.service.ts"
Cohesion: 0.18
Nodes (7): args, hash, AttemptRecord, PrivilegedAuthService, VerificationResult, hashSecret(), verifySecretHash()

### Community 69 - "3. Forensic Root-Cause Analysis & Fixes Implemented"
Cohesion: 0.11
Nodes (17): 1. Executive Summary & Core Principles, 2. State Transition Lifecycle Matrix, 3. Forensic Root-Cause Analysis & Fixes Implemented, 4. Single Source of Truth & Counting Model Rules, 5. Automated Verification & Test Coverage, A. PM-JAY (Ayushman Bharat — Senior Citizen & Vulnerable Household), B. JSY (Janani Suraksha Yojana — Maternal Health & Institutional Delivery), Bug #1: Journey Appears Completed Before Starting (+9 more)

### Community 70 - "voice.schema.ts"
Cohesion: 0.11
Nodes (17): AshaCallRequestInput, AshaCallRequestSchema, CitizenCallRequestInput, CitizenCallRequestSchema, ExotelInboundWebhook, ExotelInboundWebhookSchema, ExotelStatusCallback, ExotelStatusCallbackSchema (+9 more)

### Community 71 - "header.tsx"
Cohesion: 0.24
Nodes (10): metadata, viewport, BrandLogo(), BrandLogoProps, SIZE_MAP, Footer(), Header(), MobileNav() (+2 more)

### Community 72 - "UserRepository"
Cohesion: 0.23
Nodes (5): UserRepository, ConnectionServiceError, ConsentStatus, ConsentSubmission, RoleAssignmentRequest

### Community 73 - "routes/auth.ts"
Cohesion: 0.17
Nodes (14): CURRENT_CONSENT_VERSION, maskEmail(), ConsentStatusSchema, ConsentSubmissionInput, ConsentSubmissionSchema, RoleAssignmentInput, RoleAssignmentSchema, RolePrevalidateInput (+6 more)

### Community 74 - "SwasthyaSetu — Scheme-Assistance Workflow Specification"
Cohesion: 0.12
Nodes (15): 1. Overview & Architectural Purpose, 2. Supported Schemes & Versioned Pathways, 3. Common Assistance Domain Model, 4. State Machines, 5. Security & Multi-Tenant IDOR Boundaries, 6. API Map, 7. Firestore Data Hierarchy, A. Assistance Request (`asha_assistance_requests/{requestId}`) (+7 more)

### Community 75 - "routes/connection.ts"
Cohesion: 0.16
Nodes (11): AssistantChatRequestInput, AssistantChatRequestSchema, AssistantLanguageSchema, AssistantMessageInput, AssistantMessageSchema, AssistantRoleSchema, AshaServiceCodeSchema, ConnectionActionInput (+3 more)

### Community 76 - "SwasthyaSetu — Phase 10: Actions, Follow-ups & n8n Automation Engine"
Cohesion: 0.13
Nodes (14): 1. Core Architectural Principle: Single Source of Truth & Safe Automation, 2. Follow-Up Data Model & Lifecycle State Machine, 3. Scheme-Specific Deterministic Follow-Up Policy, 4. Inbound & Outbound Automation Integration, 5. Production n8n Workflow Artifacts, 6. RBAC & Security Isolation, Complete Field Schema (`CaseFollowUp`), Inbound Webhook Receiver (`POST /api/v1/automation/webhook`) (+6 more)

### Community 77 - "evidence.schema.ts"
Cohesion: 0.16
Nodes (12): requireAdmin, EvidenceConflictSchema, EvidenceConflictStatusSchema, EvidenceConflictTypeSchema, EvidenceRecordSchema, EvidenceSearchRequestSchema, EvidenceVerificationMethodSchema, EvidenceVerificationStatusSchema (+4 more)

### Community 78 - "Production-Grade Bidirectional Voice Streaming Gateway"
Cohesion: 0.14
Nodes (13): 1. Architecture Overview, 2. WebSocket Endpoint Specifications, 3. Exotel Stream Protocol & Event Lifecycle, 4. Audio Processing & Codec Transcoding, 5. Session & Caller Identity Association, 6. Environment Configuration, 7. Step-by-Step Testing & Verification Procedure, Inbound Events (Exotel $\longrightarrow$ SwasthyaSetu) (+5 more)

### Community 79 - "SwasthyaSetu — Scheme Journey, Task & Milestone Counting Model Audit"
Cohesion: 0.14
Nodes (13): 1. Executive Summary & Semantic Definitions, 2. Mathematical Counting Models, 3. Mathematical Mapping: Tasks $\longrightarrow$ Journey Milestones, 4. Origin of the "11/11" Count in Previous Scenarios, 5. Authoritative State Rules Summary, A. Ayushman Bharat PM-JAY (Senior Citizen 70+ Universal), B. Janani Suraksha Yojana (JSY), Exact JSY Field Action Tasks (6 Tasks): (+5 more)

### Community 80 - "button.tsx"
Cohesion: 0.25
Nodes (9): Badge(), BadgeProps, ButtonProps, StatusBadgeProps, BadgeVariant, ButtonSize, ButtonVariant, NavItem (+1 more)

### Community 82 - "BaseFirestoreRepository"
Cohesion: 0.24
Nodes (3): BaseFirestoreRepository, FilterCondition, ListOptions

### Community 83 - "Sarvam AI + Exotel Multilingual Voice & Telephony Assistance"
Cohesion: 0.17
Nodes (11): 1. Architectural Overview & Design Philosophy, 2. Provider API Contracts Verified, 3. Privacy-First Identity Gate, 4. Authoritative Business Boundaries (Strict Allowlist), 5. Outbound Follow-up Security, 6. n8n Telephony Workflow Integration, 7. Verification Summary, A. Sarvam AI (Current Production Baseline) (+3 more)

### Community 84 - "SwasthyaSetu — Scheme Registry & Deterministic Rule Engine Architecture"
Cohesion: 0.17
Nodes (11): 1. Overview, 2.1 `/schemes/{schemeId}` Document, 2.2 `/schemes/{schemeId}/versions/{versionId}` Document, 2. Cloud Firestore Data Model, 3.1 Supported Operators, 3.2 Boolean Composition, 3. Deterministic Rule Grammar & Operators, 4. API Endpoints (+3 more)

### Community 85 - "VoiceServiceClient"
Cohesion: 0.17
Nodes (4): VoiceServiceClient, InitiateOutboundCallInput, VerifyCallerIdentityInput, VoiceTurnInput

### Community 86 - "SwasthyaSetu — System Architecture & Architectural Principles"
Cohesion: 0.18
Nodes (10): 1. System Overview, 2.1 Authentication vs. Authorization vs. Consent, 2.2 Role Architecture & Authoritative Source, 2. Authentication, Roles & Authorization (Phase 2), 3.1 Ownership Model & Security, 3.2 Member Subcollection Isolation, 3. Household Onboarding & Management (Phase 3), 4. Observability & Correlation Tracing (+2 more)

### Community 87 - "SwasthyaSetu — SIH 2026"
Cohesion: 0.18
Nodes (10): 1. Architecture Overview, 2. Repository Structure, 3. Local Development Setup, 4. Running Automated Tests & Builds, 5. Phase 3 Implemented Capabilities, Backend Vitest Test Suite (28 Tests), Full Production Build (Backend + Frontend), Prerequisites (+2 more)

### Community 88 - "routes/assistance.ts"
Cohesion: 0.24
Nodes (7): parseResultError(), AssistanceServiceError, AssistanceCategoryEnum, AssistancePriorityEnum, AssistanceStatusEnum, CreateAssistanceRequestSchema, UpdateAssistanceRequestSchema

### Community 89 - "2. Color Palette & Tokens"
Cohesion: 0.20
Nodes (9): 1. Design Philosophy, 2.1 Neutral Surfaces & Typography, 2.2 Healthcare Accent, 2.3 Semantic Status Palette, 2.4 Strictly Prohibited Styles, 2. Color Palette & Tokens, 3. Responsive Breakpoints, 4. Accessibility Baseline (+1 more)

### Community 90 - "Privileged Account Provisioning & Security Architecture"
Cohesion: 0.20
Nodes (9): 1. Security Architecture & Invariants, 2. Generating & Configuring Privileged Secrets, 3. Provisioning Workflow, 4. API Endpoints, 5. Automated Test Coverage, Privileged Account Provisioning & Security Architecture, Step 1: Generate a SHA-256 Hash, Step 2: Configure Environment Variables (+1 more)

### Community 91 - "28. Complete API Specification"
Cohesion: 0.20
Nodes (10): 28.1 Health & Diagnostics, 28.2 Authentication & User Governance, 28.3 Household & Family Management, 28.4 Scheme Registry & Eligibility, 28.5 ASHA Connection & Caseload, 28.6 Assistance Requests & Case Management, 28.7 Voice & Telephony, 28.8 Automation & n8n Webhooks (+2 more)

### Community 92 - "LyzrService"
Cohesion: 0.33
Nodes (3): runPhase7LyzrSmoke(), LyzrService, buildEligibilityExplanationPrompt()

### Community 93 - "routes/household.ts"
Cohesion: 0.33
Nodes (7): CreateHouseholdSchema, CreateMemberSchema, GenderSchema, IncomeCategorySchema, MaternalStatusSchema, UpdateHouseholdSchema, UpdateMemberSchema

### Community 94 - "2.1 Collection Schemas"
Cohesion: 0.22
Nodes (8): 1. Architectural Boundary, 1. `households` (`/households/{householdId}`), 2.1 Collection Schemas, 2. Implemented Collections (Phase 1–4), 2. `members` (`/households/{householdId}/members/{memberId}`), 3. Future Domain Collections (Phase 5+), 3. `schemes` (`/schemes/{schemeId}`) & `/versions/{versionId}`, SwasthyaSetu — Cloud Firestore Data Architecture & Security

### Community 95 - "3. Usage & CLI Commands"
Cohesion: 0.22
Nodes (8): 1. Overview, 2. Directory Structure, 3. Usage & CLI Commands, Fast Code-Only Scan (AST Mode), Full Graph Scan, Incremental Update (After Code Changes), Querying the Knowledge Graph, SwasthyaSetu — Graphify Knowledge Graph Documentation

### Community 96 - "sign-in/page.tsx"
Cohesion: 0.36
Nodes (5): SignInPage(), DevStatusBar(), env, useHealthCheck(), getFriendlyAuthErrorMessage()

### Community 97 - "3. Endpoints Summary"
Cohesion: 0.25
Nodes (7): 1. API Architecture Conventions, 2. Request Correlation & Observability, 3. Endpoints Summary, Authentication & Consent (`/api/v1/auth/*`), Health Check, Household & Member Management (`/api/v1/households/*`), SwasthyaSetu — API Specification & Contract Conventions

### Community 99 - "11. Citizen Portal Functional Specification"
Cohesion: 0.29
Nodes (7): 11.1 Household Profile Management, 11.2 Family Member Roster, 11.3 ASHA Worker Connection Card, 11.4 Recommended Schemes & Entitlement Status, 11.5 Next Steps & Priority Action Checklist, 11.6 PSTN Callback Modal & Voice Assistant, 11. Citizen Portal Functional Specification

### Community 100 - "12. ASHA Workspace Functional Specification"
Cohesion: 0.29
Nodes (7): 12.1 Operational Metric Dashboard, 12.2 Attention Signal Triage, 12.3 Caseload Directory & Search, 12.4 Assistance Request Management, 12.5 Case Detail Inspection Drawer, 12.6 Field Registration Flow, 12. ASHA Workspace Functional Specification

### Community 101 - "13. Admin Console Functional Specification"
Cohesion: 0.29
Nodes (7): 13.1 Platform Overview Dashboard, 13.2 Complete Household Directory, 13.3 ASHA Workforce Management, 13.4 Platform-Wide Case Oversight, 13.5 Scheme Registry & Policy Governance, 13.6 System Monitoring & Telemetry, 13. Admin Console Functional Specification

### Community 102 - "firebase.ts"
Cohesion: 0.50
Nodes (4): fastify, FastifyInstance, firebasePlugin(), resolveFilePath()

### Community 103 - "35. Complete A-to-Z User Journeys"
Cohesion: 0.40
Nodes (5): 35. Complete A-to-Z User Journeys, Journey 1: Citizen Onboarding & Assistance Request, Journey 2: ASHA Worker Field Caseload Management, Journey 3: Administrator System Governance, Journey 4: Interactive Feature-Phone Voice Consultation

### Community 104 - "36. Status Enums & Finite State Machines"
Cohesion: 0.40
Nodes (5): 36.1 Case Status Enum, 36.2 Assistance Request Status Enum, 36.3 Follow-Up Status Enum, 36.4 Voice Session Status Enum, 36. Status Enums & Finite State Machines

### Community 105 - "3. System Objectives"
Cohesion: 0.40
Nodes (5): 3. System Objectives, Administrator Objectives, ASHA Worker Objectives, Citizen Objectives, Platform & Technical Objectives

### Community 106 - "10. Authentication, Authorization & Consent Flow"
Cohesion: 0.67
Nodes (3): 10.1 Multi-Stage Authentication Flow, 10.2 Server-Side Security Guards, 10. Authentication, Authorization & Consent Flow

### Community 107 - "14. Healthcare Scheme & Deterministic Eligibility Engine"
Cohesion: 0.67
Nodes (3): 14.1 Verified Production Schemes, 14.2 Deterministic Evaluation Logic, 14. Healthcare Scheme & Deterministic Eligibility Engine

### Community 108 - "15. Case Management & Beneficiary Journey Engine"
Cohesion: 0.67
Nodes (3): 15.1 Case Lifecycle State Machine, 15.2 Case Data Structure & Subcollections, 15. Case Management & Beneficiary Journey Engine

### Community 109 - "16. Assistance Request & Connection Lifecycle"
Cohesion: 0.67
Nodes (3): 16.1 Citizen-to-ASHA Connection Lifecycle, 16.2 Assistance Request Flow, 16. Assistance Request & Connection Lifecycle

### Community 110 - "17. Follow-Up & Scheduling Subsystem"
Cohesion: 0.67
Nodes (3): 17.1 Categorization Rules, 17.2 Actions, 17. Follow-Up & Scheduling Subsystem

### Community 111 - "23. Voice Assistant Conversational Intelligence"
Cohesion: 0.67
Nodes (3): 23.1 Supported Voice Intents, 23.2 Code-Switching & Kanglish / Hinglish Tolerance, 23. Voice Assistant Conversational Intelligence

### Community 112 - "24. Telephony Audio Pipeline & Codec Transcoding"
Cohesion: 0.67
Nodes (3): 24.1 Precomputed ITU-T G.711 Transcoding Table, 24.2 Frame Invariants, 24. Telephony Audio Pipeline & Codec Transcoding

### Community 113 - "26. n8n Automation & Domain Event Architecture"
Cohesion: 0.67
Nodes (3): 26.1 Core Non-Blocking Invariant, 26.2 Verified n8n Workflows (`/docs/n8n-workflows/`), 26. n8n Automation & Domain Event Architecture

### Community 114 - "34. Data Flow Diagrams"
Cohesion: 0.67
Nodes (3): 34.1 Citizen Entitlement & Assistance Flow, 34.2 Real-Time Multilingual Voice Stream Flow, 34. Data Flow Diagrams

### Community 115 - "38. Testing & Quality Assurance Strategy"
Cohesion: 0.67
Nodes (3): 38.1 Verified Test Execution Summary, 38.2 Key Test Suites, 38. Testing & Quality Assurance Strategy

### Community 116 - "41. Deployment & Infrastructure Topology"
Cohesion: 0.67
Nodes (3): 41.1 Local Development Topology, 41.2 Production Topology, 41. Deployment & Infrastructure Topology

### Community 117 - "4. System Scope"
Cohesion: 0.67
Nodes (3): 4. System Scope, In Scope (Fully Implemented & Verified), Out of Scope (Explicitly Excluded / Non-Goals)

### Community 118 - "6. High-Level System Architecture"
Cohesion: 0.67
Nodes (3): 6.1 Web Application & Data Plane Architecture, 6.2 Real-Time PSTN Voice & Telephony Architecture, 6. High-Level System Architecture

## Knowledge Gaps
- **592 isolated node(s):** `name`, `version`, `private`, `description`, `main` (+587 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HouseholdRepository` connect `plugins/auth.ts` to `types/voice.ts`, `SarvamService`, `types/evidence.ts`, `UserRepository`, `AshaConnectionRequest`, `assistant.service.ts`, `UserProfile`, `BaseFirestoreRepository`, `case.service.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `Household` connect `plugins/auth.ts` to `types/ai.ts`, `src/config/constants.ts`, `api-client.ts`, `types/evidence.ts`, `types/guidance.ts`, `UserRepository`, `types/eligibility.ts`, `citizen/page.tsx`, `gap.service.ts`, `ApiResult`, `case.service.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `SchemeRepository` connect `plugins/auth.ts` to `src/config/constants.ts`, `types/evidence.ts`, `types/eligibility.ts`, `assistant.service.ts`, `BaseFirestoreRepository`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _592 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._
- **Should `src/config/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13240418118466898 - nodes in this community are weakly interconnected._
- **Should `types/evidence.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08050655811849841 - nodes in this community are weakly interconnected._