# SwasthyaSetu — Scheme Journey, Task & Milestone Counting Model Audit

**Document Version:** 1.0.0  
**Audit Date:** August 30, 2026  
**Audited Subsystems:** Deterministic Eligibility Engine, Case Management Service, Journey Milestone System, Field Action Task Engine, Citizen Portal, ASHA Workspace.

---

## 1. Executive Summary & Semantic Definitions

To ensure complete mathematical and operational consistency across SwasthyaSetu, the lifecycle of a citizen's healthcare entitlement is divided into **five distinct, decoupled domain concepts**:

```
+-----------------------------------------------------------------------------------------------+
| 1. SCHEME ELIGIBILITY (Deterministic Rule Engine)                                             |
|    "Is this household/member eligible for the scheme?"                                        |
|    States: ELIGIBLE | NEEDS_INFORMATION | NOT_ELIGIBLE                                        |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼ (Trigger: Citizen Request OR Proactive ASHA Initiation)
+-----------------------------------------------------------------------------------------------+
| 2. ASSISTANCE REQUEST (Assistance Lifecycle)                                                  |
|    "Is ASHA doorstep support requested / active for this scheme?"                             |
|    States: PENDING ──► ACCEPTED ──► IN_PROGRESS ──► RESOLVED / CLOSED                         |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼ (Trigger: ASHA Case Created / Initialized)
+-----------------------------------------------------------------------------------------------+
| 3. ASHA CASE (Operational Caseload Record)                                                    |
|    "What is the operational lifecycle of this beneficiary's support case?"                    |
|    States: NEW ──► IN_PROGRESS ──► RESOLVED ──► CLOSED                                        |
+-----------------------------------------------------------------------------------------------+
                      │                                                   │
                      ▼                                                   ▼
+------------------------------------------+    +-----------------------------------------------+
| 4. FIELD ACTION TASKS (Actionable Work)  |    | 5. JOURNEY MILESTONES (Beneficiary Progress)  |
|    "What concrete field actions must     |    |    "What major stages of the beneficiary's   |
|     the ASHA worker complete?"           |    |     entitlement journey have been reached?"   |
|    Collection: CaseTask[]                |    |    Array: SchemeJourneyStep[]                 |
|    Status: PENDING | IN_PROGRESS | DONE  |    |    Status: COMPLETED | CURRENT | PENDING      |
+------------------------------------------+    +-----------------------------------------------+
```

---

## 2. Mathematical Counting Models

### A. Ayushman Bharat PM-JAY (Senior Citizen 70+ Universal)

| Parameter | Value | Source of Truth |
| :--- | :--- | :--- |
| **Field Action Tasks** | **5 Tasks** | `cases/{caseId}/tasks` subcollection |
| **Journey Milestones** | **7 Steps** | `case.journeySteps[]` embedded array |
| **UI Tab Counter** | **`completedTasks / 5 Tasks`** | `caseDetail.tasks.filter(status === "COMPLETED").length / 5` |
| **UI Milestone Grid** | **7 Milestone Cards** | Rendered with Step 1 to Step 7 badges |
| **Completion Trigger** | `5 / 5 Tasks COMPLETED` | `completeTask()` evaluates `completedTasksCount === 5` |
| **Case Resolution** | Status $\to$ `RESOLVED` | `case.status = "RESOLVED"`, `currentJourneyStep = "CASE_RESOLVED"` |
| **Assistance Sync** | Status $\to$ `RESOLVED` | `assistanceRepo.updateRequestStatus(reqId, "RESOLVED")` |

#### Exact PM-JAY Field Action Tasks (5 Tasks):
1. **`CONFIRM_BENEFICIARY`**: *Confirm senior citizen identity & age documentation*  
   *Verify Aadhaar card and age proof (70+) for the beneficiary.*
2. **`ENROLLMENT_GUIDANCE`**: *Provide Aadhaar e-KYC & official PM-JAY registration guidance*  
   *Guide the family to the nearest CSC center or official beneficiary.nha.gov.in portal.*
3. **`VERIFY_ENROLLMENT`**: *Record PM-JAY enrollment submission & reference number*  
   *Follow up with household to confirm enrollment application has been submitted.*
