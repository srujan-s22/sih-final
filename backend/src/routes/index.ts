import { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";
import { authRoutes } from "./auth.js";
import { householdRoutes } from "./household.js";
import { testAuthRoutes } from "./test-auth.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Register health routes
  await fastify.register(healthRoutes);

  // Register authentication & consent routes
  await fastify.register(authRoutes);

  // Register household & member management routes
  await fastify.register(householdRoutes);

  // Register authorization verification test routes
  await fastify.register(testAuthRoutes);
};
