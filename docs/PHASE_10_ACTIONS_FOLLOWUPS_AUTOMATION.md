# SWASTHYASETU — PHASE 10 ARCHITECTURE SPECIFICATION
## Actions, Follow-ups & n8n Automation Architecture

---

## 1. Executive Summary & Architectural Overview

Phase 10 elevates SwasthyaSetu from a proactive intelligence and case management system into a complete **closed-loop operational execution and follow-up engine**.

```
+---------------------------------------------------------------------------------------------------+
|                                      SWASTHYASETU PHASE 10                                       |
|                                                                                                   |
|  [Household & Eligibility Gaps]                                                                   |
|              │                                                                                    |
|              ▼                                                                                    |
|  [Proactive ASHA Action]                                                                          |
|              │                                                                                    |
|              ▼                                                                                    |
|  [Field Task Execution] ──► (Generates Deterministic Next Follow-up)                              |
|              │                          │                                                         |
|              │                          ▼                                                         |
|              │                  [Due Date Engine] (Today, Overdue, Upcoming)                     |
|              │                          │                                                         |
|              │                          ▼                                                         |
|              │                  [ASHA Field Visit & Outcome Recorded]                            |
|              │                          │                                                         |
|              ▼                          ▼                                                         |
|  [Case Journey Resolution] ◄────────────┴─► [Optional n8n Automation / Domain Event Dispatcher]   |
+---------------------------------------------------------------------------------------------------+
```

### Core Architecture Principles:
1. **Authoritative Source of Truth**: SwasthyaSetu's PostgreSQL/Firestore database and domain services are strictly authoritative.
2. **Zero External Hard Dependency**: n8n automation is an **optional, non-blocking notification layer**. The platform executes at 100% capacity when `N8N_WEBHOOK_URL` is empty, unreachable, times out (3-second limit), or returns 500 errors.
3. **No Fake Automation**: Internal state changes are explicitly labeled (e.g. `Follow-up scheduled`, `Workflow Auto-Triggered`). No misleading labels like "SMS delivered" appear unless backed by an actual integrated provider.
4. **Deterministic Counting Model**: Adheres strictly to the audited counting model (PM-JAY: 5 tasks / 7 milestones; JSY: 6 tasks / 8 milestones) without infinite loops or state desynchronization.

---

## 2. ASHA Action & Follow-Up Domain Models

### A. CaseFollowUp Model
Follow-ups are first-class, persistent domain entities linked to a Case, Household, Beneficiary Member, and Scheme.

```typescript
export interface CaseFollowUp {
  id: string;
  caseId: string;
  householdId: string;
  headOfHouseholdName?: string;
  assignedAshaUid?: string;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  title?: string;
  reason: string;
  dueAt: string;                       // ISO 8601 server timestamp
  scheduledAt: string;                 // ISO 8601 server timestamp
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  outcome?: string | null;             // Mandatory on completion
  notes?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  rescheduledAt?: string | null;
  rescheduleReason?: string | null;
  sourceTaskId?: string | null;        // Task that triggered this follow-up (Idempotency key)
  isOverdue?: boolean;                 // Computed dynamically server-side
  createdAt: string;
  updatedAt: string;
}
```

### B. Dynamic Due Date & Overdue Computation
Due dates are stored as unambiguous UTC ISO timestamps. Overdue status is evaluated server-side on demand:

$$\text{isOverdue} = (\text{status} = \text{"PENDING"}) \land (\text{dueAt} < \text{now}) \land \neg \text{isSameDay}(\text{dueAt}, \text{now})$$

Summary KPIs (`dueToday`, `upcoming`, `overdue`, `completed`) are computed dynamically across the ASHA worker's entire caseload without stale cached values.

---

## 3. Deterministic Automatic Follow-up Matrix

When an ASHA worker completes a scheme field task via `PATCH /api/v1/asha/cases/:caseId/tasks/:taskId/complete`, the system automatically schedules the next deterministic follow-up:

