# SwasthyaSetu — Cloud Firestore Data Architecture & Security

This document specifies the planned 11-collection Firestore data architecture for SwasthyaSetu.

## 1. Architectural Boundary

- **Client Firebase SDK**: Restricted solely to client authentication tokens (Firebase Auth).
- **Backend Firebase Admin SDK**: Owns all queries, creates, updates, and transactions on domain collections in Fastify.
- **Security Posture**: Restrictive default `firestore.rules` denying direct client writes/reads to domain collections.

---

## 2. Planned Domain Collections

```
Firestore Root
├── /households/{household_id}
├── /members/{member_id}
├── /schemes/{scheme_id}
├── /scheme_rules/{rule_id}
├── /documents/{document_id}
├── /gaps/{gap_id}
├── /evidence/{evidence_id}
├── /actions/{action_id}
├── /followups/{followup_id}
├── /notifications/{notification_id}
└── /audit_logs/{log_id}
```

### 2.1 Collection Schemas

#### 1. `households`
- **Fields**:
  - `id`: string (e.g. `hh_2026_001`)
  - `headOfHouseholdName`: string
  - `rationCardNumber`: string (indexed)
  - `incomeCategory`: string (`BPL` | `AAY` | `APL` | `OTHER`)
  - `state`: string
  - `district`: string
  - `village`: string
  - `pincode`: string
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp

#### 2. `members`
- **Fields**:
  - `id`: string
  - `householdId`: string (indexed foreign key)
  - `fullName`: string
  - `age`: integer
  - `gender`: string (`male` | `female` | `other`)
  - `relationship`: string
  - `disabilityStatus`: boolean
  - `chronicConditions`: list of strings
  - `createdAt`: ISO timestamp
  - `updatedAt`: ISO timestamp

#### 3. `schemes`
- **Fields**:
  - `id`: string (e.g. `pmjay`, `maternal_health`)
  - `schemeName`: string
  - `level`: string (`central` | `state`)
  - `coverageAmount`: number
  - `description`: string
  - `isActive`: boolean
  - `createdAt`: ISO timestamp

#### 4. `scheme_rules`
- **Fields**:
  - `id`: string
  - `schemeId`: string (indexed)
  - `ruleType`: string (`income_tier` | `social_category` | `age_bracket` | `condition`)
  - `criteria`: map of conditions
  - `createdAt`: ISO timestamp

#### 5. `documents`
- **Fields**:
  - `id`: string
  - `memberId`: string (indexed)
  - `documentType`: string (`aadhaar` | `ration_card` | `income_cert` | `disability_cert`)
  - `verificationStatus`: string (`verified` | `pending` | `rejected` | `missing`)
  - `storagePath`: string
  - `updatedAt`: ISO timestamp

#### 6. `gaps`
- **Fields**:
  - `id`: string
  - `householdId`: string (indexed)
  - `memberId`: string (indexed)
  - `gapType`: string (`uninsured_member` | `missing_document` | `unregistered_benefit` | `renewal_due`)
  - `severity`: string (`high` | `medium` | `low`)
  - `status`: string (`detected` | `in_progress` | `resolved`)
  - `detectedAt`: ISO timestamp

#### 7. `evidence`
- **Fields**:
  - `id`: string
  - `gapId`: string (indexed)
  - `proofType`: string
  - `source`: string (`asha_upload` | `citizen_portal` | `api_verification`)
  - `createdAt`: ISO timestamp

#### 8. `actions`
- **Fields**:
  - `id`: string
  - `gapId`: string (indexed)
  - `assignedRole`: string (`asha` | `citizen` | `admin`)
  - `actionType`: string (`collect_document` | `ekyc_verification` | `csc_visit` | `scheme_application`)
  - `status`: string (`pending` | `completed` | `cancelled`)
  - `dueDate`: ISO timestamp

#### 9. `followups`
- **Fields**:
  - `id`: string
  - `actionId`: string (indexed)
  - `notes`: string
  - `conductedBy`: string
  - `outcome`: string
  - `timestamp`: ISO timestamp

#### 10. `notifications`
- **Fields**:
  - `id`: string
  - `recipientId`: string (indexed)
  - `channel`: string (`sms` | `voice_call` | `portal`)
  - `status`: string (`queued` | `sent` | `delivered` | `failed`)
  - `timestamp`: ISO timestamp

#### 11. `audit_logs`
- **Fields**:
  - `id`: string
  - `actorId`: string
  - `actorRole`: string
  - `action`: string
  - `resource`: string
  - `correlationId`: string (indexed)
  - `timestamp`: ISO timestamp

---

## 3. Data Access Abstraction

Domain operations must extend `BaseFirestoreRepository<T>` located in `backend/src/repositories/firebase/base.repository.ts`. Direct ad-hoc calls to Firestore are forbidden.
