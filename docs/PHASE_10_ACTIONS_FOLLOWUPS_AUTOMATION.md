# SwasthyaSetu — Phase 10: Actions, Follow-ups & n8n Automation Engine

This document provides the authoritative reference for Phase 10 of the SwasthyaSetu healthcare assistance platform: Actions, Follow-ups, and n8n Workflow Automation Architecture.

---

## 1. Core Architectural Principle: Single Source of Truth & Safe Automation

In SwasthyaSetu, **business logic, state machines, deterministic scheme eligibility, role-based access control, and persistence live strictly within the core application backend** (Node.js/Fastify + Cloud Firestore).

### What n8n Is vs What It Is Not

| Aspect | Core SwasthyaSetu Backend | n8n Automation Orchestrator |
|---|---|---|
| **Authoritative State** | **YES** (Source of Truth) | **NO** (Stateless runner) |
| **Eligibility Decisions** | **YES** (Deterministic Rule Engine) | **NO** (Cannot decide eligibility) |
| **RBAC & Authorization** | **YES** (Token & Role Verification) | **NO** (Cannot authorize users) |
| **Case Lifecycle Transitions** | **YES** ($5/5$ PM-JAY, $6/6$ JSY) | **NO** (Cannot mark cases resolved) |
| **Task / Milestone Logic** | **YES** (Immutable Audit Trail) | **NO** (Dispatches reminders only) |
| **Failure Mode** | Self-contained, resilient | **Non-blocking fallback** (Graceful degradation) |

> [!IMPORTANT]
> A reminder dispatched by n8n or an external channel is **NOT** a task or case completion. Case resolution depends exclusively on verified task milestones executed by authorized actors (e.g. ASHA workers or Citizens) on the SwasthyaSetu platform.

---

## 2. Follow-Up Data Model & Lifecycle State Machine

Follow-up tasks are stored as first-class persisted entities under `cases/{caseId}/followups/{followUpId}`.

```
                    ┌──────────────────────────────────────────────┐
                    │                   PENDING                    │
                    └──────────────────────┬───────────────────────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
                 [dueAt == today]   [dueAt < today]   [dueAt > today]
                   (DUE TODAY)        (OVERDUE)         (UPCOMING)
                        │                  │                  │
                        └──────────────────┼──────────────────┘
                                           │
                         ┌─────────────────┴─────────────────┐
                         │                                   │
                         ▼                                   ▼
                   ┌───────────┐                       ┌───────────┐
                   │ COMPLETED │                       │ CANCELLED │
                   └───────────┘                       └───────────┘
```

### Complete Field Schema (`CaseFollowUp`)

```typescript
export interface CaseFollowUp {
  id: string;                          // Unique ID: fu_<timestamp>_<rand>
  caseId: string;                      // Linked parent case ID
  householdId?: string;                // Denormalized household ID
  headOfHouseholdName?: string;        // Head of household name
  assignedAshaUid?: string;            // Assigned ASHA worker UID
  schemeId?: string | null;            // Linked scheme (e.g. "ab-pmjay", "jsy")
  schemeName?: string | null;          // Human-readable scheme name
  beneficiaryMemberId?: string | null; // Specific family member ID
  beneficiaryName?: string | null;     // Beneficiary full name
  title?: string;                      // Actionable title
  reason: string;                      // Detailed reason / objective
  dueAt: string;                       // ISO 8601 target completion date
  scheduledAt: string;                 // Backward compatibility alias
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  isOverdue?: boolean;                 // Server-computed dynamically
  completedAt?: string | null;         // ISO 8601 timestamp
  completedBy?: string | null;         // Actor display name
  outcome?: string | null;             // Mandatory resolution outcome
  notes?: string | null;               // Field observations
  rescheduledAt?: string | null;       // Timestamp of reschedule
  rescheduleReason?: string | null;    // Mandatory reschedule reason
  cancelledAt?: string | null;         // Timestamp of cancellation
  cancelledBy?: string | null;         // Actor display name
  cancelReason?: string | null;        // Mandatory cancellation reason
  sourceTaskId?: string | null;        // Auto-triggering source task ID
  createdAt: string;                   // ISO 8601 timestamp
  updatedAt: string;                   // ISO 8601 timestamp
}
```

---

## 3. Scheme-Specific Deterministic Follow-Up Policy

When an ASHA worker completes a scheme task, the system automatically schedules the next logical doorstep visit:

### PM-JAY Assistance Journey (5 Tasks / 7 Milestones)

