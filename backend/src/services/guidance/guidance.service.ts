import { HouseholdRepository } from "../../repositories/household.repository.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { EligibilityService } from "../eligibility/eligibility.service.js";
import { SchemeService } from "../scheme.service.js";
import { SchemeVersion } from "../../../../shared/types/eligibility.js";
import {
  GuidanceResponse,
  HouseholdGuidanceStatus,
} from "../../../../shared/types/guidance.js";
import { GapDetectionService } from "./gap-detection.service.js";
import { DocumentReadinessService } from "./document-readiness.service.js";
import { ActionPlanService } from "./action-plan.service.js";

export class GuidanceService {
  private gapDetectionService: GapDetectionService;
  private documentReadinessService: DocumentReadinessService;
  private actionPlanService: ActionPlanService;
  private schemeService: SchemeService;

  constructor(
    private householdRepo: HouseholdRepository,
    private eligibilityService: EligibilityService,
    private schemeRepo: SchemeRepository
  ) {
    this.gapDetectionService = new GapDetectionService();
    this.documentReadinessService = new DocumentReadinessService();
    this.actionPlanService = new ActionPlanService();
    this.schemeService = new SchemeService(schemeRepo);
  }

  /**
   * Evaluates complete citizen guidance pipeline
   */
  public async getCitizenGuidance(ownerUid: string): Promise<GuidanceResponse> {
    const household = await this.householdRepo.getHouseholdByOwnerUid(ownerUid);

    // 1. Handle Missing Household Gracefully
    if (!household) {
      return {
        householdStatus: "MORE_INFORMATION_NEEDED",
        statusSummary: "Please complete your basic household setup to check applicable healthcare schemes.",
        evaluatedSchemesCount: 0,
        eligibleSchemes: [],
        informationNeededSchemes: [],
        notEligibleSchemes: [],
        gaps: [],
        documentReadiness: {
          status: "UNKNOWN",
          totalRequired: 0,
          readyCount: 0,
          unknownCount: 0,
          missingCount: 0,
          items: [],
        },
        actionPlan: [
          {
            id: "act_setup_household",
            title: "Complete Household Onboarding",
            description: "Provide your basic location and ration details to start entitlement checks.",
            priority: "REQUIRED",
            actionType: "COMPLETE_MISSING_INFORMATION",
            reason: "Basic household data is required to discover healthcare support.",
            relatedSchemeId: "system",
            relatedSchemeName: "SwasthyaSetu Setup",
            stepNumber: 1,
          },
        ],
        evaluatedAt: new Date().toISOString(),
      };
    }

    const members = await this.householdRepo.getMembers(household.id);

    // 2. Evaluate against all active verified schemes
    const results = await this.eligibilityService.evaluateHouseholdForSchemes(
      household,
      members
    );

    // 3. Collect scheme version metadata
    const versionsMap = new Map<string, SchemeVersion>();
    for (const res of results) {
      const version = await this.schemeRepo.getActiveVersion(res.schemeId);
      if (version) {
        versionsMap.set(res.schemeId, version);
      }
    }

    // 4. Run Gap Detection
    const gaps = this.gapDetectionService.detectGaps(results, versionsMap);

    // 5. Run Document Readiness Evaluation
    const documentReadiness = this.documentReadinessService.evaluateReadiness(
      results,
      household
    );

    // 6. Generate Action Plan
    const actionPlan = this.actionPlanService.generateActionPlan(
      results,
      gaps,
      documentReadiness,
      versionsMap
    );

    // 7. Group Results
    const eligibleSchemes = results.filter((r) => r.status === "ELIGIBLE");
    const informationNeededSchemes = results.filter((r) => r.status === "NEEDS_INFORMATION");
    const notEligibleSchemes = results.filter((r) => r.status === "NOT_ELIGIBLE");

    // 8. Determine Overall Household Status
    let householdStatus: HouseholdGuidanceStatus = "NO_CURRENT_MATCH";
    let statusSummary = "No currently verified national healthcare scheme matched your household profile.";

    if (eligibleSchemes.length > 0) {
      householdStatus = "ACTION_NEEDED";
      statusSummary = `Found ${eligibleSchemes.length} healthcare benefit pathway(s) matching your household. Official enrollment/e-KYC is required to receive benefits.`;
    } else if (informationNeededSchemes.length > 0) {
      householdStatus = "MORE_INFORMATION_NEEDED";
      statusSummary = `Additional household details needed to check entitlement for ${informationNeededSchemes.length} healthcare scheme(s).`;
    }

    return {
      householdStatus,
      statusSummary,
      evaluatedSchemesCount: results.length,
      eligibleSchemes,
      informationNeededSchemes,
      notEligibleSchemes,
      gaps,
      documentReadiness,
      actionPlan,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
