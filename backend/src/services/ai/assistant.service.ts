import { HouseholdRepository } from "../../repositories/household.repository.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { EvidenceRepository } from "../../repositories/evidence.repository.js";
import { EligibilityService } from "../eligibility/eligibility.service.js";
import { GuidanceService } from "../guidance/guidance.service.js";
import { AIContextBuilder } from "./ai-context-builder.js";
import { GeminiService, GeminiProviderError } from "./gemini.service.js";
import { buildAssistantSystemInstruction, QueryRoutingInfo } from "./prompts/assistant.prompt.js";
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

export function sanitizeAssistantReply(text: string): string {
  if (!text) return "";
  let clean = text
    // Strip raw Markdown headings like ### or ##
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    // Strip horizontal dividers like ---, ***, ___
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "")
    // Normalize excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return clean;
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

    // 2. Deterministic Query Routing & Intent Detection
    const routing = this.detectQueryRouting(request.message, request.schemeId);

    let targetScheme: Scheme | null = null;
    if (routing.targetSchemeId) {
      targetScheme = await this.schemeRepo.getSchemeById(routing.targetSchemeId);
    }

    // 3. Authoritative Level 1 & Level 2 Data Retrieval
    // Identify if the query is a personalized eligibility check.
    // Pure information ("What is PMMVY?"), document ("What documents are required for PMMVY?"),
    // and general comparison ("PMMVY vs JSY") queries MUST NOT unnecessarily load household profiles,
    // unrelated schemes, or execute full eligibility evaluations.
    const isPersonalizedQuery =
      Boolean(request.caseId) ||
      routing.mode === "BROAD_DISCOVERY" ||
      routing.intent === "ELIGIBILITY" ||
      /\b(am\s*i|my\s*family|our\s*family|my\s*household|we\s*can|can\s*i|can\s*we|my\s*(wife|mother|father|child|daughter|son|husband|parents)|eligible|qualify)\b/i.test(request.message);

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
      if (isPersonalizedQuery) {
        household = await this.householdRepo.getHouseholdByOwnerUid(authenticatedUserUid);
        if (household) {
          members = await this.householdRepo.getMembers(household.id);
          eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
            household,
            members
          );
          guidance = await this.guidanceService.getCitizenGuidance(authenticatedUserUid);
        }
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
    // Scope schemes strictly according to routing to prevent context bloat and eliminate latency
    let schemes = await this.schemeRepo.listActiveSchemes();

    if (routing.mode === "FOCUSED_SCHEME" && routing.targetSchemeId) {
      const targetId = routing.targetSchemeId.toLowerCase();
      const matched = schemes.find((s) => s.id.toLowerCase() === targetId);
      if (matched) {
        schemes = [matched];
      }
    } else if (routing.mode === "COMPARISON" && routing.targetSchemeIds) {
      const allowed = new Set(routing.targetSchemeIds.map((id) => id.toLowerCase()));
      schemes = schemes.filter((s) => allowed.has(s.id.toLowerCase()));
    } else if (routing.mode === "CATEGORY_DISCOVERY" && routing.targetSchemeIds) {
      const allowed = new Set(routing.targetSchemeIds.map((id) => id.toLowerCase()));
      schemes = schemes.filter((s) => allowed.has(s.id.toLowerCase()));
    }

    // Concurrent parallel evidence retrieval strictly for the scoped schemes
    const verifiedEvidenceList: EvidenceRecord[] = [];
    const evidencePromises = schemes.map((s) =>
      this.evidenceRepo.listEvidenceBySchemeId(s.id, true)
    );
    const evidenceBatches = await Promise.all(evidencePromises);
    for (const batch of evidenceBatches) {
      verifiedEvidenceList.push(...batch);
    }

    // 5. Build Sanitized, PII-Minimized AIContext (Filtered by routing relevance)
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
      targetSchemeId: routing.targetSchemeId,
      targetSchemeIds: routing.targetSchemeIds,
    });

    // 6. Build Grounded System Instructions
    const systemInstruction = buildAssistantSystemInstruction(
      userRole,
      language,
      aiContext,
      routing
    );

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
    const rawReply = await this.geminiService.generateContent({
      systemInstruction,
      contents,
      temperature: 0.2, // Low temperature for deterministic grounding
    });
    const replyText = sanitizeAssistantReply(rawReply);

    // 9. Extract Verified Citations from Verified Evidence Records (Relevance constrained)
    const citedEvidence: AssistantCitedEvidence[] = [];
    const lowerReply = replyText.toLowerCase();

    const allowedSchemeIds = routing.targetSchemeId
      ? new Set([routing.targetSchemeId.toLowerCase()])
      : routing.targetSchemeIds
      ? new Set(routing.targetSchemeIds.map((id) => id.toLowerCase()))
      : null;

    for (const ev of verifiedEvidenceList) {
      if (allowedSchemeIds && !allowedSchemeIds.has(ev.schemeId.toLowerCase())) {
        continue;
      }

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

    // 10. Extract Suggested Action Prompts (tailored to query intent)
    const suggestedActions: string[] = [];
    if (routing.targetSchemeId === "pmmvy") {
      suggestedActions.push("What documents are required for PMMVY?");
      suggestedActions.push("How much money does PMMVY provide?");
      suggestedActions.push("How do I apply for PMMVY?");
    } else if (routing.targetSchemeId === "ab-pmjay") {
      suggestedActions.push("What documents are needed for Ayushman Bharat?");
      suggestedActions.push("Who is eligible for Ayushman Bharat 70+?");
      suggestedActions.push("How do I get an Ayushman card?");
    } else if (routing.targetSchemeId === "jsy") {
      suggestedActions.push("What financial assistance does JSY provide?");
      suggestedActions.push("What documents are required for JSY?");
    } else if (!household) {
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

  /**
   * Deterministic query intent and scheme routing
   */
  public detectQueryRouting(
    userMessage: string,
    explicitSchemeId?: string | null
  ): QueryRoutingInfo {
    const norm = userMessage.toLowerCase().trim();

    // 1. Identify all mentioned schemes in message
    const mentionedSchemes = new Set<string>();

    // PMMVY patterns
    if (
      /\b(pmmvy|matru\s*vandana|matri\s*vandana|pradhan\s*mantri\s*matru|pradhan\s*mantri\s*matri)\b/i.test(
        norm
      )
    ) {
      mentionedSchemes.add("pmmvy");
    }

    // AB-PMJAY patterns
    if (
      /\b(ab-pmjay|pmjay|pm-jay|ayushman|ayushman\s*bharat|vay\s*vandana|70\s*\+|senior\s*citizen\s*health|golden\s*card)\b/i.test(
        norm
      )
    ) {
      mentionedSchemes.add("ab-pmjay");
    }

    // JSY patterns
    if (/\b(jsy|janani\s*suraksha)\b/i.test(norm)) {
      mentionedSchemes.add("jsy");
    }

    // 2. Check for comparison intent
    const isComparison =
      /\b(vs|versus|difference\s*between|compare|comparison|or\s+jsy|or\s+pmmvy|or\s+ayushman)\b/i.test(
        norm
      );

    if (isComparison && mentionedSchemes.size >= 2) {
      return {
        mode: "COMPARISON",
        targetSchemeIds: Array.from(mentionedSchemes),
        intent: "GENERAL",
      };
    }

    // If comparison requested but only 1 scheme in text and explicitSchemeId is another
    if (
      isComparison &&
      mentionedSchemes.size === 1 &&
      explicitSchemeId &&
      !mentionedSchemes.has(explicitSchemeId.trim().toLowerCase())
    ) {
      return {
        mode: "COMPARISON",
        targetSchemeIds: [explicitSchemeId.trim().toLowerCase(), ...Array.from(mentionedSchemes)],
        intent: "GENERAL",
      };
    }

    // 3. If explicitSchemeId provided and user message does NOT mention any other specific scheme
    if (
      explicitSchemeId &&
      explicitSchemeId.trim() &&
      mentionedSchemes.size === 0 &&
      !/\b(what\s*(healthcare\s*)?schemes|which\s*schemes|all\s*schemes|schemes\s*(available|for)|my\s*family\s*get|what\s*can\s*(my\s*family|we)\s*get)\b/i.test(norm)
    ) {
      return {
        mode: "FOCUSED_SCHEME",
        targetSchemeId: explicitSchemeId.trim().toLowerCase(),
        intent: this.detectIntent(norm),
      };
    }

    // 4. If exactly one scheme mentioned in text
    if (mentionedSchemes.size === 1) {
      const schemeId = Array.from(mentionedSchemes)[0];
      return {
        mode: "FOCUSED_SCHEME",
        targetSchemeId: schemeId,
        intent: this.detectIntent(norm),
      };
    }

    // 5. If more than 1 scheme mentioned without explicit "vs", treat as comparison or multi-scheme focus
    if (mentionedSchemes.size >= 2) {
      return {
        mode: "COMPARISON",
        targetSchemeIds: Array.from(mentionedSchemes),
        intent: this.detectIntent(norm),
      };
    }

    // 6. Category discovery
    if (
      /\b(maternity|pregnancy|pregnant|lactating|newborn|motherhood|childbirth|delivery)\b/i.test(
        norm
      )
    ) {
      return {
        mode: "CATEGORY_DISCOVERY",
        targetSchemeIds: ["pmmvy", "jsy"],
        detectedCategory: "MATERNAL",
        intent: this.detectIntent(norm),
      };
    }

    if (
      /\b(senior\s*citizen|elderly|old\s*age|grandfather|grandmother|70\s*years|71\s*years|72\s*years|75\s*years|80\s*years)\b/i.test(
        norm
      )
    ) {
      return {
        mode: "CATEGORY_DISCOVERY",
        targetSchemeIds: ["ab-pmjay"],
        detectedCategory: "SENIOR_CITIZEN",
        intent: this.detectIntent(norm),
      };
    }

    // 7. Broad discovery
    return {
      mode: "BROAD_DISCOVERY",
      intent: this.detectIntent(norm),
    };
  }

  private detectIntent(
    norm: string
  ): "DOCUMENTS" | "BENEFITS" | "ELIGIBILITY" | "APPLICATION" | "GENERAL" {
    if (
      /\b(document|documents|paper|papers|proof|proofs|certificate|card|passbook|aadhaar|needed|required|require|bring)\b/i.test(
        norm
      )
    ) {
      return "DOCUMENTS";
    }
    if (
      /\b(benefit|benefits|money|cash|amount|rupee|rupees|₹|how\s*much|coverage|lakh|installment|installments)\b/i.test(
        norm
      )
    ) {
      return "BENEFITS";
    }
    if (
      /\b(eligible|eligibility|qualify|qualifies|criteria|can\s*i\s*get|am\s*i\s*eligible|who\s*can|entitled)\b/i.test(
        norm
      )
    ) {
      return "ELIGIBILITY";
    }
    if (
      /\b(apply|application|register|registration|enroll|enrollment|how\s*do\s*i|where\s*can\s*i|portal|form|process)\b/i.test(
        norm
      )
    ) {
      return "APPLICATION";
    }
    return "GENERAL";
  }
}