| Step | Task Completed | Automatic Follow-Up Generated | Due Horizon |
|---|---|---|---|
| **1** | Confirm Senior/Family Eligibility & Consent | `PM-JAY e-KYC & Registration Assistance` | +2 days |
| **2** | Assist with Aadhaar e-KYC on Portal | `Verify PM-JAY Application Submission` | +3 days |
| **3** | Submit / Track BIS Application | `Check Ayushman Card Generation Status` | +5 days |
| **4** | Download & Verify Ayushman Card | `Deliver Ayushman Card & Hospital Network Guidance` | +2 days |
| **5** | Handover Card & Empanelled Hospital List | **RESOLVES CASE ($5/5$)** — Marks intermediate follow-ups complete and halts all reminders | N/A |

### JSY Maternal Health Journey (6 Tasks / 8 Milestones)

| Step | Task Completed | Automatic Follow-Up Generated | Due Horizon |
|---|---|---|---|
| **1** | Confirm Pregnancy & Issue MCP Card | `Antenatal Care (ANC) & MCP Card Follow-up` | +7 days |
| **2** | Coordinate ANC & Checkup Schedule | `Map Institutional Delivery Hospital & Ambulance` | +14 days |
| **3** | Verify Facility Mapping & Transport (108) | `Birth Preparedness & Delivery Readiness Check` | +14 days |
| **4** | Delivery Support & 48h Stay Monitoring | `48-Hour Postnatal Visit & Newborn Vaccines` | +2 days |
| **5** | Conduct Postnatal Visit & Newborn Care | `Track JSY Cash Incentive DBT Transfer` | +10 days |
| **6** | Verify ₹1,400 DBT Bank Transfer | **RESOLVES CASE ($6/6$)** — Marks intermediate follow-ups complete and halts all reminders | N/A |

---

## 4. Inbound & Outbound Automation Integration

### Outbound Webhook Dispatcher (`AutomationService.emitDomainEvent`)

- **Trigger**: Any major domain transition (`TASK_COMPLETED`, `FOLLOWUP_CREATED`, `FOLLOWUP_CANCELLED`, `CASE_RESOLVED`).
- **Security**: HMAC-SHA256 signature in `X-SwasthyaSetu-Signature` header using `N8N_WEBHOOK_SECRET`.
- **Payload Redaction**: Recursively redacts passwords, tokens, API keys, and sensitive auth credentials.
- **Resilience**: 3,000ms AbortSignal timeout. Non-blocking; failures do not impact core domain transactions.
- **Fallback**: Gracefully falls back to `N8N_UNCONFIGURED` when no webhook URL is configured.

### Inbound Webhook Receiver (`POST /api/v1/automation/webhook`)

- **Authentication**: Requires `X-N8N-Webhook-Secret` or `Authorization: Bearer <secret>`.
- **Idempotency**: Circular deduplication buffer caches `eventId` to ignore retry duplicates.
- **Audit Logging**: Dispatches `AUTOMATION_DISPATCHED` activity entry onto parent case.

### Status Query Endpoint (`GET /api/v1/automation/cases/:caseId/follow-ups/:followUpId/status`)

- **Returns**: `{ followUp, caseStatus, shouldHalt: boolean }`.
- **Halt Contract**: If `caseStatus === "RESOLVED"` or `followUp.status !== "PENDING"`, returns `shouldHalt: true` so external automation workflows safely terminate without sending stale reminders.

---

## 5. Production n8n Workflow Artifacts

Located in `docs/n8n-workflows/`:

1. **`SwasthyaSetu_FollowUp_Dispatcher.json`**: Listens for outbound domain events, checks pre-flight status, and confirms dispatch.
2. **`SwasthyaSetu_Due_FollowUp_Poller.json`**: Hourly cron job querying `/api/v1/automation/due-follow-ups` to trigger timely field notifications.
3. **`SwasthyaSetu_Overdue_Escalator.json`**: Daily 9:00 AM cron escalating follow-ups overdue by >48 hours to the ASHA supervisor queue.
4. **`SwasthyaSetu_Case_Lifecycle_Orchestrator.json`**: Listens for `CASE_RESOLVED` events and terminates all active reminders and queues for that case.

---

## 6. RBAC & Security Isolation

- **CITIZEN**: Can view own household status, track connected ASHA assistance, and view action plan. Cannot modify case tasks, complete follow-ups, or access automation telemetry.
- **ASHA**: Can create, complete, reschedule, and cancel follow-ups for assigned caseload. Cannot view other ASHA rosters or platform-wide telemetry.
- **ADMIN**: Can view platform-wide caseload, follow-up telemetry, and orchestrator status (`/api/v1/admin/automation/health`).
