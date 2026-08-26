import { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Register health routes under /api
  await fastify.register(healthRoutes);
};
