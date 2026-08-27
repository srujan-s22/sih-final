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
