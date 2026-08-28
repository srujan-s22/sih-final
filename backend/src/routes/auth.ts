import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../plugins/guards.js";
import {
  ConsentSubmissionSchema,
  RoleAssignmentSchema,
  RolePrevalidateSchema,
  UserSyncSchema,
  UserRegisterSchema,
} from "../../../shared/schemas/auth.schema.js";
import {
  AuthMeResponse,
  AuthSyncResponse,
} from "../../../shared/types/auth.js";
import { CURRENT_CONSENT_VERSION, HTTP_STATUS } from "../config/constants.js";

/**
 * Safely masks email for audit logging
 */
function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "anonymous";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `**@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

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
   * Common handler for user registration / profile sync.
   * STRICT SECURITY BOUNDARY: Privileged roles (ASHA, ADMIN) are validated server-side.
   */
  const handleUserSyncOrRegister = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = UserSyncSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
        success: false,
        error: "ValidationError",
        message: "Invalid user registration data.",
        code: "VALIDATION_FAILED",
        correlation_id: request.correlationId,
        timestamp: new Date().toISOString(),
        details: parseResult.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const { displayName, phoneNumber, requestedRole, registrationSecret } = parseResult.data;
    const rateLimitKey = request.ip || request.user?.uid || "anon-client";

    // Validate privileged role request
    const verification = fastify.privilegedAuthService.verifyPrivilegedRole(
      requestedRole,
      registrationSecret,
      rateLimitKey
    );

    if (!verification.allowed) {
      request.log.warn({
        correlationId: request.correlationId,
        event: "PRIVILEGED_REGISTRATION_FAILED",
        requestedRole,
        uid: request.user?.uid,
        maskedEmail: maskEmail(request.user?.email),
        reason: verification.error,
      });

      return reply.status(verification.statusCode).send({
        success: false,
        error: "PrivilegedAuthorizationFailed",
        message: verification.error || "Privileged account registration failed.",
        code: "PRIVILEGED_AUTH_FAILED",
        correlation_id: request.correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Audit log successful privileged registration request
    if (verification.role !== "CITIZEN") {
      request.log.info({
        correlationId: request.correlationId,
        event: "PRIVILEGED_REGISTRATION_SUCCESS",
        assignedRole: verification.role,
        uid: request.user?.uid,
        maskedEmail: maskEmail(request.user?.email),
      });
    }

    const result = await fastify.userService.getOrCreateUser(
      request.user!,
      { displayName, phoneNumber },
      verification.role
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
  };

  /**
   * POST /api/v1/auth/prevalidate
   * Validates requested role and registration secrets BEFORE Firebase Auth account creation.
   * Public unauthenticated endpoint (rate-limited by IP/identifier).
   * Prevents creating Firebase Auth accounts if the secret code is incorrect.
   */
  fastify.post(
    "/v1/auth/prevalidate",
    async (request, reply) => {
      const parseResult = RolePrevalidateSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid role validation request.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      const { requestedRole, registrationSecret } = parseResult.data;
      const rateLimitKey = request.ip || "anon-client";

      const verification = fastify.privilegedAuthService.verifyPrivilegedRole(
        requestedRole,
        registrationSecret,
        rateLimitKey
      );

      if (!verification.allowed) {
        request.log.warn({
          correlationId: request.correlationId,
          event: "PRIVILEGED_PREVALIDATION_FAILED",
          requestedRole,
          reason: verification.error,
        });

        return reply.status(verification.statusCode).send({
          success: false,
          error: "PrivilegedAuthorizationFailed",
          message: verification.error || "Staff registration could not be completed. Please verify your authorization code.",
          code: "PRIVILEGED_AUTH_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          allowed: true,
          role: verification.role || "CITIZEN",
        },
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
    handleUserSyncOrRegister
  );

  /**
   * POST /api/v1/auth/register
   * Explicit endpoint for citizen or privileged staff/admin registration.
   */
  fastify.post(
    "/v1/auth/register",
    { preHandler: [requireAuth] },
    handleUserSyncOrRegister
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
