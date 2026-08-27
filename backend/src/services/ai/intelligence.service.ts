import { env } from "../../config/env.js";
import { HouseholdRepository } from "../../repositories/household.repository.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { EvidenceRepository } from "../../repositories/evidence.repository.js";
import { AICacheRepository } from "../../repositories/ai-cache.repository.js";
import { EligibilityService } from "../eligibility/eligibility.service.js";
import { GuidanceService } from "../guidance/guidance.service.js";
import { AIContextBuilder } from "./ai-context-builder.js";
import { LyzrService } from "./lyzr.service.js";
import {
  buildEligibilityExplanationPrompt,
  buildGapPrioritizationPrompt,
  buildActionPlanPrompt,
  buildEvidenceSummaryPrompt,
  buildNeedsInformationPrompt,
} from "./prompts/index.js";
import {
  AIIntelligenceRequest,
  AIIntelligenceResponse,
  AICapability,
} from "../../../../shared/types/ai.js";

export class IntelligenceService {
  constructor(
    private householdRepo: HouseholdRepository,
    private eligibilityService: EligibilityService,
    private guidanceService: GuidanceService,
    private schemeRepo: SchemeRepository,
    private evidenceRepo: EvidenceRepository,
    private aiCacheRepo: AICacheRepository,
    private aiContextBuilder: AIContextBuilder,
    private lyzrService: LyzrService
  ) {}

  /**
   * Generates grounded AI intelligence for an authenticated citizen's own household
   */
  public async generateIntelligence(
    authenticatedUserUid: string,
    request: AIIntelligenceRequest
  ): Promise<AIIntelligenceResponse> {
    const language = request.language || "en";

    // 1. Resolve Citizen's Household
    const household = await this.householdRepo.getHouseholdByOwnerUid(authenticatedUserUid);
    if (!household) {
      return {
        capability: request.capability,
        contextVersion: AIContextBuilder.CONTEXT_VERSION,
        language,
        certainty: "INSUFFICIENT_INFORMATION",
        explanation:
          language === "hi"
            ? "कृपया अपनी पात्रता और व्यक्तिगत स्वास्थ्य मार्गदर्शन प्राप्त करने के लिए पहले अपने परिवार की जानकारी दर्ज करें।"
            : language === "kn"
            ? "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅರ್ಹತೆ ಮತ್ತು ವೈಯಕ್ತಿಕ ಆರೋಗ್ಯ ಮಾರ್ಗದರ್ಶನ ಪಡೆಯಲು ಮೊದಲು ನಿಮ್ಮ ಕುಟುಂಬದ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ."
            : "Please complete your household profile onboarding first so SwasthyaSetu can evaluate your healthcare eligibility and guidance.",
        evidenceReferences: [],
        disclaimer: "Healthcare guidance requires verified household and member information.",
        generatedAt: new Date().toISOString(),
      };
    }

    const members = await this.householdRepo.getMembers(household.id);

    // 2. Run Deterministic Eligibility Engine (AUTHORITATIVE)
    const eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
      household,
      members
    );

    // 3. Run Guidance Engine (AUTHORITATIVE GAPS & ACTIONS)
    const guidance = await this.guidanceService.getCitizenGuidance(authenticatedUserUid);

    // 4. Retrieve Active Verified Schemes
    const schemes = await this.schemeRepo.listActiveSchemes();

    // 5. Retrieve Verified Evidence (Strictly verificationStatus === "VERIFIED")
    const allEvidence = [];
    for (const s of schemes) {
      const evList = await this.evidenceRepo.listEvidenceBySchemeId(s.id, true);
      allEvidence.push(...evList);
    }

    // 6. Build PII-Sanitized AIContext
    const aiContext = this.aiContextBuilder.buildContext({
      purpose: request.capability,
      language,
      household,
      members,
      eligibilityResults,
      gapResults: guidance.gaps,
      schemes: schemes,
      evidence: allEvidence,
      existingActions: guidance.actionPlan || [],
      targetSchemeId: request.schemeId,
    });

    // 7. Check Deterministic Context Hash Cache
    const contextHash = this.aiContextBuilder.computeContextHash(aiContext);
    if (!request.forceRefresh) {
      const cached = await this.aiCacheRepo.getCache(contextHash);
      if (cached) {
        return cached;
      }
    }

    // 8. Derive HMAC Pseudonymous User ID
    const anonymousUserId = this.aiContextBuilder.deriveAnonymousUserId(
      authenticatedUserUid,
      request.capability
    );

    // 9. Select Capability-Specific Prompt
    const prompt = this.selectPromptForCapability(request.capability, aiContext);

    // 10. Call Lyzr AI Service
    const aiResponse = await this.lyzrService.generateIntelligence(prompt, anonymousUserId);

    // 11. Persist to L1/L2 Cache with TTL
    const now = Date.now();
    const cacheTtlHours = env.AI_CACHE_TTL_HOURS || 24;
    const expiresAt = new Date(now + cacheTtlHours * 3600 * 1000).toISOString();

    await this.aiCacheRepo.setCache(contextHash, {
      contextHash,
      capability: request.capability,
      contextVersion: aiContext.contextVersion,
      language,
      response: aiResponse,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    });

    return aiResponse;
  }

  private selectPromptForCapability(
    capability: AICapability,
    context: Parameters<typeof buildEligibilityExplanationPrompt>[0]
  ): string {
    switch (capability) {
      case "EXPLAIN_ELIGIBILITY":
        return buildEligibilityExplanationPrompt(context);
      case "PRIORITIZE_GAPS":
        return buildGapPrioritizationPrompt(context);
      case "GENERATE_ACTION_PLAN":
        return buildActionPlanPrompt(context);
      case "SUMMARIZE_EVIDENCE":
        return buildEvidenceSummaryPrompt(context);
      case "EXPLAIN_NEEDS_INFORMATION":
        return buildNeedsInformationPrompt(context);
    }
  }
}
