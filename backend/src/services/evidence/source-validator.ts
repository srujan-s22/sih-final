import * as crypto from "crypto";
import {
  EvidenceCandidate,
  SourceAuthorityType,
  SourceDocumentType,
} from "../../../../shared/types/evidence.js";

export interface ValidatedSourceResult {
  sourceUrl: string;
  sourceDomain: string;
  sourceOrganization: string;
  officialTitle: string;
  sourceType: SourceAuthorityType;
  documentType: SourceDocumentType;
  relevantExcerpt: string;
  contentHash: string;
  authorityScore: number;
  relevanceScore: number;
  isAuthoritative: boolean;
}

export class SourceValidator {
  // Known Central Government & Scheme Hostnames
  private static readonly CENTRAL_GOVT_DOMAINS = new Set([
    "pmjay.gov.in",
    "nha.gov.in",
    "mohfw.gov.in",
    "nhm.gov.in",
    "india.gov.in",
    "uidai.gov.in",
    "pib.gov.in",
    "egazette.gov.in",
    "dghs.gov.in",
    "main.mohfw.gov.in",
    "beneficiary.nha.gov.in",
    "mera.pmjay.gov.in",
  ]);

  // Known Commercial / Blog / Untrusted Hostnames to explicitly reject
  private static readonly REJECTED_HOSTNAMES = new Set([
    "policybazaar.com",
    "bajajfinserv.in",
    "coverfox.com",
    "tataaia.com",
    "hdfcergo.com",
    "wikipedia.org",
    "quora.com",
    "reddit.com",
    "medium.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "youtube.com",
  ]);

  /**
   * Hostname-aware domain classification and authority scoring
   */
  public validateCandidate(
    candidate: EvidenceCandidate,
    claim: string
  ): ValidatedSourceResult {
    const parsedUrl = this.safeParseUrl(candidate.url);
    const hostname = parsedUrl ? parsedUrl.hostname.toLowerCase() : "";

    const sourceType = this.classifyHostname(hostname);
    const documentType = this.classifyDocumentType(candidate.title, candidate.url);
    const sourceOrganization = this.resolveOrganization(hostname, candidate.title);
    const relevantExcerpt = this.cleanExcerpt(candidate.content);
    const contentHash = this.computeContentHash(
      parsedUrl ? parsedUrl.origin + parsedUrl.pathname : candidate.url,
      candidate.title,
      relevantExcerpt
    );

    const authorityScore = this.calculateAuthorityScore(sourceType);
    const relevanceScore = this.calculateRelevanceScore(claim, candidate.title, relevantExcerpt);
    const isAuthoritative = sourceType === "OFFICIAL_GOVERNMENT" || sourceType === "STATE_GOVERNMENT";

    return {
      sourceUrl: candidate.url,
      sourceDomain: hostname,
      sourceOrganization,
      officialTitle: candidate.title.trim(),
      sourceType,
      documentType,
      relevantExcerpt,
      contentHash,
      authorityScore,
      relevanceScore,
      isAuthoritative,
    };
  }

