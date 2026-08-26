import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import * as admin from "firebase-admin";

declare module "fastify" {
  interface FastifyRequest {
    user: admin.auth.DecodedIdToken | null;
  }
}

/**
 * Authentication foundation plugin.
 * Provides the hook structure for Phase 2 JWT / Firebase ID token verification.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  // Decorate fastify with an auth verification helper
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          error: "Unauthorized",
          message: "Authorization Bearer token required.",
          code: "AUTH_TOKEN_MISSING",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      const token = authHeader.split("Bearer ")[1]?.trim();
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: "Unauthorized",
          message: "Malformed Bearer token.",
          code: "AUTH_TOKEN_INVALID",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      if (!fastify.firebaseApp) {
        return reply.status(503).send({
          success: false,
          error: "ServiceUnavailable",
          message: "Authentication service not configured.",
          code: "AUTH_SERVICE_UNAVAILABLE",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const decodedToken = await admin.auth(fastify.firebaseApp).verifyIdToken(token);
        request.user = decodedToken;
      } catch (err: unknown) {
        request.log.warn({ err, correlationId: request.correlationId }, "Token verification failed");
        return reply.status(401).send({
          success: false,
          error: "Unauthorized",
          message: "Invalid or expired authentication token.",
          code: "AUTH_TOKEN_EXPIRED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};

export default fp(authPlugin, {
  name: "auth-plugin",
  dependencies: ["firebase-plugin"],
});
