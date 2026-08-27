import { env } from "../../config/env.js";
import {
  AIIntelligenceResponse,
} from "../../../../shared/types/ai.js";
import { AIIntelligenceResponseSchema } from "../../../../shared/schemas/ai.schema.js";

export interface LyzrServiceConfig {
  apiKey?: string;
  apiUrl?: string;
  agentId?: string;
  timeoutMs?: number;
}

export class LyzrService {
  private apiKey: string;
  private apiUrl: string;
  private agentId: string;
  private timeoutMs: number;

  constructor(config: LyzrServiceConfig = {}) {
    this.apiKey = config.apiKey !== undefined ? config.apiKey : (env.LYZR_API_KEY || "");
    this.apiUrl = config.apiUrl || env.LYZR_API_URL || "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";
    this.agentId = config.agentId || env.LYZR_AGENT_ID || "swasthyasetu-intelligence-agent";
    this.timeoutMs = config.timeoutMs || env.LYZR_TIMEOUT_MS || 15000;
  }

  /**
   * Generates intelligence from Lyzr Agent REST API
   */
  public async generateIntelligence(
    prompt: string,
    anonymousUserId: string,
    sessionId?: string
  ): Promise<AIIntelligenceResponse> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new Error("AI_PROVIDER_UNCONFIGURED: LYZR_API_KEY is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const generatedSessionId =
      sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          user_id: anonymousUserId,
          agent_id: this.agentId,
          session_id: generatedSessionId,
          message: prompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("AI_PROVIDER_RATE_LIMITED: Lyzr rate limit exceeded.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("AI_PROVIDER_AUTH_FAILED: Lyzr API authentication failed.");
        }
        const errText = await response.text();
        throw new Error(`AI_PROVIDER_UNAVAILABLE: Lyzr API returned HTTP ${response.status}: ${errText}`);
      }

      const rawData = await response.json();
      const rawText = this.extractRawResponseText(rawData);

      // Parse JSON from response
      const parsedJson = this.extractAndParseJson(rawText);

      // Strict Zod schema validation
      const validated = AIIntelligenceResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new Error(
          `AI_INVALID_RESPONSE: Lyzr response failed schema validation. Details: ${JSON.stringify(
            validated.error.format()
          )}`
        );
      }

      return validated.data as AIIntelligenceResponse;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("AI_PROVIDER_TIMEOUT: Lyzr request timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Safely extracts text payload from varying API response formats
   */
  private extractRawResponseText(data: unknown): string {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (typeof record.response === "string") return record.response;
      if (typeof record.message === "string") return record.message;
      if (typeof record.data === "string") return record.data;
      if (typeof record.result === "string") return record.result;
      return JSON.stringify(data);
    }
    return String(data);
  }

  /**
   * Extracts clean JSON substring (handling markdown fences or leading/trailing text)
   */
  public extractAndParseJson(text: string): unknown {
    let clean = text.trim();

    // Strip markdown code fences if present
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    clean = clean.trim();

    // Find opening and closing braces
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = clean.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (err) {
        throw new Error(`AI_INVALID_RESPONSE: Failed to parse JSON response: ${clean}`);
      }
    }

    try {
      return JSON.parse(clean);
    } catch {
      throw new Error(`AI_INVALID_RESPONSE: Lyzr output did not contain valid JSON: ${clean}`);
    }
  }
}
