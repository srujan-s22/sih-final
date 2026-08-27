import * as crypto from "crypto";
import { env } from "../../config/env.js";
import { Household, Member } from "../../../../shared/types/household.js";
import { EligibilityResult, Scheme } from "../../../../shared/types/eligibility.js";
import { Gap, ActionPlanItem } from "../../../../shared/types/guidance.js";
import { EvidenceRecord } from "../../../../shared/types/evidence.js";
import {
  AIContext,
  AICapability,
  AILanguage,
  AIHouseholdSummary,
  AIMemberSummary,
  AIEligibilitySummary,
  AIGapSummary,
  AISchemeSummary,
  AIVerifiedEvidenceSummary,
  AIExistingActionSummary,
} from "../../../../shared/types/ai.js";

export class AIContextBuilder {
  public static readonly CONTEXT_VERSION = "1.0";

  constructor(private anonymizationSecret?: string) {
    this.anonymizationSecret = anonymizationSecret || env.LYZR_ANONYMIZATION_SECRET;
  }

  /**
   * Generates a stable, pseudonymous Lyzr user ID using HMAC-SHA256.
   * Requirement:
   * HMAC-SHA256(LYZR_ANONYMIZATION_SECRET, authenticatedFirebaseUid + ":" + purpose)
   * - Stable for same UID + purpose
   * - Distinct across different UIDs
   * - Distinct across different purposes
   * - Raw Firebase UID never leaves backend
   */
  public deriveAnonymousUserId(authenticatedFirebaseUid: string, purpose: string): string {
    const secret = this.anonymizationSecret || "swasthyasetu-default-anon-secret-key-2026";
    const payload = `${authenticatedFirebaseUid.trim()}:${purpose.trim()}`;
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Builds a strictly PII-minimized AIContext payload
   */
  public buildContext(params: {
    purpose: AICapability;
    language?: AILanguage;
    household?: Household | null;
    members?: Member[];
    eligibilityResults?: EligibilityResult[];
    gapResults?: Gap[];
    schemes?: Scheme[];
    evidence?: EvidenceRecord[];
    existingActions?: ActionPlanItem[];
    targetSchemeId?: string;
  }): AIContext {
    const language = params.language || "en";
    const members = params.members || [];
    const eligibility = params.eligibilityResults || [];
    const gaps = params.gapResults || [];
    const schemes = params.schemes || [];
    const evidence = params.evidence || [];
    const actions = params.existingActions || [];

    // 1. Household Summary (Strictly no ownerUid, headOfHouseholdName, rationCardNumber, address)
    const householdSummary: AIHouseholdSummary = {
      state: params.household?.state || "Unknown",
      district: params.household?.district || "Unknown",
      incomeCategory: params.household?.incomeCategory || "UNKNOWN",
      memberCount: members.length,
    };

    // 2. Member Summaries (Strictly no full names, IDs, phone, email)
    const memberSummaries: AIMemberSummary[] = members.map((m, index) => ({
      memberIndex: index + 1,
      age: m.age,
      gender: m.gender,
      relationship: m.relationship,
      disabilityStatus: m.disabilityStatus,
      maternalStatus: m.maternalStatus,
      chronicConditionsCount: Array.isArray(m.chronicConditions) ? m.chronicConditions.length : 0,
    }));

    // Filter by target scheme if requested
    const filteredEligibility = params.targetSchemeId
      ? eligibility.filter((e) => e.schemeId === params.targetSchemeId)
      : eligibility;

    // 3. Eligibility Summaries
    const eligibilityResults: AIEligibilitySummary[] = filteredEligibility.map((e) => ({
      schemeId: e.schemeId,
      schemeName: e.schemeName,
      status: e.status,
      pathwayCode: e.pathwayCode,
      benefitSummary: e.benefitSummary,
      matchedRuleSummaries: e.matchedRules.map((r) => r.ruleName),
      failedRuleSummaries: e.failedRules.map((r) => r.ruleName),
      missingRequirements: e.missingRequirements.map((m) => m.field),
      isVerifiedScheme: e.isVerifiedScheme,
    }));

    // 4. Gap Summaries
    const gapResults: AIGapSummary[] = gaps.map((g) => ({
      gapId: g.id,
      schemeId: g.schemeId,
      schemeName: g.schemeName,
      type: g.type,
      priority: g.priority,
      title: g.title,
      description: g.description,
      reason: g.reason,
    }));

    // 5. Scheme Summaries
    const schemeSummaries: AISchemeSummary[] = schemes.map((s) => ({
      schemeId: s.id,
      name: s.name,
      shortName: s.shortName,
      category: s.category,
      level: s.level,
      benefitSummary: s.benefitSummary,
      isVerified: s.sourceMetadata?.isVerified ?? false,
    }));

    // 6. Verified Evidence ONLY (STRICT INVARIANT: No PENDING_REVIEW, DISCOVERED, or REJECTED)
    const verifiedEvidence: AIVerifiedEvidenceSummary[] = evidence
      .filter((ev) => ev.verificationStatus === "VERIFIED")
      .map((ev) => ({
        id: ev.id,
        schemeId: ev.schemeId,
        claim: ev.claim,
        officialTitle: ev.officialTitle,
        sourceOrganization: ev.sourceOrganization,
        sourceUrl: ev.sourceUrl,
        sourceType: ev.sourceType,
        documentType: ev.documentType,
        relevantExcerpt: ev.relevantExcerpt,
      }));

    // 7. Existing Action Plan Summaries
    const existingActions: AIExistingActionSummary[] = actions.map((a) => ({
      id: a.id,
      title: a.title,
      actionType: a.actionType,
      priority: a.priority,
    }));

    return {
      contextVersion: AIContextBuilder.CONTEXT_VERSION,
      generatedAt: new Date().toISOString(),
      requestPurpose: params.purpose,
      language,
      householdSummary,
      memberSummaries,
      eligibilityResults,
      gapResults,
      schemeSummaries,
      verifiedEvidence,
      existingActions,
    };
  }

  /**
   * Deterministically computes a SHA256 context hash for caching
   */
  public computeContextHash(context: AIContext): string {
    // Exclude volatile generatedAt timestamp from cache key computation
    const canonicalPayload = {
      contextVersion: context.contextVersion,
      requestPurpose: context.requestPurpose,
      language: context.language,
      householdSummary: context.householdSummary,
      memberSummaries: context.memberSummaries,
      eligibilityResults: context.eligibilityResults,
      gapResults: context.gapResults,
      schemeSummaries: context.schemeSummaries,
      verifiedEvidence: context.verifiedEvidence,
      existingActions: context.existingActions,
    };

    const canonicalJson = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort());
    return crypto.createHash("sha256").update(canonicalJson).digest("hex");
  }
}
