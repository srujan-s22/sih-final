import { HouseholdRepository } from "../../repositories/household.repository.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { EvidenceRepository } from "../../repositories/evidence.repository.js";
import { EligibilityService } from "../eligibility/eligibility.service.js";
import { GuidanceService } from "../guidance/guidance.service.js";
import { AIContextBuilder } from "./ai-context-builder.js";
import { GeminiService, GeminiProviderError } from "./gemini.service.js";
import { buildAssistantSystemInstruction } from "./prompts/assistant.prompt.js";
import {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantStatusResponse,
  AssistantCitedEvidence,
  AssistantMessage,
} from "../../../../shared/types/assistant.js";
import { UserRole } from "../../../../shared/types/auth.js";
import { Scheme } from "../../../../shared/types/eligibility.js";
import { EvidenceRecord } from "../../../../shared/types/evidence.js";
import { CaseRepository } from "../../repositories/case.repository.js";
import { HTTP_STATUS } from "../../config/constants.js";

export class AssistantServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = "ASSISTANT_ERROR"
  ) {
    super(message);
    this.name = "AssistantServiceError";
  }
}

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
}

export class AssistantService {
  private rateLimitMap = new Map<string, RateLimitRecord>();
  private readonly RATE_LIMIT_MAX = 20; // 20 requests per minute
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;

  constructor(
    private householdRepo: HouseholdRepository,
    private eligibilityService: EligibilityService,
    private guidanceService: GuidanceService,
    private schemeRepo: SchemeRepository,
    private evidenceRepo: EvidenceRepository,
    private aiContextBuilder: AIContextBuilder,
    private geminiService: GeminiService,
    private caseRepo?: CaseRepository
  ) {}

  /**
   * Returns current conversational assistant availability and configuration status.
   */
  public getStatus(userRole: UserRole = "CITIZEN"): AssistantStatusResponse {
    return {
      isConfigured: this.geminiService.isConfigured(),
      model: this.geminiService.getModelName(),
      supportedLanguages: ["en", "hi", "kn"],
      role: userRole,
    };
  }

