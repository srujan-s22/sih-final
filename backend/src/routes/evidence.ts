import { FastifyPluginAsync } from "fastify";
import {
  requireAuth,
  requireConsent,
  requireRole,
} from "../plugins/guards.js";
import { HTTP_STATUS } from "../config/constants.js";
import {
  EvidenceSearchRequestSchema,
  UpdateEvidenceStatusRequestSchema,
} from "../../../shared/schemas/evidence.schema.js";

const requireAdmin = requireRole(["ADMIN"]);

export const evidenceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/evidence/schemes/:schemeId
   * Public / Citizen-safe endpoint returning ONLY verified source evidence for a scheme.
   */
  fastify.get(
    "/v1/evidence/schemes/:schemeId",
    {
      preHandler: [requireAuth, requireConsent],
    },
    async (request, reply) => {
      const { schemeId } = request.params as { schemeId: string };
      const correlationId = request.correlationId || "evidence-ctx";

      try {
        const verifiedEvidence = await fastify.evidenceService.getVerifiedSchemeEvidence(schemeId);

        request.log.info(
          { correlationId, schemeId, verifiedCount: verifiedEvidence.length },
          "Retrieved verified scheme evidence"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: verifiedEvidence,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, schemeId, err }, "Failed to fetch verified evidence");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "EVIDENCE_RETRIEVAL_FAILED",
          message: "Failed to retrieve verified scheme evidence.",
        });
      }
    }
  );

  /**
   * POST /api/v1/evidence/search
   * Admin-only controlled claim-based evidence discovery via Tavily.
   */
  fastify.post(
    "/v1/evidence/search",
    {
      preHandler: [requireAuth, requireConsent, requireAdmin],
    },
    async (request, reply) => {
      const adminUid = request.user!.uid;
      const correlationId = request.correlationId || "evidence-search-ctx";

      const parsed = EvidenceSearchRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: "Invalid evidence search parameters.",
          details: parsed.error.format(),
        });
      }

      try {
        const result = await fastify.evidenceService.searchClaimEvidence(parsed.data, adminUid);

        request.log.info(
          {
            correlationId,
            schemeId: parsed.data.schemeId,
            cacheHit: result.cacheHit,
            candidatesCount: result.candidatesCount,
            conflictsCount: result.conflicts.length,
          },
          "Admin evidence discovery completed"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, err }, "Evidence discovery search failed");

        const msg = err instanceof Error ? err.message : "Evidence discovery failed.";
        let code = "EVIDENCE_SEARCH_FAILED";
        let status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;

        if (msg.includes("EVIDENCE_PROVIDER_UNCONFIGURED")) {
          code = "EVIDENCE_PROVIDER_UNCONFIGURED";
          status = 503;
        } else if (msg.includes("EVIDENCE_RATE_LIMITED")) {
          code = "EVIDENCE_RATE_LIMITED";
          status = 429;
        } else if (msg.includes("EVIDENCE_PII_REJECTED")) {
          code = "EVIDENCE_PII_REJECTED";
          status = HTTP_STATUS.BAD_REQUEST;
        }

        return reply.status(status).send({
          success: false,
          code,
          message: msg,
        });
      }
    }
  );

  /**
   * POST /api/v1/evidence/:id/verify
   * Admin-only explicit verification / rejection transition with audit trail.
   */
  fastify.post(
    "/v1/evidence/:id/verify",
    {
      preHandler: [requireAuth, requireConsent, requireAdmin],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const adminUid = request.user!.uid;
      const correlationId = request.correlationId || "evidence-verify-ctx";

      const parsed = UpdateEvidenceStatusRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: "Invalid verification status payload.",
          details: parsed.error.format(),
        });
      }

      try {
        const updated = await fastify.evidenceService.updateVerificationStatus(
          id,
          parsed.data.status,
          adminUid,
          parsed.data.reason
        );

        if (!updated) {
          return reply.status(HTTP_STATUS.NOT_FOUND).send({
            success: false,
            code: "EVIDENCE_NOT_FOUND",
            message: `Evidence record ${id} not found.`,
          });
        }

        request.log.info(
          { correlationId, evidenceId: id, newStatus: parsed.data.status, adminUid },
          "Admin updated evidence verification status"
        );

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: updated,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, evidenceId: id, err }, "Failed to update evidence status");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "EVIDENCE_UPDATE_FAILED",
          message: "Failed to update evidence verification status.",
        });
      }
    }
  );

  /**
   * GET /api/v1/evidence/conflicts
   * Admin-only endpoint to inspect detected rule conflicts.
   */
  fastify.get(
    "/v1/evidence/conflicts",
    {
      preHandler: [requireAuth, requireConsent, requireAdmin],
    },
    async (request, reply) => {
      const { schemeId } = request.query as { schemeId?: string };
      const correlationId = request.correlationId || "evidence-conflicts-ctx";

      try {
        const conflicts = await fastify.evidenceService.listConflicts(schemeId);

        request.log.info({ correlationId, count: conflicts.length }, "Retrieved evidence conflicts");

        return reply.status(HTTP_STATUS.OK).send({
          success: true,
          data: conflicts,
        });
      } catch (err: unknown) {
        request.log.error({ correlationId, err }, "Failed to list evidence conflicts");
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          code: "EVIDENCE_CONFLICTS_FAILED",
          message: "Failed to list evidence conflicts.",
        });
      }
    }
  );

  /**
   * GET /api/v1/evidence/:id
   * Admin-only endpoint to inspect full internal provenance record.
   */
  fastify.get(
    "/v1/evidence/:id",
    {
      preHandler: [requireAuth, requireConsent, requireAdmin],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const evidence = await fastify.evidenceRepository.getEvidenceById(id);
      if (!evidence) {
        return reply.status(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          code: "EVIDENCE_NOT_FOUND",
          message: `Evidence record ${id} was not found.`,
        });
      }

      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: evidence,
      });
    }
  );
};
