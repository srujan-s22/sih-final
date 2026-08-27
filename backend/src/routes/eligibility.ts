import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";

export const eligibilityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/eligibility/me
   * Evaluates the authenticated citizen's household and family members
   * against all active healthcare schemes using the deterministic rule engine.
   */
  fastify.get(
    "/v1/eligibility/me",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "eligibility-ctx";
      const uid = request.user!.uid;

      try {
        const evaluation = await fastify.eligibilityService.evaluateCitizenHousehold(uid);

        if (!evaluation.household) {
          return reply.status(HTTP_STATUS.OK).send({
            success: true,
            data: {
              hasHousehold: false,
              household: null,
              members: [],
              results: [],
              count: 0,
            },
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            hasHousehold: true,
            household: evaluation.household,
            members: evaluation.members,
            results: evaluation.results,
            count: evaluation.results.length,
          },
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        request.log.error({ err, correlationId, uid }, "Failed to evaluate household eligibility");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "InternalServerError",
          message: "Failed to evaluate healthcare eligibility.",
          code: "ELIGIBILITY_EVALUATION_FAILED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * GET /api/v1/eligibility/me/:schemeId
   * Evaluates the citizen's household against a specific healthcare scheme.
   */
  fastify.get<{ Params: { schemeId: string } }>(
    "/v1/eligibility/me/:schemeId",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "eligibility-ctx";
      const uid = request.user!.uid;
      const { schemeId } = request.params;

      try {
        const household = await fastify.householdRepository.getHouseholdByOwnerUid(uid);

        if (!household) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            error: "NotFound",
            message: "Household profile not found. Please set up your household first.",
            code: "HOUSEHOLD_NOT_FOUND",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        const members = await fastify.householdRepository.getMembers(household.id);
        const result = await fastify.eligibilityService.evaluateHouseholdForScheme(
          schemeId,
          household,
          members
        );

        if (!result) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            error: "NotFound",
            message: `Healthcare scheme '${schemeId}' not found or has no active version.`,
            code: "SCHEME_NOT_FOUND",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            result,
          },
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        request.log.error(
          { err, correlationId, uid, schemeId },
          "Failed to evaluate single scheme eligibility"
        );
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "InternalServerError",
          message: "Failed to evaluate scheme eligibility.",
          code: "SCHEME_EVALUATION_FAILED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
