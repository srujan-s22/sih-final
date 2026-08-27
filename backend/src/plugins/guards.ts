import { FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "../../../shared/types/auth.js";
import { HTTP_STATUS } from "../config/constants.js";

/**
 * Route preHandler Guard: Enforces authentication
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.userProfile) {
    await request.server.authenticate(request, reply);
  }
}

/**
 * Route preHandler Guard Factory: Enforces role authorization
 * Ensures the authenticated user's role belongs to allowedRoles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userProfile) {
      await request.server.authenticate(request, reply);
      if (reply.sent) return;
    }

    const userRole = request.userProfile?.role;
    const correlationId = request.correlationId || "guard-ctx";

    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.status(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        error: "Forbidden",
        message: "You do not have the required permissions to access this resource.",
        code: "INSUFFICIENT_ROLE",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Route preHandler Guard: Enforces active consent acceptance
 */
export async function requireConsent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.userProfile) {
    await request.server.authenticate(request, reply);
    if (reply.sent) return;
  }

  const isConsentRequired = request.server.userService.isConsentRequired(request.userProfile!);
  const correlationId = request.correlationId || "consent-ctx";

  if (isConsentRequired) {
    return reply.status(HTTP_STATUS.FORBIDDEN).send({
      success: false,
      error: "ConsentRequired",
      message: "Please accept the required healthcare data consent to continue.",
      code: "CONSENT_REQUIRED",
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
