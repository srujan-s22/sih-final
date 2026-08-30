# SwasthyaSetu — Scheme-Assistance Workflow Specification

---

## 1. Overview & Architectural Purpose

SwasthyaSetu is a deterministic healthcare-access and entitlement-coordination platform designed for India's public healthcare ecosystem. The platform connects citizens, households, and family members to their designated village/ward **Accredited Social Health Activist (ASHA)** worker to ensure that detected scheme entitlements translate into completed, actionable healthcare journeys.

```
ENTRY POINT A: CITIZEN-INITIATED
Citizen discovers eligible scheme → Clicks "Ask My ASHA for Help" → AshaAssistanceRequest (initiatedBy: "CITIZEN", status: "PENDING")
   ↓
ASHA reviews request → Clicks "Accept & Open Case" → Unified AshaCase (IN_PROGRESS)

ENTRY POINT B: ASHA-INITIATED (PROACTIVE INTELLIGENCE)
Citizen connects household to ASHA → ASHA evaluates on-demand attention signals
   ↓
Engine surfaces HIGH/URGENT signal (Senior 70+ PM-JAY, Pregnant Mother JSY, Blocked Task, Overdue Follow-up)
   ↓
ASHA clicks "Start Assistance" → AshaAssistanceRequest (initiatedBy: "ASHA", status: "ACCEPTED") + Unified AshaCase (IN_PROGRESS)

CONVERGENCE
   ↓
Both paths converge on the exact same underlying:
- Deterministic 5-task (PM-JAY) or 6-task (JSY) CaseTask graph
- Dynamic SchemeJourneyStep milestone advancement
- Immutable Firestore activity audit trail (CASE_SCHEME_INITIATED, TASK_COMPLETED)
- Real-time two-way synchronization between Citizen and ASHA portals
   ↓
CASE RESOLUTION & VERIFIED HEALTHCARE ACCESS
```

---

## 2. Supported Schemes & Versioned Pathways

### A. Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (`ab-pmjay`)
- **Implemented Pathway**: Senior Citizens aged 70+ (National Health Authority NHA Gazette Guidelines).
- **Core Benefit**: Up to ₹5,00,000 annual secondary and tertiary cashless hospitalization cover per senior citizen across empaneled public and private hospitals.
- **Workflow Journey**:
  1. `ELIGIBILITY_IDENTIFIED`: Senior citizen aged 70+ identified in household.
  2. `BENEFICIARY_CONFIRMED`: Specific senior member selected and confirmed by citizen/ASHA.
  3. `ENROLLMENT_GUIDANCE`: ASHA provides Aadhaar e-KYC and official portal/CSC guidance.
  4. `ENROLLMENT_COMPLETED`: Citizen/ASHA reports official application submission.
  5. `CARD_STATUS_CONFIRMED`: Ayushman Card generation confirmed.
  6. `BENEFIT_ACCESS_GUIDANCE`: Guidance provided on nearest empaneled hospital access.
  7. `CASE_RESOLVED`: Assistance completed and recorded.

### B. Janani Suraksha Yojana (`jsy`)
- **Implemented Pathway**: Safe Motherhood Intervention for pregnant women (MoHFW / NHM Guidelines).
- **Core Benefit**: Direct cash assistance and conditional maternity care for institutional deliveries in public and accredited private health centers.
- **Workflow Journey**:
  1. `PREGNANCY_INFORMATION`: Pregnant household member identified.
  2. `ELIGIBILITY_VERIFICATION`: Maternal health & institutional delivery criteria verified.
  3. `REGISTRATION_ANC`: Mother and Child Protection (MCP) card & Antenatal Care (ANC) checkup registration.
  4. `DELIVERY_FACILITY`: Mapping of accredited public/private delivery facility.
  5. `INSTITUTIONAL_DELIVERY`: Institutional delivery logistics and hospital admission support.
  6. `POSTNATAL_FOLLOW_UP`: 48-hour and 14-day postnatal checkup & newborn immunization.
  7. `BENEFIT_PROCESSING`: Tracking of DBT cash assistance and hospital discharge paperwork.
  8. `CASE_RESOLVED`: Assistance completed and recorded.

---

## 3. Common Assistance Domain Model