  /**
   * Evaluates rate limiting per identifier (UID or IP).
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now - record.firstAttemptAt > this.RATE_LIMIT_WINDOW_MS) {
      this.rateLimitMap.set(identifier, { count: 1, firstAttemptAt: now });
      return true;
    }

    if (record.count >= this.RATE_LIMIT_MAX) {
      return false;
    }

    record.count += 1;
    return true;
  }

  /**
   * Orchestrates role-authorized, grounded conversation with Google Gemini.
   */
  public async chat(params: {
    authenticatedUserUid: string;
    userRole: UserRole;
    request: AssistantChatRequest;
    clientIp?: string;
  }): Promise<AssistantChatResponse> {
    const { authenticatedUserUid, userRole, request, clientIp } = params;
    const rateKey = authenticatedUserUid || clientIp || "anon-client";

    // 1. Rate Limiting Check
    if (!this.checkRateLimit(rateKey)) {
      throw new GeminiProviderError(
        "Too many requests to the assistant. Please slow down and try again in a moment.",
        "GEMINI_RATE_LIMITED",
        429
      );
    }

    const language = request.language || "en";

    // 2. Validate Client-Provided Scheme ID (Server-side defense)
    let targetScheme: Scheme | null = null;
    if (request.schemeId && request.schemeId.trim().length > 0) {
      targetScheme = await this.schemeRepo.getSchemeById(request.schemeId.trim());
    }

    // 3. Authoritative Level 1 & Level 2 Data Retrieval
    let household = null;
    let members: any[] = [];
    let eligibilityResults: any[] = [];
    let guidance: any = null;

    if (userRole === "CITIZEN") {
      if (request.caseId) {
        throw new AssistantServiceError(
          "Citizens cannot query arbitrary case IDs.",
          HTTP_STATUS.FORBIDDEN,
          "FORBIDDEN_ROLE"
        );
      }
      household = await this.householdRepo.getHouseholdByOwnerUid(authenticatedUserUid);
      if (household) {
        members = await this.householdRepo.getMembers(household.id);
        eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
          household,
          members
        );
        guidance = await this.guidanceService.getCitizenGuidance(authenticatedUserUid);
      }
    } else if (userRole === "ASHA") {
      if (request.caseId) {
        if (!this.caseRepo) {
          throw new AssistantServiceError(
            "Case repository unavailable.",
            HTTP_STATUS.SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE"
          );
        }
        const c = await this.caseRepo.getCaseById(request.caseId.trim());
        if (!c || c.assignedAshaUid !== authenticatedUserUid) {
          throw new AssistantServiceError(
            "Case not found or access denied.",
            HTTP_STATUS.NOT_FOUND,
            "CASE_ACCESS_DENIED"
          );
        }
        household = await this.householdRepo.getHouseholdById(c.householdId);
        if (household) {
          members = await this.householdRepo.getMembers(household.id);
          eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
            household,
            members
          );
          guidance = await this.guidanceService.getCitizenGuidance(c.householdId);
        }
      }
    } else if (userRole === "ADMIN" && request.caseId) {
      if (!this.caseRepo) {
        throw new AssistantServiceError(
          "Case repository unavailable.",
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          "SERVICE_UNAVAILABLE"
        );
      }
      const c = await this.caseRepo.getCaseById(request.caseId.trim());
      if (!c) {
        throw new AssistantServiceError(
          "Case not found.",
          HTTP_STATUS.NOT_FOUND,
          "CASE_NOT_FOUND"
        );
      }
      household = await this.householdRepo.getHouseholdById(c.householdId);
      if (household) {
        members = await this.householdRepo.getMembers(household.id);
        eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
          household,
          members
        );
        guidance = await this.guidanceService.getCitizenGuidance(c.householdId);
      }
    }

    // 4. Retrieve Active Verified Schemes & Verified Evidence
    const schemes = await this.schemeRepo.listActiveSchemes();
    const verifiedEvidenceList: EvidenceRecord[] = [];

    for (const s of schemes) {
      const evList = await this.evidenceRepo.listEvidenceBySchemeId(s.id, true);
      verifiedEvidenceList.push(...evList);
    }

    // 5. Build Sanitized, PII-Minimized AIContext
    const aiContext = this.aiContextBuilder.buildContext({
      purpose: "EXPLAIN_ELIGIBILITY",
      language,
      household,
      members,
      eligibilityResults,
      gapResults: guidance?.gaps || [],
      schemes,
      evidence: verifiedEvidenceList,
      existingActions: guidance?.actionPlan || [],
      targetSchemeId: targetScheme?.id,
    });

    // 6. Build Grounded System Instructions
    const systemInstruction = buildAssistantSystemInstruction(userRole, language, aiContext);

    // 7. Sanitize & Bound Multi-turn Conversation Contents
    // Strict Invariant: Treat client history as untrusted dialogue turns only.
    const boundedHistory: AssistantMessage[] = (request.conversationHistory || [])
      .slice(-8)
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.substring(0, 1000).trim(),
      }));

    const contents: Array<{ role: "user" | "assistant"; text: string }> = [
      ...boundedHistory.map((m) => ({ role: m.role, text: m.content })),
      { role: "user", text: request.message.trim() },
    ];

    // 8. Generate Grounded Response via Gemini Service
    const replyText = await this.geminiService.generateContent({
      systemInstruction,
      contents,
      temperature: 0.2, // Low temperature for deterministic grounding
    });

    // 9. Extract Verified Citations from Verified Evidence Records
    const citedEvidence: AssistantCitedEvidence[] = [];
    const lowerReply = replyText.toLowerCase();

    for (const ev of verifiedEvidenceList) {
      const scheme = schemes.find((s) => s.id === ev.schemeId);
      const searchTokens = [
        scheme?.name.toLowerCase(),
        scheme?.shortName.toLowerCase(),
        scheme?.id.toLowerCase(),
        scheme?.id.replace(/-/g, "").toLowerCase(),
        ev.officialTitle?.toLowerCase(),
      ].filter(Boolean) as string[];

      const isRelevant =
        searchTokens.some((token) => token && lowerReply.includes(token)) ||
        (scheme?.name && lowerReply.includes(scheme.name.split(" ")[0].toLowerCase()));

      if (isRelevant && ev.sourceUrl && ev.sourceUrl.trim().length > 0) {
        if (!citedEvidence.some((c) => c.id === ev.id)) {
          citedEvidence.push({
            id: ev.id,
            schemeId: ev.schemeId,
            officialTitle: ev.officialTitle,
            sourceOrganization: ev.sourceOrganization,
            sourceUrl: ev.sourceUrl,
            relevantExcerpt: ev.relevantExcerpt,
          });
        }
      }
      if (citedEvidence.length >= 3) break;
    }

    // 10. Extract Suggested Action Prompts
    const suggestedActions: string[] = [];
    if (!household) {
      suggestedActions.push("How do I set up my household profile?");
      suggestedActions.push("What schemes are available in my state?");
    } else {
      if (eligibilityResults.some((e) => e.status === "ELIGIBLE")) {
        suggestedActions.push("What documents are needed for my eligible schemes?");
      }
      if (guidance?.gaps && guidance.gaps.length > 0) {
        suggestedActions.push("How can I resolve my top healthcare gap?");
      }
      suggestedActions.push("What benefits are available for my family members?");
    }

    const conversationId =
      request.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      reply: replyText,
      conversationId,
      groundingData: {
        evaluatedSchemesCount: eligibilityResults.length,
        eligibleSchemesCount: eligibilityResults.filter((e) => e.status === "ELIGIBLE").length,
        detectedGapsCount: guidance?.gaps?.length || 0,
        citedEvidence,
        targetSchemeName: targetScheme?.name,
      },
      suggestedActions: suggestedActions.slice(0, 3),
      disclaimer:
        "SwasthyaSetu Assistant provides guidance based on verified government scheme data. Final benefit grants are subject to official government verification.",
      timestamp: new Date().toISOString(),
      certainty: household ? "VERIFIED" : "INDICATIVE",
    };
  }
}