### A. Ayushman Bharat PM-JAY (Senior Citizen 70+)
| Completed Task | Auto-Generated Next Follow-up Title | Due Interval | Purpose & Guidance |
| :--- | :--- | :--- | :--- |
| **Task 1**: `CONFIRM_BENEFICIARY` | **PM-JAY e-KYC & Registration Assistance** | +3 Days | Assist senior citizen with official Aadhaar e-KYC and PM-JAY registration at CSC/portal. |
| **Task 2**: `ENROLLMENT_GUIDANCE` | **Verify PM-JAY Application Submission** | +7 Days | Verify PM-JAY application submission and record reference acknowledgment number. |
| **Task 3**: `VERIFY_ENROLLMENT` | **Check Ayushman Card Generation Status** | +5 Days | Check Ayushman Card generation and digital/physical receipt for beneficiary. |
| **Task 4**: `CONFIRM_CARD` | **Deliver Ayushman Card & Hospital Network Guidance** | +3 Days | Deliver Ayushman Card to beneficiary and inform family of nearest empaneled hospitals for ₹5 Lakh cover. |
| **Task 5**: `BENEFIT_GUIDANCE` | *(Resolves Case & Scheme Journey)* | 0 Days | Completes scheme journey, resolves case to `RESOLVED`, clears `nextFollowUpAt`, and marks intermediate follow-ups `COMPLETED`. |

### B. Janani Suraksha Yojana (JSY Maternal Care)
| Completed Task | Auto-Generated Next Follow-up Title | Due Interval | Purpose & Guidance |
| :--- | :--- | :--- | :--- |
| **Task 1**: `CONFIRM_PREGNANCY` | **Antenatal Care (ANC) & MCP Card Follow-up** | +7 Days | Ensure Mother and Child Protection (MCP) card issuance and schedule Antenatal Care checkups. |
| **Task 2**: `ANC_COORDINATION` | **Map Institutional Delivery Hospital & Ambulance** | +14 Days | Map accredited public hospital and confirm 108/102 emergency ambulance contact. |
| **Task 3**: `FACILITY_MAPPING` | **Birth Preparedness & Delivery Readiness Check** | +14 Days | Review birth preparedness plan and hospital admission readiness before Expected Date of Delivery. |
| **Task 4**: `DELIVERY_SUPPORT` | **48-Hour Postnatal Visit & Newborn Vaccines** | +2 Days | Conduct 48-hour postpartum home visit to check maternal recovery, newborn breastfeeding, and zero-dose vaccines. |
| **Task 5**: `POSTNATAL_VISIT` | **Track JSY Cash Incentive DBT Transfer** | +10 Days | Verify beneficiary bank account linkage and receipt of official JSY institutional delivery cash assistance. |
| **Task 6**: `DBT_TRACKING` | *(Resolves Case & Maternal Care Journey)* | 0 Days | Completes maternal care journey, resolves case to `RESOLVED`, clears `nextFollowUpAt`, and marks intermediate follow-ups `COMPLETED`. |

### C. Idempotency & Duplicate Protection
Every automatic follow-up is tagged with its originating `sourceTaskId`. Re-executing a task or retrying completions will never produce duplicate pending follow-ups for the same source task.

---

## 4. Optional n8n Automation & Domain Event Architecture

The `AutomationService` publishes structured domain events:

### A. Supported Domain Events
- `CASE_CREATED`: When a household case is assigned or registered in the field.
- `TASK_COMPLETED`: When an ASHA worker completes a field task milestone.
- `FOLLOWUP_CREATED`: When a follow-up visit is manually or automatically scheduled.
- `FOLLOWUP_COMPLETED`: When a follow-up visit outcome is recorded.
- `FOLLOWUP_RESCHEDULED`: When a follow-up visit is moved to a new target date.
- `CASE_SCHEME_INITIATED`: When proactive or citizen-requested doorstep scheme facilitation starts.
- `CASE_RESOLVED`: When all required scheme tasks reach complete milestone resolution.

