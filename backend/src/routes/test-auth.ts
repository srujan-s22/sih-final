import { FastifyPluginAsync } from "fastify";
import { requireRole, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";

export const testAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/test/citizen-only
   * Accessible only by CITIZEN users who have accepted active consent
   */
  fastify.get(
    "/v1/test/citizen-only",
    { preHandler: [requireRole(["CITIZEN"]), requireConsent] },
    async (request, reply) => {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        message: "Citizen resource access granted.",
        role: request.userProfile?.role,
        uid: request.userProfile?.uid,
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * GET /api/v1/test/asha-only
   * Accessible only by ASHA users who have accepted active consent
   */
  fastify.get(
    "/v1/test/asha-only",
    { preHandler: [requireRole(["ASHA"]), requireConsent] },
    async (request, reply) => {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        message: "ASHA resource access granted.",
        role: request.userProfile?.role,
        uid: request.userProfile?.uid,
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * GET /api/v1/test/admin-only
   * Accessible strictly by ADMIN users
   */
  fastify.get(
    "/v1/test/admin-only",
    { preHandler: [requireRole(["ADMIN"])] },
    async (request, reply) => {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        message: "Admin resource access granted.",
        role: request.userProfile?.role,
        uid: request.userProfile?.uid,
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * GET /api/v1/test/asha-or-admin
   * Accessible by ASHA or ADMIN users
   */
  fastify.get(
    "/v1/test/asha-or-admin",
    { preHandler: [requireRole(["ASHA", "ADMIN"])] },
    async (request, reply) => {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        message: "Privileged staff access granted.",
        role: request.userProfile?.role,
        uid: request.userProfile?.uid,
        correlation_id: request.correlationId,
      });
    }
  );
};
