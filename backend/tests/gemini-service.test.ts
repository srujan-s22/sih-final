import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiService, GeminiProviderError } from "../src/services/ai/gemini.service.js";

describe("Phase 8: GeminiService Unit Tests", () => {
  it("reports unconfigured when API key is missing or empty", () => {
    const serviceEmpty = new GeminiService("");
    expect(serviceEmpty.isConfigured()).toBe(false);

    const serviceWhitespace = new GeminiService("   ");
    expect(serviceWhitespace.isConfigured()).toBe(false);

    const serviceUndefined = new GeminiService(undefined);
    // If process.env.GEMINI_API_KEY is not set
    if (!process.env.GEMINI_API_KEY) {
      expect(serviceUndefined.isConfigured()).toBe(false);
    }
  });

  it("reports configured when a non-empty API key is provided", () => {
    const service = new GeminiService("test-gemini-key-2026");
    expect(service.isConfigured()).toBe(true);
    expect(service.getModelName()).toBe("gemini-3.6-flash");
  });

  it("fails closed with 503 GEMINI_UNCONFIGURED when generateContent is called without API key", async () => {
    const service = new GeminiService("");
    expect(service.isConfigured()).toBe(false);

    await expect(
      service.generateContent({
        systemInstruction: "You are a healthcare assistant.",
        contents: [{ role: "user", text: "What is PM-JAY?" }],
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "GEMINI_UNCONFIGURED",
        statusCode: 503,
      })
    );
  });

  it("handles timeout safely and throws 504 GEMINI_TIMEOUT", async () => {
    const service = new GeminiService("mock-key-for-timeout");

    // Mock client to hang indefinitely
    (service as any).client = {
      models: {
        generateContent: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        ),
      },
    };

    await expect(
      service.generateContent({
        contents: [{ role: "user", text: "Hello" }],
        timeoutMs: 50, // Short timeout for test
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "GEMINI_TIMEOUT",
        statusCode: 504,
      })
    );
  });

  it("maps rate-limit and quota errors to 429 GEMINI_RATE_LIMITED", async () => {
    const service = new GeminiService("mock-key");

    (service as any).client = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("Resource has been exhausted (e.g. check quota, rate limit 429)")),
      },
    };

    await expect(
      service.generateContent({
        contents: [{ role: "user", text: "Test query" }],
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "GEMINI_RATE_LIMITED",
        statusCode: 429,
      })
    );
  });

  it("successfully returns generated text on valid response", async () => {
    const service = new GeminiService("mock-key");

    (service as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: "Ayushman Bharat PM-JAY provides up to Rs. 5 Lakh coverage per family per year.",
        }),
      },
    };

    const reply = await service.generateContent({
      systemInstruction: "You are SwasthyaSetu Assistant.",
      contents: [{ role: "user", text: "What is PM-JAY benefit?" }],
    });

    expect(reply).toBe("Ayushman Bharat PM-JAY provides up to Rs. 5 Lakh coverage per family per year.");
  });
});
