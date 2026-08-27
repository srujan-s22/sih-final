import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireRole } from "../plugins/guards.js";
import {
  ConsentSubmissionSchema,
  RoleAssignmentSchema,
  UserSyncSchema,
} from "../../../shared/schemas/auth.schema.js";
import {
  AuthMeResponse,
  AuthSyncResponse,
} from "../../../shared/types/auth.js";
import { CURRENT_CONSENT_VERSION, HTTP_STATUS } from "../config/constants.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/auth/me
   * Returns current authenticated user profile and consent requirement status
   */
  fastify.get(
    "/v1/auth/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.userProfile!;
      const isConsentRequired = fastify.userService.isConsentRequired(user);

      const response: AuthMeResponse = {
        user,
        isConsentRequired,
        activeConsentVersion: CURRENT_CONSENT_VERSION,
      };

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: response,
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * POST /api/v1/auth/sync
   * Idempotently syncs/creates user profile upon sign-in.
   * STRICT SECURITY RULE: Never resets or overwrites existing user role.
   */
  fastify.post(
    "/v1/auth/sync",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = UserSyncSchema.safeParse(request.body || {});
      const metadata = body.success ? body.data : {};

      const result = await fastify.userService.getOrCreateUser(
        request.user!,
        metadata
      );

      const response: AuthSyncResponse = {
        user: result.user,
        isNewUser: result.isNewUser,
        isConsentRequired: result.isConsentRequired,
        activeConsentVersion: CURRENT_CONSENT_VERSION,
      };

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: response,
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * POST /api/v1/auth/consent
   * Records user consent decision and stores audit entry in consent history.
   */
  fastify.post(
    "/v1/auth/consent",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = ConsentSubmissionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid consent submission data.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      const { user, consentRecord } = await fastify.userService.recordConsent(
        request.user!.uid,
        parseResult.data
      );

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          user,
          consentRecord,
          isConsentRequired: fastify.userService.isConsentRequired(user),
        },
        correlation_id: request.correlationId,
      });
    }
  );

  /**
   * POST /api/v1/auth/role/assign
   * Admin-Only: Assigns a new role to a target user.
   * STRICT SECURITY RULE: Actor UID is taken from the verified token context.
   */
  fastify.post(
    "/v1/auth/role/assign",
    { preHandler: [requireRole(["ADMIN"])] },
    async (request, reply) => {
      const parseResult = RoleAssignmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid role assignment request.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      const actorUid = request.user!.uid;
      const { targetUid, newRole } = parseResult.data;

      try {
        const updated = await fastify.userService.assignRole(
          actorUid,
          targetUid,
          newRole
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            user: updated,
            assignedBy: actorUid,
          },
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to assign role";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: "RoleAssignmentFailed",
          message,
          code: "ROLE_ASSIGNMENT_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
