import { env } from "../../config/env.js";
import { EvidenceCandidate } from "../../../../shared/types/evidence.js";

export interface TavilySearchOptions {
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export class TavilyService {
  private static readonly API_ENDPOINT = "https://api.tavily.com/search";

  private static readonly OFFICIAL_HEALTH_DOMAINS = [
    "pmjay.gov.in",
    "nha.gov.in",
    "mohfw.gov.in",
    "nhm.gov.in",
    "india.gov.in",
    "uidai.gov.in",
    "pib.gov.in",
  ];

  constructor(private apiKey?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : env.TAVILY_API_KEY;
  }

  /**
   * Normalizes a search query and verifies that it is clean of citizen PII
   */
  public normalizeQuery(rawQuery: string): string {
    const normalized = rawQuery
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    this.assertNoPii(normalized);
    return normalized;
  }

  /**
   * Strict PII check: Rejects search if citizen PII patterns are found
   */
  public assertNoPii(query: string): void {
    // 1. Email pattern
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(query)) {
      throw new Error("EVIDENCE_PII_REJECTED: Search query contains email address");
    }

    // 2. 10-digit mobile number pattern
    if (/(?:\+91|0)?[6-9]\d{9}/.test(query)) {
      throw new Error("EVIDENCE_PII_REJECTED: Search query contains phone number");
    }

    // 3. 12-digit Aadhaar / Ration card pattern
    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(query) || /\bRC-[A-Z0-9-]{6,}\b/i.test(query)) {
      throw new Error("EVIDENCE_PII_REJECTED: Search query contains identity card / ration card number");
    }
  }

  /**
   * Executes controlled search query against Tavily official REST API
   */
  public async search(
    query: string,
    options: TavilySearchOptions = {}
  ): Promise<EvidenceCandidate[]> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new Error("EVIDENCE_PROVIDER_UNCONFIGURED: TAVILY_API_KEY is not configured.");
    }

    const normalizedQuery = this.normalizeQuery(query);
    const maxResults = options.maxResults || env.EVIDENCE_MAX_SEARCH_RESULTS || 3;
    const searchDepth = options.searchDepth || "basic";
    const includeDomains = options.includeDomains || TavilyService.OFFICIAL_HEALTH_DOMAINS;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, env.EVIDENCE_REQUEST_TIMEOUT_MS || 10000);

    try {
      const response = await fetch(TavilyService.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: normalizedQuery,
          search_depth: searchDepth,
          include_domains: includeDomains,
          exclude_domains: options.excludeDomains || [],
          max_results: maxResults,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("EVIDENCE_RATE_LIMITED: Tavily search rate limit exceeded.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("EVIDENCE_PROVIDER_AUTH_FAILED: Invalid Tavily API key.");
        }
        const errText = await response.text();
        throw new Error(`EVIDENCE_SEARCH_FAILED: Provider returned HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        results?: Array<{
          url: string;
          title: string;
          content: string;
          score?: number;
          published_date?: string;
        }>;
      };

      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((r) => {
        let hostname = "";
        try {
          hostname = new URL(r.url).hostname.toLowerCase();
        } catch {
          hostname = "unknown";
        }

        return {
          url: r.url,
          title: r.title || "Official Document",
          content: r.content || "",
          score: typeof r.score === "number" ? r.score : undefined,
          publishedDate: r.published_date,
          rawHostname: hostname,
        };
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("EVIDENCE_TIMEOUT: Search provider request timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
