import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),
  HOST: z.string().default("0.0.0.0"),
  API_BASE_PATH: z.string().default("/api"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  
  // Server-Side Firebase Admin Configuration
  FIREBASE_PROJECT_ID: z.string().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_CREDENTIALS_PATH: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Phase 6 Evidence & Tavily Integration (Server-Side Only)
  TAVILY_API_KEY: z.string().optional(),
  EVIDENCE_CACHE_TTL_HOURS: z.coerce.number().default(72),
  EVIDENCE_MAX_SEARCH_RESULTS: z.coerce.number().default(3),
  EVIDENCE_REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),

  // Phase 7 Lyzr AI Intelligence Layer (Server-Side Only)
  LYZR_API_KEY: z.string().optional(),
  LYZR_API_URL: z.string().default("https://agent-prod.studio.lyzr.ai/v3/inference/chat/"),
  LYZR_AGENT_ID: z.string().default("swasthyasetu-intelligence-agent"),
  LYZR_TIMEOUT_MS: z.coerce.number().default(15000),
  LYZR_ANONYMIZATION_SECRET: z.string().default("swasthyasetu-default-anon-secret-key-2026"),
  AI_CACHE_TTL_HOURS: z.coerce.number().default(24),

  // Privileged Staff/Admin Account Provisioning (Server-Side Only)
  ASHA_REGISTRATION_SECRET_HASH: z.string().optional(),
  ADMIN_REGISTRATION_SECRET_HASH: z.string().optional(),

  // Phase 8 Gemini Conversational Assistant (Server-Side Only)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_TIMEOUT_MS: z.coerce.number().default(45000),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().default(2048),

  // Phase 10 n8n Automation & Webhooks
  N8N_WEBHOOK_URL: z.string().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),

  // Phase 11 Sarvam AI + Exotel Voice / Call Assist (Server-Side Only)
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_BASE_URL: z.string().default("https://api.sarvam.ai"),
  SARVAM_MODEL: z.string().default("saaras:v3"),
  SARVAM_TTS_MODEL: z.string().default("bulbul:v3"),
  SARVAM_TTS_SPEAKER: z.string().default("shubh"),
  SARVAM_TIMEOUT_MS: z.coerce.number().default(10000),
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  EXOTEL_BASE_URL: z.string().default("https://api.exotel.com"),
  EXOTEL_VIRTUAL_NUMBER: z.string().optional(),
  EXOTEL_CALLER_ID: z.string().optional(),
  VOICE_ENABLED: z.coerce.boolean().default(true),
  VOICE_LANGUAGE: z.string().default("en-IN"),
  VOICE_PROVIDER_MODE: z.enum(["real", "test", "mock"]).default("real"),
  VOICE_MAX_TURNS: z.coerce.number().default(10),
  VOICE_MAX_CALL_DURATION_SEC: z.coerce.number().default(300),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error("Invalid environment configuration.");
  }
  return result.data;
}

export const env = parseEnv();
