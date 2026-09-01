import { FastifyPluginAsync } from "fastify";
import "@fastify/websocket";
import { VoiceGatewayService } from "../services/telephony/voice-gateway.service.js";
import { VoiceSessionRepository } from "../repositories/voice-session.repository.js";
import { SarvamService } from "../services/telephony/sarvam.service.js";
import { ExotelService } from "../services/telephony/exotel.service.js";
import { VoiceActionService } from "../services/telephony/voice-action.service.js";
import { ExotelStreamGatewayService } from "../services/telephony/exotel-stream-gateway.service.js";
import { SchemeService } from "../services/scheme.service.js";
import { SchemeRepository } from "../repositories/scheme.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { EligibilityService } from "../services/eligibility/eligibility.service.js";
import { AssistanceService } from "../services/assistance.service.js";
import { AssistanceRepository } from "../repositories/assistance.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { AutomationService } from "../services/automation/automation.service.js";
import {
  VoiceTurnInputSchema,
  VerifyCallerIdentityInputSchema,
  InitiateOutboundCallInputSchema,
  CitizenCallRequestSchema,
  AshaCallRequestSchema,
  ExotelInboundWebhookSchema,
  ExotelStatusCallbackSchema,
} from "../../../shared/schemas/voice.schema.js";
import { requireAuth, requireRole } from "../plugins/guards.js";
import { env } from "../config/env.js";
import { toVoiceLanguage } from "../../../shared/types/voice.js";

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  const db = (fastify as any).firestore || null;

  // Repositories
  const sessionRepo = fastify.voiceSessionRepository || new VoiceSessionRepository(db);
  const schemeRepo = fastify.schemeRepository || new SchemeRepository(db);
  const householdRepo = fastify.householdRepository || new HouseholdRepository(db);
  const assistanceRepo = fastify.assistanceRepository || new AssistanceRepository(db);
  const caseRepo = fastify.caseRepository || new CaseRepository(db);
  const connectionRepo = fastify.connectionRepository || new ConnectionRepository(db);
  const userRepo = fastify.userRepository || new UserRepository(db);

  // Services
  const sarvamService = fastify.sarvamService || new SarvamService();
  const exotelService = fastify.exotelService || new ExotelService();
  const schemeService = fastify.schemeService || new SchemeService(schemeRepo);
  const eligibilityService = fastify.eligibilityService || new EligibilityService(schemeRepo, householdRepo);
  const assistanceService = fastify.assistanceService || new AssistanceService(assistanceRepo, connectionRepo, householdRepo, caseRepo);
  const automationService = fastify.automationService || new AutomationService();

  const voiceActionService = fastify.voiceActionService || new VoiceActionService(
    schemeService,
    householdRepo,
    eligibilityService,
    assistanceService,
    caseRepo,
    connectionRepo,
    userRepo
  );

  const gatewayService = fastify.voiceGatewayService || new VoiceGatewayService(
    sessionRepo,
    sarvamService,
    exotelService,
    voiceActionService,
    caseRepo,
    householdRepo,
    userRepo,
    automationService
  );

  const streamGatewayService =
    (fastify as any).exotelStreamGatewayService ||
    new ExotelStreamGatewayService(gatewayService, sessionRepo, sarvamService);

  // Real-Time Exotel Audio WebSocket Stream (Phase 11 & Multilingual Hardening)
  // Route mounted under API prefix at /api/v1/voice/stream
  (fastify.route as any)({
    method: "GET",
    url: "/v1/voice/stream",
    handler: async (_request: any, reply: any) => {
      return reply.send({
        success: true,
        service: "SwasthyaSetu Voice Telephony Stream Gateway",
        protocol: "websocket",
        status: "ready",
        endpoint: "/api/v1/voice/stream",
      });
    },
    wsHandler: (socket: any, req: any) => {
      streamGatewayService.handleConnection(socket, req);
    },
  });

  // Support /api/v1/voice/stream/:language path parameter routing to identical handler
  (fastify.route as any)({
    method: "GET",
    url: "/v1/voice/stream/:language",
    handler: async (request: any, reply: any) => {
      const { language } = (request.params as any) || {};
      return reply.send({
        success: true,
        service: "SwasthyaSetu Voice Telephony Stream Gateway",
        protocol: "websocket",
        status: "ready",
        language: toVoiceLanguage(language),
        endpoint: "/api/v1/voice/stream",
      });
    },
    wsHandler: (socket: any, req: any) => {
      streamGatewayService.handleConnection(socket, req);
    },
  });

  // 0. Public Voice Configuration (No secrets exposed)
  fastify.get("/v1/voice/config", async (_request, reply) => {
    try {
      const config = gatewayService.getPublicConfig();
      return reply.send({ success: true, data: config });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { code: "CONFIG_ERROR", message: err.message } });
    }
  });

  // 1. Exotel Inbound Call Webhook
  fastify.post("/v1/voice/webhooks/exotel/inbound", async (request, reply) => {
    try {
      const payload = request.body as any;
      const result = await gatewayService.handleExotelInboundWebhook(payload);
      return reply.type("text/plain").send(result.responseXmlOrText);
    } catch (err: any) {
      fastify.log.error(err, "Failed to handle Exotel inbound webhook");
      return reply.type("text/plain").send("Welcome to SwasthyaSetu. Please stay on the line.");
    }
  });

  // 2. Exotel Call Status Callback
  fastify.post("/v1/voice/callbacks/exotel/status", async (request, reply) => {
    try {
      const payload = request.body as any;
      const session = await gatewayService.handleStatusCallback(payload);
      return reply.send({ success: true, data: session });
    } catch (err: any) {
      fastify.log.error(err, "Failed to handle Exotel status callback");
      return reply.send({ success: false, error: { code: "CALLBACK_ERROR", message: err.message } });
    }
  });

  // 3. Initialize Voice Session
  fastify.post("/v1/voice/sessions", async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const callerPhone = body.callerPhone || "+919876543210";
      const language = toVoiceLanguage(body.language || "en-IN");

      const session = await gatewayService.createInboundSession(callerPhone, undefined, language);
      return reply.send({ success: true, data: session });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { code: "SESSION_CREATE_FAILED", message: err.message } });
    }
  });

  // 4. Get Voice Session Metadata
  fastify.get<{ Params: { id: string } }>("/v1/voice/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    const session = await sessionRepo.getSessionById(id);
    if (!session) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Voice session not found." } });
    }
    return reply.send({ success: true, data: session });
  });

  // 5. Process Conversational Voice Turn
  fastify.post<{ Params: { id: string } }>("/v1/voice/sessions/:id/turn", async (request, reply) => {
    const { id } = request.params;
    const parseResult = VoiceTurnInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid voice turn payload.", details: parseResult.error.format() },
      });
    }

    try {
      const turnResponse = await gatewayService.processTurn(id, parseResult.data);
      return reply.send({ success: true, data: turnResponse });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { code: "TURN_ERROR", message: err.message } });
    }
  });

  // 6. Verify Caller Identity Challenge
  fastify.post<{ Params: { id: string } }>("/v1/voice/sessions/:id/verify", async (request, reply) => {
    const { id } = request.params;
    const parseResult = VerifyCallerIdentityInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid verification code payload.", details: parseResult.error.format() },
      });
    }

    try {
      const turnResponse = await gatewayService.verifyCaller(id, parseResult.data.verificationCode);
      return reply.send({ success: true, data: turnResponse });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { code: "VERIFY_ERROR", message: err.message } });
    }
  });

  // 7. Citizen Requests Voice Assistant Call (Auth: CITIZEN)
  fastify.post(
    "/v1/voice/citizen/request-call",
    { preHandler: [requireAuth, requireRole(["CITIZEN"])] },
    async (request, reply) => {
      const citizenUid = request.user!.uid;
      const parseResult = CitizenCallRequestSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors[0]?.message || "Invalid call request payload.";
        return reply.status(400).send({
          success: false,
          error: { code: "VOICE_VALIDATION_ERROR", message: errorMsg, details: parseResult.error.format() },
        });
      }

      try {
        const result = await gatewayService.requestCitizenCall(citizenUid, parseResult.data);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        const status = err.httpStatus || 500;
        const code = err.code || "CITIZEN_CALL_FAILED";
        return reply.status(status).send({ success: false, error: { code, message: err.message } });
      }
    }
  );

  // 8. Citizen Call History (Auth: CITIZEN)
  fastify.get(
    "/v1/voice/citizen/calls",
    { preHandler: [requireAuth, requireRole(["CITIZEN"])] },
    async (request, reply) => {
      try {
        const history = await gatewayService.listCitizenCalls(request.user!.uid);
        return reply.send({ success: true, data: history });
      } catch (err: any) {
        const status = err.httpStatus || 500;
        const code = err.code || "HISTORY_ERROR";
        return reply.status(status).send({ success: false, error: { code, message: err.message } });
      }
    }
  );

  // 9. ASHA Direct Call Citizen (Auth: ASHA / ADMIN)
  fastify.post(
    "/v1/voice/asha/call-citizen",
    { preHandler: [requireAuth, requireRole(["ASHA", "ADMIN"])] },
    async (request, reply) => {
      const ashaUid = request.user!.uid;
      const parseResult = AshaCallRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid ASHA call request.", details: parseResult.error.format() },
        });
      }

      try {
        const result = await gatewayService.initiateAshaCall(ashaUid, parseResult.data);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        const status = err.httpStatus || 500;
        const code = err.code || "ASHA_CALL_FAILED";
        return reply.status(status).send({ success: false, error: { code, message: err.message } });
      }
    }
  );

  // 10. ASHA Call History (Auth: ASHA / ADMIN)
  fastify.get(
    "/v1/voice/asha/calls",
    { preHandler: [requireAuth, requireRole(["ASHA", "ADMIN"])] },
    async (request, reply) => {
      try {
        const history = await gatewayService.listAshaCalls(request.user!.uid);
        return reply.send({ success: true, data: history });
      } catch (err: any) {
        const status = err.httpStatus || 500;
        const code = err.code || "HISTORY_ERROR";
        return reply.status(status).send({ success: false, error: { code, message: err.message } });
      }
    }
  );

  // 11. Case Call History (Auth: ASHA / ADMIN)
  fastify.get<{ Params: { caseId: string } }>(
    "/v1/voice/cases/:caseId/calls",
    { preHandler: [requireAuth, requireRole(["ASHA", "ADMIN"])] },
    async (request, reply) => {
      try {
        const history = await gatewayService.listCaseCalls(request.params.caseId);
        return reply.send({ success: true, data: history });
      } catch (err: any) {
        const status = err.httpStatus || 500;
        const code = err.code || "HISTORY_ERROR";
        return reply.status(status).send({ success: false, error: { code, message: err.message } });
      }
    }
  );

  // 12. Initiate Authorized Outbound Follow-up Call (ASHA / ADMIN / internal secret)
  fastify.post("/v1/voice/outbound", async (request, reply) => {
    const secretHeader = request.headers["x-swasthya-secret"] || request.headers["x-n8n-webhook-secret"];
    const isSecretAuthorized = Boolean(
      secretHeader && secretHeader === (env.N8N_WEBHOOK_SECRET || "swasthyasetu-prod-automation-key-2026")
    );

    if (!isSecretAuthorized) {
      if (!request.user || (request.user.role !== "ASHA" && request.user.role !== "ADMIN")) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Only authorized ASHA workers, Admins, or automation secret can initiate outbound reminder calls." },
        });
      }
    }

    const parseResult = InitiateOutboundCallInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid outbound call dispatch request.", details: parseResult.error.format() },
      });
    }

    try {
      const { followUpId, caseId, reason } = parseResult.data;
      const result = await gatewayService.initiateOutboundFollowUpCall(followUpId, caseId, reason);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      const status = err.httpStatus || 500;
      const code = err.code || "OUTBOUND_CALL_FAILED";
      return reply.status(status).send({ success: false, error: { code, message: err.message } });
    }
  });

  // 13. Admin Voice Telemetry & Telephony Health
  fastify.get(
    "/v1/admin/voice/telemetry",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (_request, reply) => {
      try {
        const telemetry = await gatewayService.getHealthAndTelemetry();
        return reply.send({ success: true, data: telemetry });
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: { code: "TELEMETRY_ERROR", message: err.message } });
      }
    }
  );
};
