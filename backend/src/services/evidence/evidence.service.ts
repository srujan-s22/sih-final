import * as crypto from "crypto";
import { env } from "../../config/env.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { EvidenceRepository } from "../../repositories/evidence.repository.js";
import { SourceValidator } from "./source-validator.js";
import { TavilyService } from "./tavily.service.js";
import { SchemeVersion } from "../../../../shared/types/eligibility.js";
import {
  EvidenceRecord,
  EvidenceConflict,
  EvidenceSearchRequest,
  EvidenceSearchResponse,
  PublicVerifiedEvidence,
  EvidenceVerificationStatus,
} from "../../../../shared/types/evidence.js";

export class EvidenceService {
  private sourceValidator: SourceValidator;
  private tavilyService: TavilyService;

  constructor(
    private evidenceRepo: EvidenceRepository,
    private schemeRepo: SchemeRepository,
    tavilyService?: TavilyService,
    sourceValidator?: SourceValidator
  ) {
    this.tavilyService = tavilyService || new TavilyService();
    this.sourceValidator = sourceValidator || new SourceValidator();
  }

  /**
   * Generates a deterministic SHA256 hash for normalized search queries
   */
  public generateQueryHash(query: string): string {
    const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Controlled Claim-Based Evidence Search
   * Restricted to administrative discovery workflows.
   */
  public async searchClaimEvidence(
    request: EvidenceSearchRequest,
    adminUid: string
  ): Promise<EvidenceSearchResponse> {
    const scheme = await this.schemeRepo.getSchemeById(request.schemeId);
    const schemeName = scheme?.shortName || scheme?.name || request.schemeId;
    const activeVersion = await this.schemeRepo.getActiveVersion(request.schemeId);

    // 1. Construct Targeted Query (Clean of citizen PII)
    const rawQuery = `${schemeName} ${request.claim} official guidelines government of India`;
    const normalizedQuery = this.tavilyService.normalizeQuery(rawQuery);
    const queryHash = this.generateQueryHash(normalizedQuery);

    const now = new Date();
    const cacheTtlHours = env.EVIDENCE_CACHE_TTL_HOURS || 72;
    const expiresAt = new Date(now.getTime() + cacheTtlHours * 60 * 60 * 1000).toISOString();

    // 2. Check Search Cache (Credit Conservation)
    if (!request.forceRefresh) {
      const cachedSearch = await this.evidenceRepo.getSearchCache(queryHash);
      if (cachedSearch) {
        const cachedEvidence: EvidenceRecord[] = [];
        for (const id of cachedSearch.evidenceIds) {
          const rec = await this.evidenceRepo.getEvidenceById(id);
          if (rec) cachedEvidence.push(rec);
        }

        const conflicts = await this.evidenceRepo.listConflicts(request.schemeId);

        return {
          cacheHit: true,
          query: normalizedQuery,
          queryHash,
          schemeId: request.schemeId,
          retrievedAt: cachedSearch.retrievedAt,
          expiresAt: cachedSearch.expiresAt,
          candidatesCount: cachedEvidence.length,
          evidence: cachedEvidence,
          conflicts,
        };
      }
    }

    // 3. Execute Search via Tavily Provider
    const candidates = await this.tavilyService.search(normalizedQuery, {
      maxResults: env.EVIDENCE_MAX_SEARCH_RESULTS || 3,
    });

    const discoveredEvidence: EvidenceRecord[] = [];
    const evidenceIds: string[] = [];

    // 4. Validate & Classify Each Candidate Source
    for (const cand of candidates) {
      const validated = this.sourceValidator.validateCandidate(cand, request.claim);

      // Multi-stage lifecycle: Discovered sources are PENDING_REVIEW or REJECTED
      // They are NEVER automatically VERIFIED.
      let verificationStatus: EvidenceVerificationStatus = "DISCOVERED";
      if (validated.sourceType === "REJECTED") {
        verificationStatus = "REJECTED";
      } else if (validated.isAuthoritative) {
        verificationStatus = "PENDING_REVIEW";
      }

      const evidenceId = `ev_${request.schemeId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const record: EvidenceRecord = {
        id: evidenceId,
        schemeId: request.schemeId,
        schemeVersionId: request.schemeVersionId || activeVersion?.version,
        claim: request.claim,
        query: normalizedQuery,
        queryHash,
        sourceUrl: validated.sourceUrl,
        sourceDomain: validated.sourceDomain,
        sourceOrganization: validated.sourceOrganization,
        officialTitle: validated.officialTitle,
        sourceType: validated.sourceType,
        documentType: validated.documentType,
        sourceCitation: `${validated.sourceOrganization} — ${validated.officialTitle}`,
        relevantExcerpt: validated.relevantExcerpt,
        retrievedAt: now.toISOString(),
        publishedAt: cand.publishedDate,
        verificationStatus,
        contentHash: validated.contentHash,
        discoveredBy: "TAVILY_SEARCH",
        authorityScore: validated.authorityScore,
        relevanceScore: validated.relevanceScore,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await this.evidenceRepo.createEvidence(record);
      discoveredEvidence.push(record);
      evidenceIds.push(evidenceId);
    }

    // 5. Detect Non-Destructive Rule Conflicts against Active Scheme
    const conflicts = this.detectRuleConflicts(discoveredEvidence, activeVersion);
    for (const conflict of conflicts) {
      await this.evidenceRepo.createConflict(conflict);
    }

    // 6. Cache Search Results
    await this.evidenceRepo.setSearchCache({
      queryHash,
      normalizedQuery,
      schemeId: request.schemeId,
      schemeVersionId: request.schemeVersionId || activeVersion?.version,
      claim: request.claim,
      resultCount: discoveredEvidence.length,
      evidenceIds,
      retrievedAt: now.toISOString(),
      expiresAt,
      provider: "tavily",
    });

    return {
      cacheHit: false,
      query: normalizedQuery,
      queryHash,
      schemeId: request.schemeId,
      retrievedAt: now.toISOString(),
      expiresAt,
      candidatesCount: discoveredEvidence.length,
      evidence: discoveredEvidence,
      conflicts,
    };
  }

  /**
   * Public / Citizen-Safe Verified Evidence Retrieval
   * Strictly filters to ONLY verified evidence.
   */
  public async getVerifiedSchemeEvidence(schemeId: string): Promise<PublicVerifiedEvidence[]> {
    const verifiedRecords = await this.evidenceRepo.listEvidenceBySchemeId(schemeId, true);

    return verifiedRecords.map((rec) => ({
      id: rec.id,
      schemeId: rec.schemeId,
      claim: rec.claim,
      officialTitle: rec.officialTitle,
      sourceOrganization: rec.sourceOrganization,
      sourceUrl: rec.sourceUrl,
      sourceCitation: rec.sourceCitation,
      relevantExcerpt: rec.relevantExcerpt,
      lastVerifiedAt: rec.verifiedAt || rec.retrievedAt,
      documentType: rec.documentType,
    }));
  }

  /**
   * Explicit Admin Verification Workflow
   */
  public async updateVerificationStatus(
    evidenceId: string,
    status: "VERIFIED" | "REJECTED" | "SUPERSEDED",
    adminUid: string,
    reason?: string
  ): Promise<EvidenceRecord | null> {
    return this.evidenceRepo.updateVerificationStatus(evidenceId, status, adminUid, reason);
  }

  /**
   * List Detected Policy Conflicts
   */
  public async listConflicts(schemeId?: string): Promise<EvidenceConflict[]> {
    return this.evidenceRepo.listConflicts(schemeId);
  }

  /**
   * Non-destructive policy conflict detection
   * Detects if candidate evidence mentions conflicting thresholds (e.g. altered age requirement)
   */
  public detectRuleConflicts(
    newEvidence: EvidenceRecord[],
    activeVersion: SchemeVersion | null
  ): EvidenceConflict[] {
    const conflicts: EvidenceConflict[] = [];
    if (!activeVersion) return conflicts;

    for (const ev of newEvidence) {
      if (ev.verificationStatus === "REJECTED") continue;

      const text = `${ev.officialTitle} ${ev.relevantExcerpt}`.toLowerCase();

      // Example 1: PM-JAY 70+ Age Conflict Detection
      if (activeVersion.schemeId === "ab-pmjay") {
        // If text specifically claims a lower senior citizen threshold (e.g. 60 or 65 years)
        if (
          (text.includes("60 years") || text.includes("65 years") || text.includes("age 60")) &&
          text.includes("senior")
        ) {
          conflicts.push({
            id: `conflict_${ev.schemeId}_${Date.now()}`,
            schemeId: ev.schemeId,
            schemeVersionId: activeVersion.version,
            newEvidenceId: ev.id,
            claim: ev.claim,
            conflictType: "AGE_THRESHOLD_CHANGED",
            reason: "Source text mentions potential senior citizen age criteria below the active 70+ rule threshold.",
            detectedAt: new Date().toISOString(),
            status: "OPEN",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Example 2: Status Discrepancy
      if (text.includes("discontinued") || text.includes("merged into") || text.includes("revoked")) {
        conflicts.push({
          id: `conflict_${ev.schemeId}_status_${Date.now()}`,
          schemeId: ev.schemeId,
          schemeVersionId: activeVersion.version,
          newEvidenceId: ev.id,
          claim: ev.claim,
          conflictType: "SCHEME_STATUS_CHANGED",
          reason: "Source text mentions potential revocation or merger of the active scheme.",
          detectedAt: new Date().toISOString(),
          status: "OPEN",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return conflicts;
  }
}