  /**
   * Safely parses and validates URL protocol and format
   */
  public safeParseUrl(url: string): URL | null {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates hostname with exact and controlled suffix matching
   * Avoids naive string matching (e.g. rejects "pmjay.gov.in.fake.com")
   */
  public classifyHostname(hostname: string): SourceAuthorityType {
    if (!hostname) return "UNVERIFIED";

    // Explicitly rejected domains
    for (const rejected of SourceValidator.REJECTED_HOSTNAMES) {
      if (hostname === rejected || hostname.endsWith(`.${rejected}`)) {
        return "REJECTED";
      }
    }

    // Central Government exact matches
    if (SourceValidator.CENTRAL_GOVT_DOMAINS.has(hostname)) {
      return "OFFICIAL_GOVERNMENT";
    }

    // Subdomains of central domains (e.g. "abdm.nha.gov.in")
    for (const central of SourceValidator.CENTRAL_GOVT_DOMAINS) {
      if (hostname.endsWith(`.${central}`)) {
        return "OFFICIAL_GOVERNMENT";
      }
    }

    // Official Government of India Suffix (.gov.in or .nic.in)
    if (hostname.endsWith(".gov.in") || hostname.endsWith(".nic.in")) {
      // Check if it's a state health portal (e.g. "health.bihar.gov.in", "arogyasri.telangana.gov.in")
      if (
        hostname.includes("state") ||
        hostname.includes("bihar") ||
        hostname.includes("up.") ||
        hostname.includes("karnataka") ||
        hostname.includes("telangana") ||
        hostname.includes("tamilnadu") ||
        hostname.includes("arogya")
      ) {
        return "STATE_GOVERNMENT";
      }
      return "OFFICIAL_GOVERNMENT";
    }

    // Trusted Public Health Bodies (WHO, NHP)
    if (hostname === "who.int" || hostname.endsWith(".who.int")) {
      return "TRUSTED_HEALTHCARE";
    }

    return "UNVERIFIED";
  }

  /**
   * Classifies document type from title and path
   */
  public classifyDocumentType(title: string, url: string): SourceDocumentType {
    const text = `${title} ${url}`.toLowerCase();

    if (text.includes("guideline") || text.includes("operational-guidelines")) {
      return "GUIDELINE";
    }
    if (text.includes("notification") || text.includes("order")) {
      return "GOVERNMENT_NOTIFICATION";
    }
    if (text.includes("gazette") || text.includes("egazette")) {
      return "GAZETTE";
    }
    if (text.includes("faq") || text.includes("frequently-asked")) {
      return "FAQ";
    }
    if (text.includes("press-release") || text.includes("pib.gov.in")) {
      return "PRESS_RELEASE";
    }
    if (text.includes("policy") || text.includes("framework")) {
      return "POLICY_DOCUMENT";
    }
    if (url.includes("pmjay.gov.in") || url.includes("nha.gov.in")) {
      return "OFFICIAL_PORTAL";
    }

    return "UNKNOWN";
  }

  /**
   * Resolves issuing organization name
   */
  public resolveOrganization(hostname: string, title: string): string {
    if (hostname.includes("nha.gov.in") || hostname.includes("pmjay.gov.in")) {
      return "National Health Authority (NHA)";
    }
    if (hostname.includes("mohfw.gov.in")) {
      return "Ministry of Health and Family Welfare (MoHFW)";
    }
    if (hostname.includes("nhm.gov.in")) {
      return "National Health Mission (NHM)";
    }
    if (hostname.includes("uidai.gov.in")) {
      return "Unique Identification Authority of India (UIDAI)";
    }
    if (hostname.endsWith(".gov.in")) {
      return "Government of India";
    }
    return title.split("-")[0]?.trim() || "Public Source";
  }

  /**
   * Cleans and truncates excerpt
   */
  public cleanExcerpt(raw: string): string {
    if (!raw) return "";
    return raw
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 1000);
  }

  /**
   * Deterministic content hash for change detection
   */
  public computeContentHash(url: string, title: string, excerpt: string): string {
    const payload = `${url.trim().toLowerCase()}|${title.trim().toLowerCase()}|${excerpt.trim()}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private calculateAuthorityScore(type: SourceAuthorityType): number {
    switch (type) {
      case "OFFICIAL_GOVERNMENT":
        return 95;
      case "STATE_GOVERNMENT":
        return 85;
      case "OFFICIAL_PORTAL":
        return 80;
      case "TRUSTED_HEALTHCARE":
        return 60;
      case "UNVERIFIED":
        return 25;
      case "REJECTED":
        return 0;
    }
  }

  private calculateRelevanceScore(claim: string, title: string, excerpt: string): number {
    const claimTerms = claim
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (claimTerms.length === 0) return 50;

    const targetText = `${title} ${excerpt}`.toLowerCase();
    let matches = 0;

    for (const term of claimTerms) {
      if (targetText.includes(term)) {
        matches++;
      }
    }

    return Math.min(100, Math.round((matches / claimTerms.length) * 100));
  }
}