### B. Payload Structure & Data Sanitization
```json
{
  "eventId": "evt_1788107995160_3w44w",
  "eventType": "TASK_COMPLETED",
  "timestamp": "2026-08-30T16:39:55.160Z",
  "caseId": "case_101",
  "householdId": "hh_101",
  "assignedAshaUid": "asha101",
  "schemeId": "ab-pmjay",
  "beneficiaryMemberId": "mem_202",
  "beneficiaryName": "Gopal Sharma",
  "payload": {
    "taskId": "task_1",
    "taskTitle": "Confirm senior citizen identity & age documentation",
    "completedTasksCount": 1,
    "totalTasksCount": 5
  }
}
```

### C. Fail-Safe Non-Blocking Dispatch Guarantee
```typescript
try {
  const response = await fetch(this.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SwasthyaSetu-Event": eventType,
      "X-SwasthyaSetu-Event-ID": eventId,
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(3000), // 3-second hard timeout
  });
} catch (err) {
  // Safe degradation: core database transaction continues without interruption
}
```
All sensitive credentials, API keys, session tokens, and passwords matching `/pass|token|secret|credential|auth|key/i` are automatically sanitized to `"[REDACTED]"`.

---

## 5. REST API Endpoints Reference

| Method | Endpoint | Access Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/asha/follow-ups` | ASHA, ADMIN | Lists all assigned follow-ups with on-demand KPI counters (`dueToday`, `overdue`, `upcoming`, `completed`). |
| `GET` | `/api/v1/asha/cases/:caseId/follow-ups` | ASHA (assigned), ADMIN | Lists follow-up history and pending visits for a specific case. |
| `POST` | `/api/v1/asha/cases/:caseId/follow-ups` | ASHA (assigned), ADMIN | Creates a new manual follow-up for a case. |
| `PATCH` | `/api/v1/asha/cases/:caseId/follow-ups/:followUpId/complete` | ASHA (assigned), ADMIN | Records outcome, completion timestamp, actor name, and recalculates `nextFollowUpAt`. |
| `PATCH` | `/api/v1/asha/cases/:caseId/follow-ups/:followUpId/reschedule` | ASHA (assigned), ADMIN | Reschedules follow-up with new target date and mandatory audit reason. |
| `PATCH` | `/api/v1/asha/cases/:caseId/tasks/:taskId/complete` | ASHA (assigned), ADMIN | Marks task completed, advances journey step, and generates next follow-up. |

---

## 6. Citizen Privacy & Separation

- **High-Level Assistance Visibility**: Citizens can view high-level progress (e.g. `ACCEPTED`, `IN_PROGRESS`, `RESOLVED`, public ASHA response notes) through `/api/v1/citizen/assistance`.
- **Zero Confidential Leakage**: Internal ASHA field notes, triage assessments, and raw operational follow-up rosters are strictly protected and never exposed to citizens.

---

## 7. Verification & Test Suite Summary

### Automated Test Matrix
- **Total Backend Test Files**: 35 Files
- **Total Backend Tests**: 282 Passed (100% Pass Rate)
- **Phase 10 Dedicated Tests (`tests/phase10-followups-automation.test.ts`)**: 14 Tests
  - Action & Task authorization and IDOR protection
  - Citizen access restrictions (403 Forbidden)
  - Deterministic automatic follow-up generation for PM-JAY (Tasks 1–4)
  - Deterministic automatic follow-up generation for JSY (Tasks 1–5)
  - Idempotency & duplicate follow-up prevention
  - Outcome recording & `nextFollowUpAt` recalculation
  - Reschedule audit reason recording
  - Dynamic KPI counter computation (Due Today, Overdue, Upcoming, Completed)
  - n8n unconfigured safe degradation
  - n8n 500 error safe degradation
  - n8n timeout non-blocking handling
  - Deep payload credential sanitization
  - Citizen progress tracking without confidential note leakage
- **Backend Typecheck (`npx tsc --noEmit`)**: 0 Errors
- **Frontend Typecheck (`npx tsc --noEmit`)**: 0 Errors
- **Frontend Production Build (`npm run build`)**: 11 Static routes built cleanly in Turbopack