### A. Assistance Request (`asha_assistance_requests/{requestId}`)
```typescript
export interface AshaAssistanceRequest {
  id: string;
  householdId: string;
  citizenUid: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  ashaUid: string;
  ashaServiceCode: string;
  ashaName: string;
  category: AssistanceCategory;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  beneficiaryAge?: number | null;
  beneficiaryRelationship?: string | null;
  message: string;
  priority: CasePriority;
  status: AssistanceStatus;
  responseNote?: string | null;
  declineReason?: string | null;
  caseId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### B. Case Model with Scheme Journey & Tasks (`cases/{caseId}`)
```typescript
export interface AshaCase {
  id: string;
  householdId: string;
  assignedAshaUid: string;
  headOfHouseholdName: string;
  district: string;
  state: string;
  incomeCategory: IncomeCategory;
  memberCount: number;
  status: CaseStatus;
  priority: CasePriority;
  schemeId?: string | null;
  schemeName?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  assistanceRequestId?: string | null;
  currentJourneyStep?: string | null;
  detectedGapsCount: number;
  eligibleSchemesCount: number;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseTask {
  id: string;
  caseId: string;
  schemeId?: string | null;
  beneficiaryMemberId?: string | null;
  beneficiaryName?: string | null;
  type: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED";
  order: number;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchemeJourneyStep {
  stepId: string;
  title: string;
  description: string;
  status: "PENDING" | "CURRENT" | "COMPLETED" | "BLOCKED";
  completedAt?: string | null;
}
```

---

## 4. State Machines

### A. Assistance Request Status Transitions
```
                ┌──────────────┐
                │  REQUESTED   │ (Pending in ASHA queue)
                └──────┬───────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
  ┌──────────────┐            ┌──────────────┐
  │   ACCEPTED   │            │   DECLINED   │
  └──────┬───────┘            └──────────────┘
         │
         ▼
  ┌──────────────┐
  │ IN_PROGRESS  │
  └──────┬───────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌───────────┐
│BLOCKED │ │ RESOLVED  │
└────────┘ └───────────┘
```

### B. Case Status Lifecycle
- `NEW` → Initial case generated from connection.
- `REQUESTED` → Citizen requested active assistance.
- `ACCEPTED` → ASHA accepted request & initiated workflow.
- `IN_PROGRESS` → ASHA actively performing tasks & home visits.
- `FOLLOW_UP_REQUIRED` → Scheduled visit pending.
- `BLOCKED` → Missing government document or external bottleneck.
- `ESCALATED` → Escalated to Medical Officer / PHC Supervisor.
- `RESOLVED` → Assistance completed and confirmed.
- `CLOSED` → Case closed.

### C. Task Status Lifecycle
- `PENDING` → Initial assigned task.
- `IN_PROGRESS` → ASHA started verification or guidance.
- `COMPLETED` → Task verified and completed.
- `SKIPPED` → Task optional or superseded.
- `BLOCKED` → Pending official gazette / hospital response.

---

## 5. Security & Multi-Tenant IDOR Boundaries

1. **Authentication & Identity**:
   - All identities (`citizenUid`, `ashaUid`, `role`) are derived server-side from verified Firebase ID Tokens.
2. **Household Access Control**:
   - Citizens can only query and mutate households where `household.ownerUid === request.user.uid`.
3. **ASHA Field Scoping**:
   - ASHA workers can only inspect cases and requests assigned to their `uid` or connection requests addressed to their `ashaServiceCode`.
4. **Beneficiary Integrity**:
   - Beneficiary selection must be an existing record in `households/{householdId}/members`. Cross-household member IDs are rejected with `400 Bad Request`.
5. **Spam & Duplicate Prevention**:
   - Submitting duplicate pending/in-progress assistance requests for the identical scheme and beneficiary is rejected with `409 Conflict`.

---

## 6. API Map

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/citizen/assistance/request` | `CITIZEN` | Submit assistance request with beneficiary selection |
| `GET` | `/api/v1/citizen/assistance` | `CITIZEN` | List citizen's assistance requests & active journeys |
| `GET` | `/api/v1/asha/assistance-requests` | `ASHA`, `ADMIN` | List incoming assistance queue |
| `POST` | `/api/v1/asha/assistance-requests/:id/accept` | `ASHA` | Accept request & instantiate scheme journey & tasks |
| `POST` | `/api/v1/asha/assistance-requests/:id/decline` | `ASHA` | Decline request with reason |
| `PATCH` | `/api/v1/asha/assistance-requests/:id` | `ASHA` | Update status or add response note |
| `GET` | `/api/v1/asha/cases/:caseId/tasks` | `ASHA`, `ADMIN` | List scheme journey tasks |
| `POST` | `/api/v1/asha/cases/:caseId/tasks` | `ASHA` | Add custom task to case |
| `PATCH` | `/api/v1/asha/cases/:caseId/tasks/:taskId` | `ASHA` | Update task status or due date |
| `PATCH` | `/api/v1/asha/cases/:caseId/tasks/:taskId/complete` | `ASHA` | Mark task completed and advance journey |

---

## 7. Firestore Data Hierarchy

```
users/
 ├─ [citizenUid] { role: "CITIZEN", ... }
 └─ [ashaUid]    { role: "ASHA", ashaServiceCode: "ASHA-KA-...", ... }

households/
 └─ hh_[citizenUid] { headOfHouseholdName: "...", ownerUid: "..." }
     └─ members/
         ├─ [memFather] { fullName: "...", age: 72, ... }
         └─ [memMother] { fullName: "...", age: 28, maternalStatus: "pregnant", ... }

asha_connection_requests/
 └─ conn_[id] { citizenUid, ashaUid, status: "ACTIVE" }

cases/
 └─ case_[id] { householdId, assignedAshaUid, schemeId, beneficiaryMemberId, status: "IN_PROGRESS", ... }
     ├─ tasks/ [taskId] { title: "...", status: "COMPLETED", order: 1 }
     ├─ notes/ [noteId] { content: "...", authorUid: "..." }
     ├─ followups/ [fuId] { scheduledAt: "...", status: "PENDING" }
     └─ activities/ [actId] { type: "TASK_COMPLETED", description: "..." }

asha_assistance_requests/
 └─ ast_[id] { householdId, citizenUid, ashaUid, schemeId, beneficiaryMemberId, status: "ACCEPTED", ... }
```
