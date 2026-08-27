# SwasthyaSetu — Cloud Firestore Data Architecture & Security

This document specifies the planned 11-collection Firestore data architecture for SwasthyaSetu.

## 1. Architectural Boundary

- **Client Firebase SDK**: Restricted solely to client authentication tokens (Firebase Auth).
- **Backend Firebase Admin SDK**: Owns all queries, creates, updates, and transactions on domain collections in Fastify.
- **Security Posture**: Restrictive default `firestore.rules` denying direct client writes/reads to domain collections.

---

## 2. Implemented Collections (Phase 1–3)

```
Firestore Root
├── /users/{userId}
│   ├── /consent_history/{consentId}
│   └── /notifications/{notificationId}
├── /households/{householdId}
│   └── /members/{memberId}
```

### 2.1 Collection Schemas

#### 1. `households` (`/households/{householdId}`)
- **Fields**:
  - `id`: string (e.g. `hh_citizen101`)
  - `ownerUid`: string (indexed, ties to authenticated `request.user.uid`)
  - `headOfHouseholdName`: string
  - `rationCardNumber`: string (indexed)
  - `incomeCategory`: string (`BPL` | `AAY` | `APL` | `OTHER`)
  - `state`: string
  - `district`: string
  - `village`: string
  - `pincode`: string
  - `contactPhone`: string (optional)
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp

#### 2. `members` (`/households/{householdId}/members/{memberId}`)
- **Fields**:
  - `id`: string (e.g. `mem_1787815646_a1b2c`)
  - `householdId`: string (foreign key to parent household)
  - `fullName`: string
  - `age`: integer (0-125)
  - `gender`: string (`male` | `female` | `other`)
  - `relationship`: string (`Head` | `Spouse` | `Son` | `Daughter` | `Father` | `Mother` | `Other`)
  - `disabilityStatus`: boolean
  - `chronicConditions`: list of strings
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp

---

## 3. Future Domain Collections (Phase 4+)

```
├── /schemes/{scheme_id}
├── /scheme_rules/{rule_id}
├── /documents/{document_id}
├── /gaps/{gap_id}
├── /evidence/{evidence_id}
├── /actions/{action_id}
├── /followups/{followup_id}
└── /audit_logs/{log_id}
```
