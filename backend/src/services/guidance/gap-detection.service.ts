import { EligibilityResult, SchemeVersion } from "../../../../shared/types/eligibility.js";
import { Gap } from "../../../../shared/types/guidance.js";

export class GapDetectionService {
  /**
   * Deterministically detects actionable gaps from verified eligibility results and scheme versions
   */
  public detectGaps(
    eligibilityResults: EligibilityResult[],
    schemeVersions: Map<string, SchemeVersion> = new Map()
  ): Gap[] {
    const gaps: Gap[] = [];

    for (const result of eligibilityResults) {
      // DRAFT or unverified schemes MUST NOT generate citizen gaps
      if (!result.isVerifiedScheme) {
        continue;
      }

      const version = schemeVersions.get(result.schemeId);
      const officialSource = version?.sourceMetadata;

      // 1. ELIGIBLE results: Detect post-eligibility gaps (e.g. enrolment / e-KYC required)
      if (result.status === "ELIGIBLE") {
        if (
          result.schemeId === "ab-pmjay" ||
          result.pathwayCode === "PM-JAY-SENIOR-CITIZEN-70PLUS"
        ) {
          gaps.push({
            id: `gap_${result.schemeId}_enrolment_ekyc`,
            schemeId: result.schemeId,
            schemeName: result.schemeShortName || result.schemeName,
            type: "ENROLMENT_REQUIRED",
            priority: "REQUIRED",
            title: "Complete Official 70+ Senior Citizen e-KYC Enrolment",
            description:
              "Aadhaar-based e-KYC is required on the official Ayushman App (NHA) or at an Ayushman Mitra kiosk to generate the distinct Ayushman Vay Vandana Card before hospitalization benefits can be claimed.",
            reason:
              "Meets the age-based 70+ eligibility criterion under AB PM-JAY. Official enrolment is still required before hospital admission.",
            officialSource,
          });
        }
      }

      // 2. NEEDS_INFORMATION results: Detect missing data / facility requirement gaps
      if (result.status === "NEEDS_INFORMATION") {
        for (const req of result.missingRequirements) {
          const isFacility =
            req.field.toLowerCase().includes("facility") ||
            req.field.toLowerCase().includes("institution");

          gaps.push({
            id: `gap_${result.schemeId}_${req.field}`,
            schemeId: result.schemeId,
            schemeName: result.schemeShortName || result.schemeName,
            type: isFacility ? "FACILITY_REQUIREMENT" : "MISSING_INFORMATION",
            priority: "REQUIRED",
            title: isFacility
              ? "Institutional Delivery & Facility Details Needed"
              : `Missing Household Information: ${req.field}`,
            description: req.actionPrompt,
            reason:
              "Scheme eligibility criteria require this information to determine whether healthcare support applies.",
            targetField: req.field,
            targetScope: req.scope,
            officialSource,
          });
        }
      }

      // 3. NOT_ELIGIBLE results: Zero gaps generated (prevents misleading actions)
    }

    return gaps;
  }
}
