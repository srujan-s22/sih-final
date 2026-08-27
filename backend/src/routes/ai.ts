import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import { AIIntelligenceRequestSchema } from "../../../shared/schemas/ai.schema.js";

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/ai/intelligence
   * Citizen & ASHA AI intelligence generation endpoint.
   * Derives context strictly from the authenticated user's own authorized household.
   */
  fastify.post(
    "/v1/ai/intelligence",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userUid = request.user!.uid;
      const correlationId = request.correlationId || "ai-intelligence-ctx";

      const parsed = AIIntelligenceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: "Invalid AI intelligence request parameters.",
          details: parsed.error.format(),
        });
      }

      try {
        const result = await fastify.intelligenceService.generateIntelligence(
          userUid,
          parsed.data
        );

        request.log.info(
          {
            correlationId,
            capability: parsed.data.capability,
            language: parsed.data.language,
            certainty: result.certainty,
            cacheHit: result.cacheHit,
          },
          "Generated AI intelligence response"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, err }, "AI intelligence generation failed");

        const msg = err instanceof Error ? err.message : "AI intelligence generation failed.";
        let code = "AI_GENERATION_FAILED";
        let status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;

        if (msg.includes("AI_PROVIDER_UNCONFIGURED")) {
          code = "AI_PROVIDER_UNCONFIGURED";
          status = 503;
        } else if (msg.includes("AI_PROVIDER_TIMEOUT")) {
          code = "AI_PROVIDER_TIMEOUT";
          status = 504;
        } else if (msg.includes("AI_PROVIDER_RATE_LIMITED")) {
          code = "AI_PROVIDER_RATE_LIMITED";
          status = 429;
        } else if (msg.includes("AI_INVALID_RESPONSE")) {
          code = "AI_INVALID_RESPONSE";
          status = 502;
        }

        return reply.status(status).send({
          success: false,
          code,
          message: msg,
        });
      }
    }
  );
};
