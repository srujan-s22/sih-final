import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

export interface GeminiGenerateOptions {
  systemInstruction?: string;
  contents: Array<{
    role: "user" | "model" | "assistant";
    text: string;
  }>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export class GeminiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "GEMINI_UNCONFIGURED" | "GEMINI_TIMEOUT" | "GEMINI_RATE_LIMITED" | "GEMINI_API_ERROR" | "GEMINI_INVALID_RESPONSE",
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "GeminiProviderError";
  }
}

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private apiKey?: string;
  private defaultModel: string;
  private defaultTimeoutMs: number;
  private defaultMaxTokens: number;

  constructor(
    apiKey?: string,
    model?: string,
    timeoutMs?: number,
    maxTokens?: number
  ) {
    this.apiKey = apiKey ?? env.GEMINI_API_KEY;
    this.defaultModel = model ?? env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.defaultTimeoutMs = timeoutMs ?? env.GEMINI_TIMEOUT_MS ?? 15000;
    this.defaultMaxTokens = maxTokens ?? env.GEMINI_MAX_OUTPUT_TOKENS ?? 2048;

    if (this.apiKey && this.apiKey.trim().length > 0) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey.trim() });
      } catch (err) {
        console.warn("Failed to initialize Google Gen AI client:", err);
        this.client = null;
      }
    }
  }

  /**
   * Returns whether a valid Gemini API key is configured.
   */
  public isConfigured(): boolean {
    return Boolean(this.client && this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Returns current configured model identifier
   */
  public getModelName(): string {
    return this.defaultModel;
  }

  /**
   * Generates a conversational response with timeout and error handling.
   * STRICT FAIL-CLOSED: If unconfigured, throws GEMINI_UNCONFIGURED.
   */
  public async generateContent(options: GeminiGenerateOptions): Promise<string> {
    if (!this.isConfigured() || !this.client) {
      throw new GeminiProviderError(
        "The conversational assistant is currently unavailable. Please try again later.",
        "GEMINI_UNCONFIGURED",
        503
      );
    }

    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const model = this.defaultModel;

    // Map conversation contents to Google Gen AI format
    const formattedContents = options.contents.map((c) => ({
      role: c.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: c.text }],
    }));

    try {
      const generatePromise = this.client.models.generateContent({
        model,
        contents: formattedContents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxOutputTokens ?? this.defaultMaxTokens,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(
            new GeminiProviderError(
              "Assistant response timed out. Please try asking again.",
              "GEMINI_TIMEOUT",
              504
            )
          );
        }, timeoutMs);
        if (typeof timer === "object" && "unref" in timer) {
          timer.unref();
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response.text;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        throw new GeminiProviderError(
          "Received empty response from assistant service.",
          "GEMINI_INVALID_RESPONSE",
          502
        );
      }

      return text.trim();
    } catch (err: unknown) {
      if (err instanceof GeminiProviderError) {
        throw err;
      }

      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit")) {
        throw new GeminiProviderError(
          "Assistant request quota exceeded. Please wait a moment before trying again.",
          "GEMINI_RATE_LIMITED",
          429
        );
      }

      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.toLowerCase().includes("api key")) {
        throw new GeminiProviderError(
          "The conversational assistant is currently unavailable.",
          "GEMINI_UNCONFIGURED",
          503
        );
      }

      throw new GeminiProviderError(
        "Assistant service error. Please try again shortly.",
        "GEMINI_API_ERROR",
        502
      );
    }
  }
}
