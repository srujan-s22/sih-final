import { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";
import { authRoutes } from "./auth.js";
import { testAuthRoutes } from "./test-auth.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Register health routes
  await fastify.register(healthRoutes);

  // Register authentication & consent routes
  await fastify.register(authRoutes);

  // Register authorization verification test routes
  await fastify.register(testAuthRoutes);
};
