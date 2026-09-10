import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requireRole, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  NfcProvisionParamsSchema,
  NfcRevokeSchema,
  NfcResolveSchema,
  NfcConfirmRotationSchema,
  NfcCancelRotationSchema,
} from "../../../shared/schemas/nfc.schema.js";
import { NfcServiceError } from "../services/nfc.service.js";

export const nfcRoutes: FastifyPluginAsync = async (fastify) => {
  const handleNfcError = (
    error: unknown,
    reply: FastifyReply,
    correlationId: string
  ) => {
    if (error instanceof NfcServiceError) {
      return reply.status(error.statusCode).send({
        success: false,
        code: error.code,
        error: error.code,
        message: error.message,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    fastify.log.error(error);
    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      error: "InternalServerError",
      message: "An internal error occurred while processing the NFC request.",
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    });
  };

  // ============================================================================
  // PUBLIC UNTOUCHED NFC RESOLVE ENDPOINT (/api/v1/nfc/resolve)
  // ============================================================================

  /**
   * POST /api/v1/nfc/resolve
   * Public endpoint that validates an NFC tag's credentials and returns
   * the strictly privacy-minimal public household and scheme summary.
   */
  fastify.post(
    "/v1/nfc/resolve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const correlationId = request.correlationId || "nfc-resolve-ctx";

      const parseResult = NfcResolveSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: parseResult.error.errors[0]?.message || "Invalid NFC resolution payload.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const clientIp = request.ip || "unknown";
        const result = await fastify.nfcService.resolvePublicNfc(
          parseResult.data.householdId,
          parseResult.data.token,
          clientIp
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  // ============================================================================
  // AUTHORIZED ASHA / ADMIN NFC MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * POST /api/v1/asha/households/:householdId/nfc
   * Provisions a new NFC credential for the authorized household.
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.post<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-provision-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await fastify.nfcService.provisionNfc(
          paramResult.data.householdId,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  /**
   * POST /api/v1/asha/households/:householdId/nfc/rotate
   * Securely rotates an existing household NFC credential (e.g. lost/damaged card).
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.post<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc/rotate",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-rotate-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      const bodyResult = NfcRevokeSchema.safeParse(request.body || {});
      const reason = bodyResult.success ? bodyResult.data.reason : undefined;

      try {
        const result = await fastify.nfcService.rotateNfc(
          paramResult.data.householdId,
          request.userProfile!,
          reason
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  /**
   * POST /api/v1/asha/households/:householdId/nfc/rotate/confirm
   * Confirms successful physical NFC card write during rotation.
   * Atomically invalidates the old active card and activates the pending credential.
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.post<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc/rotate/confirm",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-rotate-confirm-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      const bodyResult = NfcConfirmRotationSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: bodyResult.error.errors[0]?.message || "Invalid rotation confirmation payload.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await fastify.nfcService.confirmRotateNfc(
          paramResult.data.householdId,
          bodyResult.data.nfcId,
          bodyResult.data.version,
          request.userProfile!,
          bodyResult.data.reason
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  /**
   * POST /api/v1/asha/households/:householdId/nfc/rotate/cancel
   * Cancels a pending NFC card rotation if physical write fails or ASHA leaves the workflow.
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.post<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc/rotate/cancel",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-rotate-cancel-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      const bodyResult = NfcCancelRotationSchema.safeParse(request.body || {});
      if (!bodyResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: bodyResult.error.errors[0]?.message || "Invalid rotation cancellation payload.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await fastify.nfcService.cancelRotateNfc(
          paramResult.data.householdId,
          bodyResult.data.nfcId,
          request.userProfile!,
          bodyResult.data.reason
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  /**
   * POST /api/v1/asha/households/:householdId/nfc/revoke
   * Explicitly revokes an active household NFC card.
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.post<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc/revoke",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-revoke-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      const bodyResult = NfcRevokeSchema.safeParse(request.body || {});
      const reason = bodyResult.success ? bodyResult.data.reason : undefined;

      try {
        const result = await fastify.nfcService.revokeNfc(
          paramResult.data.householdId,
          request.userProfile!,
          reason
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );

  /**
   * GET /api/v1/asha/households/:householdId/nfc
   * Retrieves safe status and version metadata for a household's NFC tag.
   * Guard: ASHA (assigned to household) or Admin.
   */
  fastify.get<{ Params: { householdId: string } }>(
    "/v1/asha/households/:householdId/nfc",
    { preHandler: [requireRole(["ASHA", "ADMIN"]), requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "nfc-status-ctx";

      const paramResult = NfcProvisionParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "VALIDATION_FAILED",
          error: "ValidationError",
          message: paramResult.error.errors[0]?.message || "Invalid household parameter.",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await fastify.nfcService.getHouseholdNfcStatus(
          paramResult.data.householdId,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return handleNfcError(err, reply, correlationId);
      }
    }
  );
};
