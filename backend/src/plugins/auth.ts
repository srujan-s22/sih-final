import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import * as admin from "firebase-admin";
import { UserProfile, UserRole } from "../../../shared/types/auth.js";
import { UserRepository } from "../repositories/user.repository.js";
import { UserService } from "../services/user.service.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { HouseholdService } from "../services/household.service.js";
import { SchemeRepository } from "../repositories/scheme.repository.js";
import { SchemeService } from "../services/scheme.service.js";
import { EligibilityService } from "../services/eligibility/eligibility.service.js";
import { GuidanceService } from "../services/guidance/guidance.service.js";
import { EvidenceRepository } from "../repositories/evidence.repository.js";
import { EvidenceService } from "../services/evidence/evidence.service.js";
import { AICacheRepository } from "../repositories/ai-cache.repository.js";
import { AIContextBuilder } from "../services/ai/ai-context-builder.js";
import { LyzrService } from "../services/ai/lyzr.service.js";
import { IntelligenceService } from "../services/ai/intelligence.service.js";
import { PrivilegedAuthService } from "../services/privileged-auth.service.js";
import { GeminiService } from "../services/ai/gemini.service.js";
import { AssistantService } from "../services/ai/assistant.service.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { CaseService } from "../services/case.service.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { ConnectionService } from "../services/connection.service.js";
import { AssistanceRepository } from "../repositories/assistance.repository.js";
import { AssistanceService } from "../services/assistance.service.js";
import { HTTP_STATUS } from "../config/constants.js";

declare module "fastify" {
  interface FastifyInstance {
    userRepository: UserRepository;
    userService: UserService;
    privilegedAuthService: PrivilegedAuthService;
    householdRepository: HouseholdRepository;
    householdService: HouseholdService;
    caseRepository: CaseRepository;
    caseService: CaseService;
    connectionRepository: ConnectionRepository;
    connectionService: ConnectionService;
    assistanceRepository: AssistanceRepository;
    assistanceService: AssistanceService;
    schemeRepository: SchemeRepository;
    schemeService: SchemeService;
    eligibilityService: EligibilityService;
    guidanceService: GuidanceService;
    evidenceRepository: EvidenceRepository;
    evidenceService: EvidenceService;
    aiCacheRepository: AICacheRepository;
    aiContextBuilder: AIContextBuilder;
    lyzrService: LyzrService;
    intelligenceService: IntelligenceService;
    geminiService: GeminiService;
    assistantService: AssistantService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      uid: string;
      email?: string;
      role?: string;
      [key: string]: unknown;
    } | null;
    userProfile: UserProfile | null;
  }
}