4. **`CONFIRM_CARD`**: *Confirm Ayushman Card generation status*  
   *Confirm whether physical or digital Ayushman Card has been downloaded or received.*
5. **`BENEFIT_GUIDANCE`**: *Provide empaneled hospital guidance & ₹5 Lakh cover details*  
   *Inform household about nearest empaneled public/private hospitals for cashless care.*

#### Exact PM-JAY Journey Milestones (7 Steps):
1. **`ELIGIBILITY_IDENTIFIED`**: *Eligibility Identified* (Initial State: `COMPLETED`)
2. **`BENEFICIARY_CONFIRMED`**: *Beneficiary Identity Confirmed* (Initial State: `CURRENT`, completed on Task 1)
3. **`ENROLLMENT_GUIDANCE`**: *e-KYC & Enrollment Guidance* (Completed on Task 2)
4. **`ENROLLMENT_COMPLETED`**: *PM-JAY Enrollment Submission* (Completed on Task 3)
5. **`CARD_STATUS_CONFIRMED`**: *Ayushman Card Generated* (Completed on Task 4)
6. **`BENEFIT_ACCESS_GUIDANCE`**: *Hospital Network & Benefit Access* (Completed on Task 5)
7. **`CASE_RESOLVED`**: *Assistance Journey Completed* (Final State: `COMPLETED` on Case Resolution)

---

### B. Janani Suraksha Yojana (JSY)

| Parameter | Value | Source of Truth |
| :--- | :--- | :--- |
| **Field Action Tasks** | **6 Tasks** | `cases/{caseId}/tasks` subcollection |
| **Journey Milestones** | **8 Steps** | `case.journeySteps[]` embedded array |
| **UI Tab Counter** | **`completedTasks / 6 Tasks`** | `caseDetail.tasks.filter(status === "COMPLETED").length / 6` |
| **UI Milestone Grid** | **8 Milestone Cards** | Rendered with Step 1 to Step 8 badges |
| **Completion Trigger** | `6 / 6 Tasks COMPLETED` | `completeTask()` evaluates `completedTasksCount === 6` |
| **Case Resolution** | Status $\to$ `RESOLVED` | `case.status = "RESOLVED"`, `currentJourneyStep = "CASE_RESOLVED"` |
| **Assistance Sync** | Status $\to$ `RESOLVED` | `assistanceRepo.updateRequestStatus(reqId, "RESOLVED")` |

#### Exact JSY Field Action Tasks (6 Tasks):
1. **`CONFIRM_PREGNANCY`**: *Verify pregnancy records & MCP Card documentation*  
   *Confirm maternal health status, LMP, and Mother and Child Protection Card.*
2. **`ANC_COORDINATION`**: *Coordinate Antenatal Care (ANC) checkup schedule*  
   *Ensure at least 4 ANC checkups, TT injections, and IFA tablets are scheduled.*
3. **`FACILITY_MAPPING`**: *Map accredited delivery hospital & emergency transport*  
   *Identify nearest accredited public facility and register 108/102 ambulance contact.*
4. **`DELIVERY_SUPPORT`**: *Institutional delivery coordination & admission support*  
   *Assist family during labor onset for timely hospital arrival and institutional delivery.*
5. **`POSTNATAL_VISIT`**: *Conduct 48-hour & 14-day postnatal visit and immunization*  
   *Check maternal recovery, infant breastfeeding, and zero-dose immunization (BCG, OPV, Hep B).*
6. **`DBT_TRACKING`**: *Track JSY cash incentive DBT bank transfer*  
   *Verify beneficiary bank account linkage and receipt of official JSY institutional delivery incentive.*

