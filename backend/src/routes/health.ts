import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { HealthCheckResponse } from "../../../shared/types/api.js";
import { APP_NAME, APP_VERSION } from "../config/constants.js";
import { env } from "../config/env.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const fbStatus = fastify.firebaseStatus;
    const fbIndicator = fbStatus.initialized ? "operational" : "unconfigured_foundation";

    const response: HealthCheckResponse = {
      status: "ok",
      app: APP_NAME,
      version: APP_VERSION,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      correlation_id: request.correlationId,
      services: {
        api: "operational",
        firebase: fbIndicator,
      },
    };

    return reply.status(200).send(response);
  };

  // Direct health route: /health (when mounted at /api, resolves to /api/health)
  fastify.get("/health", handler);

  // Versioned route: /v1/health
  fastify.get("/v1/health", handler);
};
