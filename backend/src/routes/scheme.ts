import { FastifyPluginAsync } from "fastify";
import { HTTP_STATUS } from "../config/constants.js";

export const schemeRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/schemes
   * Lists all active healthcare schemes
   */
  fastify.get("/v1/schemes", async (request, reply) => {
    const correlationId = request.correlationId || "scheme-ctx";
    try {
      const schemes = await fastify.schemeService.getActiveSchemes();
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          schemes,
          count: schemes.length,
        },
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      request.log.error({ err, correlationId }, "Failed to list active schemes");
      return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: "InternalServerError",
        message: "Failed to retrieve healthcare schemes.",
        code: "SCHEMES_LIST_FAILED",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/v1/schemes/:schemeId
   * Retrieves a specific healthcare scheme with its active version details
   */
  fastify.get<{ Params: { schemeId: string } }>(
    "/v1/schemes/:schemeId",
    async (request, reply) => {
      const correlationId = request.correlationId || "scheme-ctx";
      const { schemeId } = request.params;

      try {
        const result = await fastify.schemeService.getSchemeWithActiveVersion(schemeId);

        if (!result) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            error: "NotFound",
            message: `Healthcare scheme '${schemeId}' not found.`,
            code: "SCHEME_NOT_FOUND",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            scheme: result.scheme,
            activeVersion: result.version,
          },
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        request.log.error({ err, correlationId, schemeId }, "Failed to get scheme details");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "InternalServerError",
          message: "Failed to retrieve scheme details.",
          code: "SCHEME_GET_FAILED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
