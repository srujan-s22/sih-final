# SwasthyaSetu — Scheme Registry & Deterministic Rule Engine Architecture

## 1. Overview

The Scheme Registry and Rule Engine provide the authoritative, explainable, and deterministic foundation for matching households with verified government healthcare entitlements.

### Key Architectural Tenets:
1. **Deterministic Execution**: Zero AI/LLM models are involved in computing eligibility decisions. All evaluations are pure boolean logic against structured household/member data.
2. **Version Traceability**: Every evaluation traces back to a specific `schemeVersion` (e.g. `2026.1`) for auditability.
3. **Structured Explainability**: Results return matched criteria, failed criteria, missing fields, required documents, and prioritized next actions.
4. **Three-Valued Status Logic**:
   - `ELIGIBLE`: All required criteria matched.
   - `NOT_ELIGIBLE`: One or more criteria explicitly failed.
   - `NEEDS_INFORMATION`: Incomplete household or member data prevents a deterministic decision (does not collapse into ineligibility).

---

## 2. Cloud Firestore Data Model

```
Firestore Root
├── /schemes/{schemeId}
│   └── /versions/{versionId}
```

### 2.1 `/schemes/{schemeId}` Document
- `id`: string (e.g. `"ab-pmjay"`)
- `name`: string
- `shortName`: string
- `description`: string
- `category`: `"NATIONAL"` | `"STATE"` | `"MATERNAL"` | `"CHILD"` | `"SENIOR_CITIZEN"` | `"DISABILITY"` | `"OTHER"`
- `level`: `"CENTRAL"` | `"STATE"`
- `status`: `"DRAFT"` | `"ACTIVE"` | `"INACTIVE"` | `"ARCHIVED"`
- `authority`: string
- `state`?: string
- `benefitSummary`: string
- `benefitDetails`?: string[]
- `eligibilitySummary`: string
- `requiredDocuments`: `RequiredDocument[]`
- `actions`: `SchemeAction[]`
- `currentVersion`: string
- `sourceMetadata`: `SourceMetadata`
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 2.2 `/schemes/{schemeId}/versions/{versionId}` Document
- `id`: string (e.g. `"ver_abpmjay_2026_1"`)
- `schemeId`: string
- `version`: string
- `effectiveFrom`: ISO timestamp
- `effectiveTo`?: string
- `status`: `"DRAFT"` | `"ACTIVE"` | `"DEPRECATED"`
- `ruleSet`: `RuleSet`
- `requiredDocuments`: `RequiredDocument[]`
- `actions`: `SchemeAction[]`
- `sourceMetadata`: `SourceMetadata`
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

---

## 3. Deterministic Rule Grammar & Operators

### 3.1 Supported Operators
| Operator | Scope | Description | Example |
|---|---|---|---|
| `FIELD_EQUALS` | HOUSEHOLD / MEMBER | Strict string/number/boolean match | `incomeCategory == "BPL"` |
| `FIELD_NOT_EQUALS` | HOUSEHOLD / MEMBER | Inverted match | `state != "ExcludedState"` |
| `FIELD_IN` | HOUSEHOLD / MEMBER | Membership check in list | `incomeCategory in ["BPL", "AAY"]` |
| `FIELD_NOT_IN` | HOUSEHOLD / MEMBER | Non-membership in list | `incomeCategory not in ["APL"]` |
| `NUMBER_GREATER_THAN` | HOUSEHOLD / MEMBER | Numeric strict greater than | `age > 60` |
| `NUMBER_GREATER_THAN_OR_EQUAL` | HOUSEHOLD / MEMBER | Numeric greater than or equal | `age >= 18` |
| `NUMBER_LESS_THAN` | HOUSEHOLD / MEMBER | Numeric strict less than | `age < 5` |
| `NUMBER_LESS_THAN_OR_EQUAL` | HOUSEHOLD / MEMBER | Numeric less than or equal | `age <= 6` |
| `MEMBER_EXISTS` | MEMBER | Checks if >= 1 member matches sub-rule | Female member aged >= 18 |
| `MEMBER_COUNT` | MEMBER | Checks if >= N members match sub-rule | >= 2 dependents |

### 3.2 Boolean Composition
- `ALL`: Returns `ELIGIBLE` only if all rules match. If any fails -> `NOT_ELIGIBLE`. If no rule fails but a required field is missing -> `NEEDS_INFORMATION`.
- `ANY`: Returns `ELIGIBLE` if any rule matches. If all fail -> `NOT_ELIGIBLE`.

---

## 4. API Endpoints

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/v1/schemes` | `GET` | Public | Lists all active healthcare schemes. |
| `/api/v1/schemes/:schemeId` | `GET` | Public | Retrieves specific scheme with its active version details. |
| `/api/v1/eligibility/me` | `GET` | Authenticated + Consented | Evaluates citizen's household & members against all active schemes. |
| `/api/v1/eligibility/me/:schemeId` | `GET` | Authenticated + Consented | Evaluates citizen's household against a single scheme. |

---

## 5. Adding New Schemes & Versions

To add a new verified scheme without code changes:
1. Construct the `Scheme` document with authoritative `sourceMetadata`.
2. Construct the `SchemeVersion` document with tested `RuleSet` definitions.
3. Save to Firestore via backend `SchemeRepository.createScheme` and `createSchemeVersion`.
4. The rule engine will automatically discover and evaluate the new scheme on subsequent `/api/v1/eligibility/me` requests.