#### Exact JSY Journey Milestones (8 Steps):
1. **`PREGNANCY_INFORMATION`**: *Pregnancy Information Confirmed* (Initial State: `COMPLETED`)
2. **`ELIGIBILITY_VERIFICATION`**: *JSY Eligibility Verified* (Initial State: `CURRENT`, completed on Task 1)
3. **`REGISTRATION_ANC`**: *MCP Card & ANC Registration* (Completed on Task 2)
4. **`DELIVERY_FACILITY`**: *Delivery Facility Mapping* (Completed on Task 3)
5. **`INSTITUTIONAL_DELIVERY`**: *Institutional Delivery Coordination* (Completed on Task 4)
6. **`POSTNATAL_FOLLOW_UP`**: *Postnatal & Newborn Care* (Completed on Task 5)
7. **`BENEFIT_PROCESSING`**: *Direct Benefit Transfer Tracking* (Completed on Task 6)
8. **`CASE_RESOLVED`**: *Maternal Care Journey Completed* (Final State: `COMPLETED` on Case Resolution)

---

## 3. Mathematical Mapping: Tasks $\longrightarrow$ Journey Milestones

When an ASHA worker marks a task as `COMPLETED`, `CaseService.completeTask()` executes the following step-advancement mapping formula:

$$\text{progressFraction} = \frac{\text{completedTasksCount}}{\text{totalTasksCount}}$$

$$\text{stepIndex} = \min\left(\left\lfloor \text{progressFraction} \times (N_{\text{milestones}} - 1) \right\rfloor + 1, \, N_{\text{milestones}} - 1\right)$$

### PM-JAY Step-Advancement Progression:
$$\begin{array}{|c|c|c|c|c|}
\hline
\textbf{Completed Tasks} & \textbf{Fraction} & \textbf{Step Index} & \textbf{Current Milestone} & \textbf{Case Status} \\
\hline
0 / 5 & 0.00 & 1 & \text{Beneficiary Identity Confirmed} & \text{IN\_PROGRESS} \\
1 / 5 & 0.20 & 2 & \text{e-KYC \& Enrollment Guidance} & \text{IN\_PROGRESS} \\
2 / 5 & 0.40 & 3 & \text{PM-JAY Enrollment Submission} & \text{IN\_PROGRESS} \\
3 / 5 & 0.60 & 4 & \text{Ayushman Card Generated} & \text{IN\_PROGRESS} \\
4 / 5 & 0.80 & 5 & \text{Hospital Network \& Benefit Access} & \text{IN\_PROGRESS} \\
\mathbf{5 / 5} & \mathbf{1.00} & \mathbf{6} & \mathbf{\text{Assistance Journey Completed}} & \mathbf{\text{RESOLVED}} \\
\hline
\end{array}$$

---

## 4. Origin of the "11/11" Count in Previous Scenarios

During earlier development phases, instances of `11/11` appeared in test logs and UI snapshots. 

**Forensic Explanation:**
1. $\mathbf{5 \text{ PM-JAY tasks} + 6 \text{ JSY tasks} = 11 \text{ tasks}}$.
2. If both PM-JAY and JSY tasks were initialized into the same case's `tasks` subcollection prior to strict 1-scheme-per-case concurrency enforcement, the task array contained 11 documents.
3. The UI Case Drawer tab `{caseDetail.tasks.filter(COMPLETED).length}/{caseDetail.tasks.length}` accurately counted all 11 task documents in the subcollection.
4. **Current Status:** Under the current proactive intelligence engine and 409 conflict rules, cases maintain dedicated scheme assistance instances: PM-JAY cases strictly have **$5/5$ tasks**, and JSY cases strictly have **$6/6$ tasks**.

---

## 5. Authoritative State Rules Summary

1. **Eligibility Rule**: Eligibility evaluation is strictly deterministic and based on household facts. Completion of an ASHA assistance journey does NOT change or invalidate a beneficiary's underlying eligibility (`ELIGIBLE`).
2. **Completion Rule**: An assistance journey is considered **COMPLETE** if and only if `completedTasksCount === totalTasksCount`.
3. **Resolution Rule**: Upon completion of all required tasks:
   - `AshaCase.status` $\to$ `"RESOLVED"`
   - `AshaCase.currentJourneyStep` $\to$ `"CASE_RESOLVED"`
   - All steps in `AshaCase.journeySteps` $\to$ `"COMPLETED"`
   - `AshaAssistanceRequest.status` $\to$ `"RESOLVED"`
   - Stale `START_ASSISTANCE` attention signals are suppressed.
   - Re-initiation requests are blocked with `409 Conflict`.
