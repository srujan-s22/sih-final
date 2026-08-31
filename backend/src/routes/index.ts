import { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";
import { authRoutes } from "./auth.js";
import { householdRoutes } from "./household.js";
import { schemeRoutes } from "./scheme.js";
import { eligibilityRoutes } from "./eligibility.js";
import { guidanceRoutes } from "./guidance.js";
import { evidenceRoutes } from "./evidence.js";
import { aiRoutes } from "./ai.js";
import { assistantRoutes } from "./assistant.js";
import { caseRoutes } from "./case.js";
import { connectionRoutes } from "./connection.js";
import { assistanceRoutes } from "./assistance.js";
import { voiceRoutes } from "./voice.js";
import { testAuthRoutes } from "./test-auth.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Register health routes
  await fastify.register(healthRoutes);

  // Register authentication & consent routes
  await fastify.register(authRoutes);

  // Register household & member management routes
  await fastify.register(householdRoutes);

  // Register scheme registry routes
  await fastify.register(schemeRoutes);

  // Register deterministic eligibility evaluation routes
  await fastify.register(eligibilityRoutes);

  // Register healthcare access guidance & action plan routes
  await fastify.register(guidanceRoutes);

  // Register evidence & Tavily provenance routes
  await fastify.register(evidenceRoutes);

  // Register Lyzr AI intelligence routes
  await fastify.register(aiRoutes);

  // Register Gemini conversational assistant routes
  await fastify.register(assistantRoutes);

  // Register ASHA case management and Admin assignment routes
  await fastify.register(caseRoutes);

  // Register Citizen <-> ASHA connection routes
  await fastify.register(connectionRoutes);

  // Register Citizen <-> ASHA assistance request routes
  await fastify.register(assistanceRoutes);

  // Register Voice & Telephony routes (Phase 11)
  await fastify.register(voiceRoutes);

  // Register authorization verification test routes
  await fastify.register(testAuthRoutes);
};

