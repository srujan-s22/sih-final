import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import {
  CreateHouseholdSchema,
  UpdateHouseholdSchema,
  CreateMemberSchema,
  UpdateMemberSchema,
} from "../../../shared/schemas/household.schema.js";
import { HTTP_STATUS } from "../config/constants.js";

export const householdRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/households
   * Creates or returns existing household for the authenticated citizen.
   */
  fastify.post(
    "/v1/households",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const parseResult = CreateHouseholdSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid household profile data.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      try {
        const result = await fastify.householdService.getOrCreateHousehold(
          request.user!.uid,
          parseResult.data
        );

        return reply.status(result.isNew ? HTTP_STATUS.CREATED : HTTP_STATUS.OK).send({
          success: true,
          data: result,
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create household.";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: "HouseholdCreationFailed",
          message,
          code: "HOUSEHOLD_CREATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * GET /api/v1/households/me
   * Retrieves current authenticated citizen's household and family members.
   */
  fastify.get(
    "/v1/households/me",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      try {
        const data = await fastify.householdService.getHouseholdByOwner(
          request.user!.uid
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data,
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to retrieve household.";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "HouseholdRetrievalFailed",
          message,
          code: "HOUSEHOLD_RETRIEVAL_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * PATCH /api/v1/households/me
   * Updates current authenticated citizen's household demographic details.
   */
  fastify.patch(
    "/v1/households/me",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const parseResult = UpdateHouseholdSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid household update data.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      try {
        const updated = await fastify.householdService.updateHousehold(
          request.user!.uid,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { household: updated },
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update household.";
        const isNotFound = message.includes("not found");
        return reply.status(isNotFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: isNotFound ? "NotFound" : "HouseholdUpdateFailed",
          message,
          code: isNotFound ? "HOUSEHOLD_NOT_FOUND" : "HOUSEHOLD_UPDATE_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * POST /api/v1/households/me/members
   * Adds a new member to the authenticated citizen's household.
   */
  fastify.post(
    "/v1/households/me/members",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const parseResult = CreateMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid member profile data.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      try {
        const member = await fastify.householdService.addMember(
          request.user!.uid,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: { member },
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to add household member.";
        const isNotFound = message.includes("not found");
        return reply.status(isNotFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: isNotFound ? "NotFound" : "MemberCreationFailed",
          message,
          code: isNotFound ? "HOUSEHOLD_NOT_FOUND" : "MEMBER_CREATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * GET /api/v1/households/me/members
   * Lists all members of the authenticated citizen's household.
   */
  fastify.get(
    "/v1/households/me/members",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      try {
        const members = await fastify.householdService.getMembers(
          request.user!.uid
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { members },
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to list household members.";
        const isNotFound = message.includes("not found");
        return reply.status(isNotFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: isNotFound ? "NotFound" : "MemberRetrievalFailed",
          message,
          code: isNotFound ? "HOUSEHOLD_NOT_FOUND" : "MEMBER_RETRIEVAL_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * PATCH /api/v1/households/me/members/:memberId
   * Updates an existing member in the authenticated citizen's household.
   */
  fastify.patch<{ Params: { memberId: string } }>(
    "/v1/households/me/members/:memberId",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const { memberId } = request.params;
      const parseResult = UpdateMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
          success: false,
          error: "ValidationError",
          message: "Invalid member update data.",
          code: "VALIDATION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      try {
        const updated = await fastify.householdService.updateMember(
          request.user!.uid,
          memberId,
          parseResult.data
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { member: updated },
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update member.";
        const isNotFound = message.includes("not found");
        return reply.status(isNotFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: isNotFound ? "NotFound" : "MemberUpdateFailed",
          message,
          code: isNotFound ? "MEMBER_NOT_FOUND" : "MEMBER_UPDATE_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * DELETE /api/v1/households/me/members/:memberId
   * Removes a member from the authenticated citizen's household.
   */
  fastify.delete<{ Params: { memberId: string } }>(
    "/v1/households/me/members/:memberId",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const { memberId } = request.params;
      try {
        await fastify.householdService.deleteMember(
          request.user!.uid,
          memberId
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          message: "Household member removed successfully.",
          correlation_id: request.correlationId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete member.";
        const isNotFound = message.includes("not found");
        return reply.status(isNotFound ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: isNotFound ? "NotFound" : "MemberDeletionFailed",
          message,
          code: isNotFound ? "MEMBER_NOT_FOUND" : "MEMBER_DELETION_FAILED",
          correlation_id: request.correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
