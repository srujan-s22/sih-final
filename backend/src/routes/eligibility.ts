import { FastifyPluginAsync } from "fastify";
import { requireAuth, requireConsent } from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";

export const eligibilityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/eligibility/me
   * Evaluates the authenticated citizen's household and family members
   * against all active healthcare schemes using the deterministic rule engine.
   */
  fastify.get(
    "/v1/eligibility/me",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "eligibility-ctx";
      const uid = request.user!.uid;

      try {
        const evaluation = await fastify.eligibilityService.evaluateCitizenHousehold(uid);

        if (!evaluation.household) {
          return reply.status(HTTP_STATUS.OK).send({
            success: true,
            data: {
              hasHousehold: false,
              household: null,
              members: [],
              results: [],
              count: 0,
            },
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        const householdCases = await fastify.caseRepository.listCasesByHouseholdId(evaluation.household.id);
        const householdCase = householdCases.length > 0 ? householdCases[0] : null;

        const resolvedSchemeIds = new Set<string>();
        let isAnyCaseResolved = false;

        for (const c of householdCases) {
          if (c.resolvedSchemes) {
            c.resolvedSchemes.forEach((s) => resolvedSchemeIds.add(s));
          }
          if (["RESOLVED", "CLOSED"].includes(c.status)) {
            isAnyCaseResolved = true;
            if (c.schemeId) {
              resolvedSchemeIds.add(c.schemeId);
            }
          }
        }

        if (fastify.assistanceRepository) {
          try {
            const requests = await fastify.assistanceRepository.listRequestsByHouseholdId(evaluation.household.id);
            for (const req of requests) {
              if (["RESOLVED", "CLOSED"].includes(req.status) && req.schemeId) {
                resolvedSchemeIds.add(req.schemeId);
              }
            }
          } catch {
            // Non-blocking
          }
        }

        if (isAnyCaseResolved) {
          for (const res of evaluation.results) {
            if (res.status !== "NOT_ELIGIBLE") {
              resolvedSchemeIds.add(res.schemeId);
            }
          }
        }

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            hasHousehold: true,
            household: evaluation.household,
            members: evaluation.members,
            results: evaluation.results,
            count: evaluation.results.length,
            caseStatus: isAnyCaseResolved ? "RESOLVED" : householdCase?.status || null,
            resolvedSchemeIds: Array.from(resolvedSchemeIds),
          },
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        request.log.error({ err, correlationId, uid }, "Failed to evaluate household eligibility");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "InternalServerError",
          message: "Failed to evaluate healthcare eligibility.",
          code: "ELIGIBILITY_EVALUATION_FAILED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  /**
   * GET /api/v1/eligibility/me/:schemeId
   * Evaluates the citizen's household against a specific healthcare scheme.
   */
  fastify.get<{ Params: { schemeId: string } }>(
    "/v1/eligibility/me/:schemeId",
    { preHandler: [requireAuth, requireConsent] },
    async (request, reply) => {
      const correlationId = request.correlationId || "eligibility-ctx";
      const uid = request.user!.uid;
      const { schemeId } = request.params;

      try {
        const household = await fastify.householdRepository.getHouseholdByOwnerUid(uid);

        if (!household) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            error: "NotFound",
            message: "Household profile not found. Please set up your household first.",
            code: "HOUSEHOLD_NOT_FOUND",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        const members = await fastify.householdRepository.getMembers(household.id);
        const result = await fastify.eligibilityService.evaluateHouseholdForScheme(
          schemeId,
          household,
          members
        );

        if (!result) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            error: "NotFound",
            message: `Healthcare scheme '${schemeId}' not found or has no active version.`,
            code: "SCHEME_NOT_FOUND",
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: {
            result,
          },
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        request.log.error(
          { err, correlationId, uid, schemeId },
          "Failed to evaluate single scheme eligibility"
        );
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: "InternalServerError",
          message: "Failed to evaluate scheme eligibility.",
          code: "SCHEME_EVALUATION_FAILED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
};
