import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  CreateAssistanceRequestSchema,
  UpdateAssistanceRequestSchema,
} from "../../../shared/schemas/assistance.schema.js";
import { AssistanceServiceError } from "../services/assistance.service.js";

export const assistanceRoutes: FastifyPluginAsync = async (fastify) => {
  const handleAssistanceError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof AssistanceServiceError) {
      return reply.status(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    fastify.log.error(error);
    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "An error occurred while processing the assistance request.",
    });
  };

  /**
   * POST /api/v1/citizen/assistance/request
   * Citizen creates an assistance request for their connected ASHA worker.
   */
  fastify.post(
    "/v1/citizen/assistance/request",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userProfile = request.userProfile!;

      const parsed = CreateAssistanceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: parseResultError(parsed.error),
          details: parsed.error.format(),
        });
      }

      try {
        const result = await fastify.assistanceService.createAssistanceRequest(
          userProfile,
          parsed.data
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: result,
        });
      } catch (err) {
        return handleAssistanceError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/citizen/assistance
   * Citizen retrieves their submitted assistance requests.
   */
  fastify.get(
    "/v1/citizen/assistance",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userProfile = request.userProfile!;

      try {
        const requests = await fastify.assistanceService.listCitizenAssistanceRequests(
          userProfile
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { requests },
        });
      } catch (err) {
        return handleAssistanceError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/assistance-requests
   * ASHA lists incoming assistance requests from connected households.
   */
  fastify.get(
    "/v1/asha/assistance-requests",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userProfile = request.userProfile!;
      const query = request.query as { status?: any };

      try {
        const requests = await fastify.assistanceService.listAshaAssistanceRequests(
          userProfile,
          query?.status
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { requests },
        });
      } catch (err) {
        return handleAssistanceError(err, reply);
      }
    }
  );

  /**
   * PATCH /api/v1/asha/assistance-requests/:requestId
   * ASHA updates the status or response note of an assistance request.
   */
  fastify.patch(
    "/v1/asha/assistance-requests/:requestId",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userProfile = request.userProfile!;
      const { requestId } = request.params as { requestId: string };

      const parsed = UpdateAssistanceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: parseResultError(parsed.error),
          details: parsed.error.format(),
        });
      }

      try {
        const updated = await fastify.assistanceService.updateAssistanceRequest(
          requestId,
          userProfile,
          parsed.data
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: updated,
        });
      } catch (err) {
        return handleAssistanceError(err, reply);
      }
    }
  );
};

function parseResultError(error: any): string {
  if (error && error.errors && error.errors.length > 0) {
    return error.errors[0].message || "Validation failed";
  }
  return "Invalid payload";
}
