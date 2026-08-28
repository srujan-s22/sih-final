import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  AshaServiceCodeSchema,
  CreateConnectionRequestSchema,
  ConnectionActionSchema,
} from "../../../shared/schemas/connection.schema.js";
import { ConnectionServiceError } from "../services/connection.service.js";

export const connectionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/asha/directory/:serviceCode
   * Resolves safe public identity information for an ASHA worker.
   * STRICT SECURITY INVARIANT: Never returns UID, email, phone number, or secrets.
   */
  fastify.get(
    "/v1/asha/directory/:serviceCode",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const { serviceCode } = request.params as { serviceCode: string };

      const parsed = AshaServiceCodeSchema.safeParse(serviceCode);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_SERVICE_CODE",
          message: "Invalid ASHA service code format. Expected format like ASHA-KA-7K42.",
        });
      }

      try {
        const info = await fastify.connectionService.resolveAshaServiceCode(parsed.data);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: info,
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to resolve ASHA service code.",
        });
      }
    }
  );

  /**
   * POST /api/v1/citizen/asha-connection/request
   * Citizen creates a connection request for their household to connect with an ASHA worker.
   */
  fastify.post(
    "/v1/citizen/asha-connection/request",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userProfile = request.userProfile!;

      const parsed = CreateConnectionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: "Invalid connection request payload.",
          details: parsed.error.format(),
        });
      }

      try {
        const conn = await fastify.connectionService.requestConnection(
          userProfile,
          parsed.data.serviceCode,
          parsed.data.notes
        );

        request.log.info(
          {
            correlationId: request.correlationId,
            requestId: conn.id,
            citizenUid: userProfile.uid,
            householdId: conn.householdId,
            ashaUid: conn.ashaUid,
          },
          "Citizen created ASHA connection request"
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: conn,
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to create connection request.",
        });
      }
    }
  );

  /**
   * GET /api/v1/citizen/asha-connection
   * Retrieves current connection status for authenticated Citizen's household.
   */
  fastify.get(
    "/v1/citizen/asha-connection",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userProfile = request.userProfile!;

      try {
        const status = await fastify.connectionService.getCitizenConnectionStatus(userProfile);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: status,
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve connection status.",
        });
      }
    }
  );

  /**
   * GET /api/v1/asha/connection-requests
   * Lists all pending connection requests addressed to the authenticated ASHA worker.
   */
  fastify.get(
    "/v1/asha/connection-requests",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userProfile = request.userProfile!;

      try {
        const requests = await fastify.connectionService.listPendingRequestsForAsha(userProfile);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { requests },
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to list connection requests.",
        });
      }
    }
  );

  /**
   * POST /api/v1/asha/connection-requests/:requestId/accept
   * ASHA accepts a connection request -> transitions to ACTIVE and integrates with Phase 9 AshaCase.
   */
  fastify.post(
    "/v1/asha/connection-requests/:requestId/accept",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userProfile = request.userProfile!;
      const { requestId } = request.params as { requestId: string };

      const parsed = ConnectionActionSchema.safeParse(request.body || {});
      const note = parsed.success ? parsed.data.note : undefined;

      try {
        const updated = await fastify.connectionService.acceptConnectionRequest(
          requestId,
          userProfile,
          note
        );

        request.log.info(
          {
            correlationId: request.correlationId,
            requestId,
            ashaUid: userProfile.uid,
            householdId: updated.householdId,
          },
          "ASHA accepted connection request"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: updated,
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to accept connection request.",
        });
      }
    }
  );

  /**
   * POST /api/v1/asha/connection-requests/:requestId/reject
   * ASHA rejects a connection request -> transitions to REJECTED.
   */
  fastify.post(
    "/v1/asha/connection-requests/:requestId/reject",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const userProfile = request.userProfile!;
      const { requestId } = request.params as { requestId: string };

      const parsed = ConnectionActionSchema.safeParse(request.body || {});
      const note = parsed.success ? parsed.data.note : undefined;

      try {
        const updated = await fastify.connectionService.rejectConnectionRequest(
          requestId,
          userProfile,
          note
        );

        request.log.info(
          {
            correlationId: request.correlationId,
            requestId,
            ashaUid: userProfile.uid,
            householdId: updated.householdId,
          },
          "ASHA rejected connection request"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: updated,
        });
      } catch (err: unknown) {
        if (err instanceof ConnectionServiceError) {
          return reply.status(err.statusCode).send({
            success: false,
            code: err.code,
            message: err.message,
          });
        }
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "INTERNAL_ERROR",
          message: "Failed to reject connection request.",
        });
      }
    }
  );
};
