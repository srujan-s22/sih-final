import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import { AssistantChatRequestSchema } from "../../../shared/schemas/assistant.schema.js";
import { GeminiProviderError } from "../services/ai/gemini.service.js";
import { AssistantServiceError } from "../services/ai/assistant.service.js";

export const assistantRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/assistant/status
   * Checks assistant availability and configured models for authenticated user.
   */
  fastify.get(
    "/v1/assistant/status",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const role = request.userProfile?.role || "CITIZEN";
      const status = fastify.assistantService.getStatus(role);

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: status,
      });
    }
  );

  /**
   * POST /api/v1/assistant/chat
   * Core conversational assistant endpoint grounded in deterministic eligibility and verified evidence.
   */
  fastify.post(
    "/v1/assistant/chat",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userUid = request.user!.uid;
      const userRole = request.userProfile?.role || "CITIZEN";
      const correlationId = request.correlationId || "assistant-chat-ctx";

      const parsed = AssistantChatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: "Invalid assistant request parameters.",
          details: parsed.error.format(),
        });
      }

      try {
        const response = await fastify.assistantService.chat({
          authenticatedUserUid: userUid,
          userRole,
          request: parsed.data,
          clientIp: request.ip,
        });

        request.log.info(
          {
            correlationId,
            userRole,
            language: parsed.data.language,
            conversationId: response.conversationId,
            evaluatedSchemes: response.groundingData.evaluatedSchemesCount,
            citedEvidenceCount: response.groundingData.citedEvidence.length,
          },
          "Assistant message processed successfully"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: response,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, err }, "Assistant chat generation failed");

        if (err instanceof GeminiProviderError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }

        if (err instanceof AssistantServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }

        const msg = err instanceof Error ? err.message : "Assistant request could not be processed.";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "ASSISTANT_ERROR",
          message: msg,
        });
      }
    }
  );
};
