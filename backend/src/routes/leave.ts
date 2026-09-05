import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireConsent, requireRole } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  CreateLeaveRequestSchema,
  ApproveLeaveRequestSchema,
  RejectLeaveRequestSchema,
} from "../../../shared/schemas/leave.schema.js";
import { LeaveServiceError } from "../services/leave.service.js";

export const leaveRoutes: FastifyPluginAsync = async (fastify) => {
  const handleLeaveError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof LeaveServiceError) {
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
      message: "An error occurred while processing the leave request.",
    });
  };

  // ============================================================================
  // ASHA WORKER LEAVE ENDPOINTS (/api/v1/asha/leave-requests)
  // ============================================================================

  /**
   * POST /api/v1/asha/leave-requests
   * ASHA submits a new leave request.
   */
  fastify.post(
    "/v1/asha/leave-requests",
    { preHandler: [requireRole(["ASHA"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parseResult = CreateLeaveRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid leave request payload.",
            errors: parseResult.error.errors,
          });
        }

        const leaveRequest = await fastify.leaveService.createLeaveRequest(
          request.userProfile!,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: { leaveRequest },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/leave-requests
   * Lists leave requests submitted by the authenticated ASHA worker.
   */
  fastify.get(
    "/v1/asha/leave-requests",
    { preHandler: [requireRole(["ASHA"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const leaveRequests = await fastify.leaveService.listMyLeaveRequests(request.userProfile!);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { leaveRequests },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/leave-requests/:id
   * Retrieves single leave request (enforces IDOR: ASHA can only view own; Admin can view any).
   */
  fastify.get(
    "/v1/asha/leave-requests/:id",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const leaveRequest = await fastify.leaveService.getLeaveRequestById(id, request.userProfile!);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { leaveRequest },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/leave-requests/:id/cancel
   * ASHA cancels their own pending leave request.
   */
  fastify.post(
    "/v1/asha/leave-requests/:id/cancel",
    { preHandler: [requireRole(["ASHA"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const leaveRequest = await fastify.leaveService.cancelLeaveRequest(id, request.userProfile!);
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { leaveRequest },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  // ============================================================================
  // ADMINISTRATOR LEAVE MANAGEMENT ENDPOINTS (/api/v1/admin/leave-requests)
  // ============================================================================

  /**
   * GET /api/v1/admin/leave-requests
   * Admin lists all leave requests across the platform.
   */
  fastify.get(
    "/v1/admin/leave-requests",
    { preHandler: [requireRole(["ADMIN"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { status?: any };
        const leaveRequests = await fastify.leaveService.listAllLeaveRequestsForAdmin(
          request.userProfile!,
          query.status
        );
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { leaveRequests },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/admin/leave-requests/:id/approve
   * Admin approves leave request and triggers server-authoritative temporary reassignment.
   */
  fastify.post(
    "/v1/admin/leave-requests/:id/approve",
    { preHandler: [requireRole(["ADMIN"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const parseResult = ApproveLeaveRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid approval payload.",
            errors: parseResult.error.errors,
          });
        }

        const result = await fastify.leaveService.approveLeaveRequest(
          id,
          request.userProfile!,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/admin/leave-requests/:id/reject
   * Admin rejects leave request with recorded reason.
   */
  fastify.post(
    "/v1/admin/leave-requests/:id/reject",
    { preHandler: [requireRole(["ADMIN"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const parseResult = RejectLeaveRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid rejection payload.",
            errors: parseResult.error.errors,
          });
        }

        const leaveRequest = await fastify.leaveService.rejectLeaveRequest(
          id,
          request.userProfile!,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { leaveRequest },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/admin/leave-requests/restore-check
   * Explicit administrator trigger for lazy restoration of expired leaves.
   */
  fastify.post(
    "/v1/admin/leave-requests/restore-check",
    { preHandler: [requireRole(["ADMIN"]), requireConsent] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await fastify.leaveService.evaluateAndRestoreExpiredLeaves();
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/admin/ashas
   * Admin retrieves workforce list of active ASHA workers for selection as replacements.
   */
  fastify.get(
    "/v1/admin/ashas",
    { preHandler: [requireRole(["ADMIN"]), requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { excludeAshaId?: string; leaveRequestId?: string };
        const result = await fastify.leaveService.listEligibleReplacementAshas(
          request.userProfile!,
          query.excludeAshaId,
          query.leaveRequestId
        );
        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            ashas: result.ashas,
            count: result.count,
          },
        });
      } catch (err) {
        return handleLeaveError(err, reply);
      }
    }
  );
};