/**
 * Authentication and User Resolution Plugin
 * Verifies Bearer Firebase ID tokens and populates trusted userProfile.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize repositories and services
  const firestoreInstance = (fastify as any).firestore || null;
  const userRepository = new UserRepository(firestoreInstance);
  const userService = new UserService(userRepository);
  const householdRepository = new HouseholdRepository(firestoreInstance);
  const householdService = new HouseholdService(householdRepository);
  const caseRepository = new CaseRepository(firestoreInstance);
  const schemeRepository = new SchemeRepository(firestoreInstance);
  const schemeService = new SchemeService(schemeRepository);
  const eligibilityService = new EligibilityService(schemeRepository, householdRepository);
  const guidanceService = new GuidanceService(
    householdRepository,
    eligibilityService,
    schemeRepository
  );
  const connectionRepository = new ConnectionRepository(firestoreInstance);
  const assistanceRepository = new AssistanceRepository(firestoreInstance);
  const caseService = new CaseService(
    caseRepository,
    householdRepository,
    eligibilityService,
    guidanceService,
    userRepository,
    connectionRepository,
    assistanceRepository
  );
  const connectionService = new ConnectionService(
    connectionRepository,
    userRepository,
    householdRepository,
    caseRepository
  );
  const assistanceService = new AssistanceService(
    assistanceRepository,
    connectionRepository,
    householdRepository,
    caseRepository,
    caseService
  );
  const evidenceRepository = new EvidenceRepository(firestoreInstance);
  const evidenceService = new EvidenceService(evidenceRepository, schemeRepository);
  const aiCacheRepository = new AICacheRepository(firestoreInstance);
  const aiContextBuilder = new AIContextBuilder();
  const lyzrService = new LyzrService();
  const intelligenceService = new IntelligenceService(
    householdRepository,
    eligibilityService,
    guidanceService,
    schemeRepository,
    evidenceRepository,
    aiCacheRepository,
    aiContextBuilder,
    lyzrService
  );

  const geminiService = new GeminiService();
  const assistantService = new AssistantService(
    householdRepository,
    eligibilityService,
    guidanceService,
    schemeRepository,
    evidenceRepository,
    aiContextBuilder,
    geminiService,
    caseRepository
  );

  const privilegedAuthService = new PrivilegedAuthService();

  fastify.decorate("userRepository", userRepository);
  fastify.decorate("userService", userService);
  fastify.decorate("privilegedAuthService", privilegedAuthService);
  fastify.decorate("householdRepository", householdRepository);
  fastify.decorate("householdService", householdService);
  fastify.decorate("caseRepository", caseRepository);
  fastify.decorate("caseService", caseService);
  fastify.decorate("connectionRepository", connectionRepository);
  fastify.decorate("connectionService", connectionService);
  fastify.decorate("assistanceRepository", assistanceRepository);
  fastify.decorate("assistanceService", assistanceService);
  fastify.decorate("schemeRepository", schemeRepository);
  fastify.decorate("schemeService", schemeService);
  fastify.decorate("eligibilityService", eligibilityService);
  fastify.decorate("guidanceService", guidanceService);
  fastify.decorate("evidenceRepository", evidenceRepository);
  fastify.decorate("evidenceService", evidenceService);
  fastify.decorate("aiCacheRepository", aiCacheRepository);
  fastify.decorate("aiContextBuilder", aiContextBuilder);
  fastify.decorate("lyzrService", lyzrService);
  fastify.decorate("intelligenceService", intelligenceService);
  fastify.decorate("geminiService", geminiService);
  fastify.decorate("assistantService", assistantService);
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("userProfile", null);

  // Verification preHandler hook
  const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    const correlationId = request.correlationId || "auth-ctx";

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
        success: false,
        error: "Unauthorized",
        message: "Authorization Bearer token required.",
        code: "AUTH_TOKEN_MISSING",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
        success: false,
        error: "Unauthorized",
        message: "Malformed Bearer token.",
        code: "AUTH_TOKEN_INVALID",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    let decodedToken: admin.auth.DecodedIdToken;

    // Test token support for local testing / Vitest mock mode
    if (token.startsWith("test_token_")) {
      const parts = token.replace("test_token_", "").split("_");
      const uid = parts[0] || "test-user-uid";
      decodedToken = {
        uid,
        email: `${uid}@test.swasthyasetu.gov.in`,
        aud: "swasthyasetu",
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: { identities: {}, sign_in_provider: "custom" },
        iat: Math.floor(Date.now() / 1000),
        iss: "https://securetoken.google.com/swasthyasetu",
        sub: uid,
      } as admin.auth.DecodedIdToken;
    } else if (process.env.NODE_ENV === "test") {
      return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
        success: false,
        error: "Unauthorized",
        message: "Invalid or expired authentication token.",
        code: "AUTH_TOKEN_INVALID",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    } else if (fastify.firebaseApp) {
      try {
        decodedToken = await admin.auth(fastify.firebaseApp).verifyIdToken(token);
      } catch (err: unknown) {
        request.log.warn({ err, correlationId }, "Firebase token verification failed");
        return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          error: "Unauthorized",
          message: "Invalid or expired authentication token.",
          code: "AUTH_TOKEN_EXPIRED",
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      return reply.status(503).send({
        success: false,
        error: "ServiceUnavailable",
        message: "Authentication service not configured.",
        code: "AUTH_SERVICE_UNAVAILABLE",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    request.user = decodedToken;

    // Test token role hint resolution for dev / test mode
    let initialRoleHint: UserRole | undefined = undefined;
    if (token.startsWith("test_token_")) {
      const parts = token.replace("test_token_", "").split("_");
      const rolePart = parts[parts.length - 1]?.toUpperCase();
      if (rolePart === "ASHA" || rolePart === "ADMIN" || rolePart === "CITIZEN") {
        initialRoleHint = rolePart as UserRole;
      }
    }

    // For registration endpoint, decode token and look up existing profile without auto-creating CITIZEN.
    // The /auth/register handler will create the profile with the authorized role.
    const isRegisterRoute = request.url.includes("/auth/register");
    if (isRegisterRoute) {
      const existing = await userRepository.getUserById(decodedToken.uid);
      request.userProfile = existing;
      return;
    }

    // Resolve or idempotently create user profile (strictly preserving existing role)
    const { user } = await userService.getOrCreateUser(decodedToken, undefined, initialRoleHint);
    request.userProfile = user;
  };

  fastify.decorate("authenticate", authenticate);
};

export default fp(authPlugin, {
  name: "auth-plugin",
  dependencies: ["firebase-plugin"],
});
