import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";

export const guidanceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/guidance/me
   * Evaluates comprehensive citizen healthcare access guidance, detected gaps,
   * document readiness, and prioritized action plans.
   */
  fastify.get(
    "/v1/guidance/me",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const uid = request.user!.uid;
      const correlationId = request.correlationId || "guidance-ctx";

      try {
        const guidance = await fastify.guidanceService.getCitizenGuidance(uid);

        request.log.info(
          {
            correlationId,
            householdStatus: guidance.householdStatus,
            gapsCount: guidance.gaps.length,
            actionsCount: guidance.actionPlan.length,
            evaluatedSchemesCount: guidance.evaluatedSchemesCount,
          },
          "Citizen healthcare guidance evaluated successfully"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: guidance,
        });
      } catch (err: unknown) {
        request.log.error(
          { correlationId, err },
          "Failed to evaluate citizen healthcare guidance"
        );

        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "GUIDANCE_EVALUATION_FAILED",
          message: "An unexpected error occurred while evaluating healthcare guidance.",
        });
      }
    }
  );
};
