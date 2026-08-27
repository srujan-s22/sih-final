import { EligibilityResult, SchemeVersion } from "../../../../shared/types/eligibility.js";
import {
  ActionPlanItem,
  Gap,
  GuidanceActionType,
  OverallDocumentReadiness,
} from "../../../../shared/types/guidance.js";

export class ActionPlanService {
  /**
   * Generates a strictly prioritized, source-traceable action plan
   */
  public generateActionPlan(
    eligibilityResults: EligibilityResult[],
    gaps: Gap[],
    documentReadiness: OverallDocumentReadiness,
    schemeVersions: Map<string, SchemeVersion> = new Map()
  ): ActionPlanItem[] {
    const rawActions: ActionPlanItem[] = [];
    const seenActionIds = new Set<string>();

    // 1. Actions from Detected Gaps (Strictly source-backed)
    for (const gap of gaps) {
      if (gap.type === "ENROLMENT_REQUIRED") {
        const actionId = `action_${gap.schemeId}_complete_ekyc`;
        if (!seenActionIds.has(actionId)) {
          seenActionIds.add(actionId);
          rawActions.push({
            id: actionId,
            title: gap.title,
            description: gap.description,
            priority: "REQUIRED",
            actionType: "COMPLETE_EKYC",
            reason: gap.reason,
            relatedSchemeId: gap.schemeId,
            relatedSchemeName: gap.schemeName,
            relatedGapId: gap.id,
            stepNumber: 0,
            officialSource: gap.officialSource,
          });
        }
      } else if (gap.type === "MISSING_INFORMATION" || gap.type === "FACILITY_REQUIREMENT") {
        const actionId = `action_${gap.schemeId}_provide_${gap.targetField || "info"}`;
        if (!seenActionIds.has(actionId)) {
          seenActionIds.add(actionId);
          rawActions.push({
            id: actionId,
            title: gap.type === "FACILITY_REQUIREMENT"
              ? "Connect with Local ASHA for Facility Registration"
              : `Update Missing Information: ${gap.targetField}`,
            description: gap.description,
            priority: "REQUIRED",
            actionType: gap.type === "FACILITY_REQUIREMENT" ? "CONTACT_ASHA" : "COMPLETE_MISSING_INFORMATION",
            reason: gap.reason,
            relatedSchemeId: gap.schemeId,
            relatedSchemeName: gap.schemeName,
            relatedGapId: gap.id,
            stepNumber: 0,
            officialSource: gap.officialSource,
          });
        }
      }
    }

    // 2. Verified Scheme Actions (From SchemeVersion metadata of ELIGIBLE or NEEDS_INFO schemes)
    for (const result of eligibilityResults) {
      if (!result.isVerifiedScheme || result.status === "NOT_ELIGIBLE") {
        continue;
      }

      const version = schemeVersions.get(result.schemeId);
      const schemeActions = version?.actions || result.nextActions || [];

      for (const act of schemeActions) {
        const actionId = `scheme_act_${result.schemeId}_${act.id}`;
        if (!seenActionIds.has(actionId)) {
          seenActionIds.add(actionId);

          let guidanceType: GuidanceActionType = "VERIFY_INFORMATION";
          if (act.actionType === "DOCUMENT_VERIFICATION") guidanceType = "COMPLETE_EKYC";
          else if (act.actionType === "CONTACT_ASHA") guidanceType = "CONTACT_ASHA";
          else if (act.actionType === "VISIT_CENTER") guidanceType = "VISIT_ENROLMENT_CENTRE";
          else if (act.actionType === "PROVIDE_INFORMATION") guidanceType = "COMPLETE_MISSING_INFORMATION";

          rawActions.push({
            id: actionId,
            title: act.title,
            description: act.description,
            priority: act.priority === "HIGH" ? "REQUIRED" : act.priority === "MEDIUM" ? "IMPORTANT" : "OPTIONAL",
            actionType: guidanceType,
            reason: `Action required under official guidelines for ${result.schemeShortName || result.schemeName}.`,
            relatedSchemeId: result.schemeId,
            relatedSchemeName: result.schemeShortName || result.schemeName,
            stepNumber: 0,
            officialSource: version?.sourceMetadata,
          });
        }
      }
    }

    // 3. Document Readiness Actions (For unverified/missing mandatory documents)
    for (const doc of documentReadiness.items) {
      if (doc.required && doc.status === "UNKNOWN") {
        const actionId = `action_doc_${doc.relatedSchemeId}_${doc.id}`;
        if (!seenActionIds.has(actionId)) {
          seenActionIds.add(actionId);
          rawActions.push({
            id: actionId,
            title: `Keep ${doc.name} Ready for Verification`,
            description: `${doc.description} Issued by: ${doc.issuingAuthority || "Competent Authority"}.`,
            priority: "IMPORTANT",
            actionType: "PROVIDE_DOCUMENT",
            reason: `Required to complete beneficiary enrollment for ${doc.relatedSchemeName}.`,
            relatedSchemeId: doc.relatedSchemeId,
            relatedSchemeName: doc.relatedSchemeName,
            stepNumber: 0,
          });
        }
      }
    }

    // 4. Deterministic Priority Sorting
    // Priority weights: REQUIRED (1) > IMPORTANT (2) > OPTIONAL (3)
    // Sub-weights: COMPLETE_MISSING_INFORMATION (1) > COMPLETE_EKYC (2) > CONTACT_ASHA (3) > VISIT_ENROLMENT_CENTRE (4) > PROVIDE_DOCUMENT (5) > VERIFY_INFORMATION (6)
    const priorityWeight: Record<string, number> = {
      REQUIRED: 1,
      IMPORTANT: 2,
      OPTIONAL: 3,
    };

    const typeWeight: Record<GuidanceActionType, number> = {
      COMPLETE_MISSING_INFORMATION: 1,
      CONTACT_ASHA: 2,
      COMPLETE_EKYC: 3,
      VISIT_ENROLMENT_CENTRE: 4,
      PROVIDE_DOCUMENT: 5,
      CHECK_OFFICIAL_DATABASE: 6,
      VERIFY_INFORMATION: 7,
    };

    rawActions.sort((a, b) => {
      const pDiff = (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99);
      if (pDiff !== 0) return pDiff;

      const tDiff = (typeWeight[a.actionType] || 99) - (typeWeight[b.actionType] || 99);
      if (tDiff !== 0) return tDiff;

      return a.id.localeCompare(b.id);
    });

    // 5. Assign sequential step numbers
    return rawActions.map((action, index) => ({
      ...action,
      stepNumber: index + 1,
    }));
  }
}
