import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { ApiErrorResponse } from "../../shared/types/api.js";
import { AuthMeResponse, AuthSyncResponse } from "../../shared/types/auth.js";

describe("Phase 2: Authentication, Roles & Consent Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    app.userRepository.clearMemoryStore();
  });

  describe("1. Token Verification & Authentication", () => {
    it("Should return 401 when Authorization header is missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_TOKEN_MISSING");
    });

    it("Should return 401 when Bearer token is malformed", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Bearer ",
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_TOKEN_INVALID");
    });

    it("Should authenticate valid token and create default CITIZEN profile", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Bearer test_token_citizen001_citizen",
        },
      });

      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(true);
      const data = payload.data as AuthMeResponse;
      expect(data.user.uid).toBe("citizen001");
      expect(data.user.role).toBe("CITIZEN");
      expect(data.user.consentStatus).toBe("pending");
      expect(data.isConsentRequired).toBe(true);
    });
  });

  describe("2. Idempotent User Sync & Strict Role Preservation", () => {
    it("Should PRESERVE existing ASHA role on sync and never reset to CITIZEN", async () => {
      // 1. Manually setup existing ASHA user
      await app.userRepository.createUserProfile({
        uid: "asha001",
        email: "asha001@health.gov.in",
        displayName: "Sunita ASHA",
        phoneNumber: "+919876543210",
        role: "ASHA",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Call sync endpoint (simulating frontend login sync)
      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: "Bearer test_token_asha001_asha",
        },
        payload: {
          displayName: "Sunita Devi (ASHA Worker)",
        },
      });

      expect(syncRes.statusCode).toBe(200);
      const syncData = JSON.parse(syncRes.payload).data as AuthSyncResponse;
      expect(syncData.isNewUser).toBe(false);
      // STRICT CHECK: Role MUST remain ASHA!
      expect(syncData.user.role).toBe("ASHA");
      expect(syncData.user.displayName).toBe("Sunita Devi (ASHA Worker)");
    });

    it("Should PRESERVE existing ADMIN role on sync and never reset to CITIZEN", async () => {
      // 1. Manually setup existing ADMIN user
      await app.userRepository.createUserProfile({
        uid: "admin001",
        email: "admin001@health.gov.in",
        displayName: "Nodal Officer Admin",
        phoneNumber: null,
        role: "ADMIN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Call sync endpoint
      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: "Bearer test_token_admin001_admin",
        },
      });

      expect(syncRes.statusCode).toBe(200);
      const syncData = JSON.parse(syncRes.payload).data as AuthSyncResponse;
      expect(syncData.isNewUser).toBe(false);
      // STRICT CHECK: Role MUST remain ADMIN!
      expect(syncData.user.role).toBe("ADMIN");
    });

    it("Should PRESERVE existing ASHA role even when malicious requestedRole=CITIZEN is sent on sync", async () => {
      const uid = `real-asha-test-${Date.now()}`;
      await app.userRepository.createUserProfile({
        uid,
        email: "asha.worker@health.gov.in",
        displayName: "Field ASHA Worker",
        phoneNumber: null,
        role: "ASHA",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Field ASHA Worker",
          requestedRole: "CITIZEN",
        },
      });

      expect(syncRes.statusCode).toBe(200);
      const syncData = JSON.parse(syncRes.payload).data as AuthSyncResponse;
      expect(syncData.isNewUser).toBe(false);
      expect(syncData.user.role).toBe("ASHA");
    });

    it("Should PRESERVE existing ADMIN role even when malicious requestedRole=CITIZEN is sent on sync", async () => {
      const uid = `real-admin-test-${Date.now()}`;
      await app.userRepository.createUserProfile({
        uid,
        email: "admin.director@health.gov.in",
        displayName: "State Director Admin",
        phoneNumber: null,
        role: "ADMIN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "State Director Admin",
          requestedRole: "CITIZEN",
        },
      });

      expect(syncRes.statusCode).toBe(200);
      const syncData = JSON.parse(syncRes.payload).data as AuthSyncResponse;
      expect(syncData.isNewUser).toBe(false);
      expect(syncData.user.role).toBe("ADMIN");
    });

    it("Should PRESERVE existing CITIZEN role and prevent promotion without secrets on sync", async () => {
      const uid = `citizen-nopromote-${Date.now()}`;
      await app.userRepository.createUserProfile({
        uid,
        email: "citizen.user@example.com",
        displayName: "Citizen User",
        phoneNumber: null,
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Attempt to self-promote to ADMIN on sync without secret
      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          requestedRole: "ADMIN",
        },
      });

      expect(syncRes.statusCode).toBe(403);
      const body = JSON.parse(syncRes.payload);
      expect(body.success).toBe(false);

      // Verify user document in repository remains CITIZEN
      const userInDb = await app.userRepository.getUserById(uid);
      expect(userInDb?.role).toBe("CITIZEN");
    });
  });

  describe("3. Consent Workflow & History Persistence", () => {
    it("Should enforce consent before granting access to protected health routes", async () => {
      // 1. New user accesses citizen route before giving consent
      const preConsentRes = await app.inject({
        method: "GET",
        url: "/api/v1/test/citizen-only",
        headers: {
          authorization: "Bearer test_token_citizentest_citizen",
        },
      });

      expect(preConsentRes.statusCode).toBe(403);
      const errBody = JSON.parse(preConsentRes.payload) as ApiErrorResponse;
      expect(errBody.code).toBe("CONSENT_REQUIRED");

      // 2. Submit consent
      const consentRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: {
          authorization: "Bearer test_token_citizentest_citizen",
        },
        payload: {
          consentVersion: "1.0",
          accepted: true,
          method: "web_portal",
        },
      });

      expect(consentRes.statusCode).toBe(200);
      const consentData = JSON.parse(consentRes.payload).data;
      expect(consentData.user.consentStatus).toBe("accepted");
      expect(consentData.user.consentVersion).toBe("1.0");
      expect(consentData.isConsentRequired).toBe(false);

      // 3. Access citizen route after giving consent
      const postConsentRes = await app.inject({
        method: "GET",
        url: "/api/v1/test/citizen-only",
        headers: {
          authorization: "Bearer test_token_citizentest_citizen",
        },
      });

      expect(postConsentRes.statusCode).toBe(200);
      expect(JSON.parse(postConsentRes.payload).success).toBe(true);

      // 4. Verify historical audit trail was recorded in consent history
      const history = await app.userService.getConsentHistory("citizentest");
      expect(history.length).toBe(1);
      expect(history[0]?.consentVersion).toBe("1.0");
      expect(history[0]?.accepted).toBe(true);
      expect(history[0]?.method).toBe("web_portal");
    });
  });

  describe("4. Role-Based Authorization Guards", () => {
    beforeEach(async () => {
      // Seed an ASHA user with accepted consent
      await app.userRepository.createUserProfile({
        uid: "ashaworker",
        email: "asha@health.gov.in",
        displayName: "Pooja ASHA",
        phoneNumber: null,
        role: "ASHA",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Seed an ADMIN user
      await app.userRepository.createUserProfile({
        uid: "adminuser",
        email: "admin@health.gov.in",
        displayName: "State Admin",
        phoneNumber: null,
        role: "ADMIN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it("Citizen cannot access ASHA endpoint (403 Forbidden)", async () => {
      // Give citizen consent first
      await app.userService.recordConsent("citizen_unauth", {
        consentVersion: "1.0",
        accepted: true,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/test/asha-only",
        headers: {
          authorization: "Bearer test_token_citizen_unauth_citizen",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload) as ApiErrorResponse;
      expect(body.code).toBe("INSUFFICIENT_ROLE");
    });

    it("Citizen cannot access ADMIN endpoint (403 Forbidden)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/test/admin-only",
        headers: {
          authorization: "Bearer test_token_citizen_unauth_citizen",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload) as ApiErrorResponse;
      expect(body.code).toBe("INSUFFICIENT_ROLE");
    });

    it("ASHA user can access ASHA endpoint (200 OK)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/test/asha-only",
        headers: {
          authorization: "Bearer test_token_ashaworker_asha",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).role).toBe("ASHA");
    });

    it("ASHA user cannot access ADMIN endpoint (403 Forbidden)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/test/admin-only",
        headers: {
          authorization: "Bearer test_token_ashaworker_asha",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload) as ApiErrorResponse;
      expect(body.code).toBe("INSUFFICIENT_ROLE");
    });

    it("Admin user can access ADMIN endpoint (200 OK)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/test/admin-only",
        headers: {
          authorization: "Bearer test_token_adminuser_admin",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).role).toBe("ADMIN");
    });
  });

  describe("5. Role Assignment Security", () => {
    it("Non-admin (Citizen or ASHA) cannot call role assignment (403 Forbidden)", async () => {
      const citizenRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/role/assign",
        headers: {
          authorization: "Bearer test_token_citizen_escalator_citizen",
        },
        payload: {
          targetUid: "citizen_escalator",
          newRole: "ADMIN",
        },
      });

      expect(citizenRes.statusCode).toBe(403);
      const err = JSON.parse(citizenRes.payload) as ApiErrorResponse;
      expect(err.code).toBe("INSUFFICIENT_ROLE");
    });

    it("Authorized Admin can assign ASHA role to a target user", async () => {
      // Setup admin and target citizen
      await app.userRepository.createUserProfile({
        uid: "superadmin",
        email: "superadmin@gov.in",
        displayName: "Super Admin",
        phoneNumber: null,
        role: "ADMIN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await app.userRepository.createUserProfile({
        uid: "promoted_asha",
        email: "promoted@gov.in",
        displayName: "Anjali",
        phoneNumber: null,
        role: "CITIZEN",
        consentStatus: "accepted",
        consentVersion: "1.0",
        consentedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const assignRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/role/assign",
        headers: {
          authorization: "Bearer test_token_superadmin_admin",
        },
        payload: {
          targetUid: "promoted_asha",
          newRole: "ASHA",
        },
      });

      expect(assignRes.statusCode).toBe(200);
      const assigned = JSON.parse(assignRes.payload).data;
      expect(assigned.user.role).toBe("ASHA");

      // Verify in repository
      const targetUser = await app.userRepository.getUserById("promoted_asha");
      expect(targetUser?.role).toBe("ASHA");
    });
  });
});
