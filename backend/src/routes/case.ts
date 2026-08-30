import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  UpdateCaseInputSchema,
  CreateCaseTaskInputSchema,
  UpdateCaseTaskInputSchema,
  CompleteCaseTaskInputSchema,
  CreateCaseNoteInputSchema,
  CreateCaseFollowUpInputSchema,
  UpdateCaseFollowUpInputSchema,
  AssignCaseInputSchema,
  InitiateSchemeAssistanceInputSchema,
} from "../../../shared/schemas/case.schema.js";
import { CreateHouseholdSchema } from "../../../shared/schemas/household.schema.js";
import { CaseServiceError } from "../services/case.service.js";

export const caseRoutes: FastifyPluginAsync = async (fastify) => {
  // Common error handler
  const handleCaseError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof CaseServiceError) {
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
      message: "An error occurred while processing the case management request.",
    });
  };

  // ============================================================================
  // ASHA WORKSPACE CASE ENDPOINTS (/api/v1/asha/cases & intelligence)
  // ============================================================================

  /**
   * GET /api/v1/asha/intelligence/attention-signals
   * Computes deterministic proactive attention signals across the authenticated ASHA's assigned caseload
   */
  fastify.get(
    "/v1/asha/intelligence/attention-signals",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userProfile = request.userProfile;
        if (!userProfile || (userProfile.role !== "ASHA" && userProfile.role !== "ADMIN")) {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only ASHA workers and Administrators can access proactive intelligence.",
          });
        }

        const data = await fastify.caseService.getAshaAttentionSignals(request.user!.uid);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data,
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/cases/:caseId/initiate-scheme
   * Proactively initiates a verified scheme journey from ASHA caseload
   */
  fastify.post(
    "/v1/asha/cases/:caseId/initiate-scheme",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const userProfile = request.userProfile;
        if (!userProfile || (userProfile.role !== "ASHA" && userProfile.role !== "ADMIN")) {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only ASHA workers and Administrators can initiate proactive scheme assistance.",
          });
        }

        const parseResult = InitiateSchemeAssistanceInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid scheme initiation payload.",
            errors: parseResult.error.errors,
          });
        }

        const result = await fastify.caseService.initiateSchemeAssistance(
          caseId,
          parseResult.data,
          userProfile
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: result,
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases
   * Lists cases assigned to the authenticated ASHA worker
   */
  fastify.get(
    "/v1/asha/cases",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userProfile = request.userProfile;
        if (!userProfile || (userProfile.role !== "ASHA" && userProfile.role !== "ADMIN")) {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only ASHA workers and Administrators can access case management.",
          });
        }

        const query = request.query as {
          status?: any;
          priority?: any;
          search?: string;
        };

        const cases = await fastify.caseService.listAshaCases(request.user!.uid, query);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { cases },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases/summary
   * Operational summary metrics for the ASHA dashboard
   */
  fastify.get(
    "/v1/asha/cases/summary",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userProfile = request.userProfile;
        if (!userProfile || (userProfile.role !== "ASHA" && userProfile.role !== "ADMIN")) {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only ASHA workers and Administrators can view caseload summaries.",
          });
        }

        const summary = await fastify.caseService.getAshaCaseSummary(request.user!.uid);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: summary,
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases/:caseId
   * Retrieves full aggregated case details
   */
  fastify.get(
    "/v1/asha/cases/:caseId",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        if (!caseId || caseId.trim().length === 0) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "INVALID_CASE_ID",
            message: "Case ID is required.",
          });
        }

        const detail = await fastify.caseService.getCaseDetail(caseId, request.userProfile!);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: detail,
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * PATCH /api/v1/asha/cases/:caseId
   * Updates case status, priority, or last contact timestamp
   */
  fastify.patch(
    "/v1/asha/cases/:caseId",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const parseResult = UpdateCaseInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid case update payload.",
            errors: parseResult.error.errors,
          });
        }

        const updated = await fastify.caseService.updateCase(
          caseId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { case: updated },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/cases/:caseId/notes
   * Adds a timestamped note to the case
   */
  fastify.post(
    "/v1/asha/cases/:caseId/notes",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const parseResult = CreateCaseNoteInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid note payload.",
            errors: parseResult.error.errors,
          });
        }

        const note = await fastify.caseService.addCaseNote(
          caseId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: { note },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases/:caseId/notes
   * Lists notes for an authorized case
   */
  fastify.get(
    "/v1/asha/cases/:caseId/notes",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const notes = await fastify.caseService.getCaseNotes(caseId, request.userProfile!);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { notes },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/cases/:caseId/follow-ups
   * Schedules a follow-up task for the case
   */
  fastify.post(
    "/v1/asha/cases/:caseId/follow-ups",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const parseResult = CreateCaseFollowUpInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid follow-up payload.",
            errors: parseResult.error.errors,
          });
        }

        const followUp = await fastify.caseService.createFollowUp(
          caseId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: { followUp },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * PATCH /api/v1/asha/cases/:caseId/follow-ups/:followUpId
   * Updates/completes a scheduled follow-up
   */
  fastify.patch(
    "/v1/asha/cases/:caseId/follow-ups/:followUpId",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId, followUpId } = request.params as { caseId: string; followUpId: string };
        const parseResult = UpdateCaseFollowUpInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid follow-up update payload.",
            errors: parseResult.error.errors,
          });
        }

        const followUp = await fastify.caseService.updateFollowUp(
          caseId,
          followUpId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { followUp },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases/:caseId/tasks
   * Lists tasks for an authorized case
   */
  fastify.get(
    "/v1/asha/cases/:caseId/tasks",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const tasks = await fastify.caseService.getCaseTasks(caseId, request.userProfile!);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { tasks },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/cases/:caseId/tasks
   * Creates a custom task for the case
   */
  fastify.post(
    "/v1/asha/cases/:caseId/tasks",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const parseResult = CreateCaseTaskInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid task creation payload.",
            errors: parseResult.error.errors,
          });
        }

        const task = await fastify.caseService.createCaseTask(
          caseId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: { task },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * PATCH /api/v1/asha/cases/:caseId/tasks/:taskId
   * Updates an existing task
   */
  fastify.patch(
    "/v1/asha/cases/:caseId/tasks/:taskId",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId, taskId } = request.params as { caseId: string; taskId: string };
        const parseResult = UpdateCaseTaskInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid task update payload.",
            errors: parseResult.error.errors,
          });
        }

        const task = await fastify.caseService.updateCaseTask(
          caseId,
          taskId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { task },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * PATCH /api/v1/asha/cases/:caseId/tasks/:taskId/complete
   * Marks a task completed and advances journey steps
   */
  fastify.patch(
    "/v1/asha/cases/:caseId/tasks/:taskId/complete",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId, taskId } = request.params as { caseId: string; taskId: string };
        const parseResult = CompleteCaseTaskInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid task completion payload.",
            errors: parseResult.error.errors,
          });
        }

        const task = await fastify.caseService.completeCaseTask(
          caseId,
          taskId,
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { task },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * GET /api/v1/asha/cases/:caseId/activities
   * Retrieves immutable audit activity log
   */
  fastify.get(
    "/v1/asha/cases/:caseId/activities",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { caseId } = request.params as { caseId: string };
        const activities = await fastify.caseService.getCaseActivities(
          caseId,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { activities },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/asha/cases
   * Assisted Field Registration: Registers household in field & auto-creates assigned case
   */
  fastify.post(
    "/v1/asha/cases",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parseResult = CreateHouseholdSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid household registration payload.",
            errors: parseResult.error.errors,
          });
        }

        const result = await fastify.caseService.createFieldEnrollmentCase(
          parseResult.data,
          request.userProfile!
        );

        return reply.status(HTTP_STATUS.CREATED).send({
          success: true,
          data: result,
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  // ============================================================================
  // ADMIN CASE MANAGEMENT ENDPOINTS (/api/v1/admin/cases)
  // ============================================================================

  /**
   * GET /api/v1/admin/cases
   * Lists all platform cases (Admin only)
   */
  fastify.get(
    "/v1/admin/cases",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userProfile = request.userProfile;
        if (!userProfile || userProfile.role !== "ADMIN") {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only Administrators can view all platform cases.",
          });
        }

        const cases = await fastify.caseService.listAllCasesForAdmin(userProfile);

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { cases },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );

  /**
   * POST /api/v1/admin/cases/assign
   * Assigns or reassigns a household case to an ASHA worker (Admin only)
   */
  fastify.post(
    "/v1/admin/cases/assign",
    { preHandler: [requireAuth, requireConsent] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userProfile = request.userProfile;
        if (!userProfile || userProfile.role !== "ADMIN") {
          return reply.status(HTTP_STATUS.FORBIDDEN).send({
            success: false,
            code: "FORBIDDEN_ROLE",
            message: "Only Administrators can assign cases.",
          });
        }

        const parseResult = AssignCaseInputSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid assignment payload.",
            errors: parseResult.error.errors,
          });
        }

        const assignedCase = await fastify.caseService.assignCaseToAsha(
          parseResult.data.householdId,
          parseResult.data.ashaUid,
          userProfile
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: { case: assignedCase },
        });
      } catch (err) {
        return handleCaseError(err, reply);
      }
    }
  );
};
