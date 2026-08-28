import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { PrivilegedAuthService } from "../src/services/privileged-auth.service.js";
import { hashSecret, verifySecretHash } from "../src/utils/secret-hash.js";
import { HTTP_STATUS } from "../src/config/constants.js";

const SAFE_INVALID_CODE_MSG = "Staff registration could not be completed. Please verify your authorization code.";
const SAFE_UNAVAILABLE_MSG = "Privileged account registration is currently unavailable.";

describe("Privileged Account Provisioning & Security Tests", () => {
  let app: FastifyInstance;
  const ASHA_SECRET = "ValidAshaCode2026!";
  const ADMIN_SECRET = "ValidAdminCode2026!";
  const ASHA_HASH = hashSecret(ASHA_SECRET);
  const ADMIN_HASH = hashSecret(ADMIN_SECRET);

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
    // Inject test hashes into PrivilegedAuthService
    app.privilegedAuthService.setHashes(ASHA_HASH, ADMIN_HASH);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("1. Secret Hash Utility Tests", () => {
    it("computes deterministic SHA-256 hash", () => {
      const hash1 = hashSecret("test-secret");
      const hash2 = hashSecret("test-secret");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("verifies matching secret and rejects mismatched secret", () => {
      const hash = hashSecret("SuperSecret123");
      expect(verifySecretHash("SuperSecret123", hash)).toBe(true);
      expect(verifySecretHash("WrongSecret", hash)).toBe(false);
      expect(verifySecretHash("", hash)).toBe(false);
      expect(verifySecretHash(undefined, hash)).toBe(false);
      expect(verifySecretHash("SuperSecret123", undefined)).toBe(false);
    });
  });

  describe("2. Citizen Account Registration Tests", () => {
    it("allows citizen to register without any privileged secret", async () => {
      const uid = `cit-test-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}_cit`,
        },
        payload: {
          displayName: "Citizen Ramesh",
          requestedRole: "CITIZEN",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("CITIZEN");
      expect(body.data.user.displayName).toBe("Citizen Ramesh");
    });

    it("defaults to CITIZEN role when requestedRole is omitted", async () => {
      const uid = `cit-default-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer test_token_${uid}_default`,
        },
        payload: {
          displayName: "Default Citizen",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.data.user.role).toBe("CITIZEN");
    });

    it("prevents citizen from obtaining ASHA role without secret", async () => {
      const uid = `cit-unauth-asha-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Fake ASHA",
          requestedRole: "ASHA",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("prevents citizen from obtaining ADMIN role without secret", async () => {
      const uid = `cit-unauth-admin-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Fake Admin",
          requestedRole: "ADMIN",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });
  });

  describe("3. ASHA Account Registration Tests", () => {
    it("successfully creates ASHA account with valid ASHA registration secret", async () => {
      const uid = `asha-valid-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Sunita ASHA Worker",
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("ASHA");
      expect(body.data.user.displayName).toBe("Sunita ASHA Worker");
    });

    it("rejects ASHA registration with incorrect secret", async () => {
      const uid = `asha-invalid-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Sunita ASHA Worker",
          requestedRole: "ASHA",
          registrationSecret: "WrongSecretCode!",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("fails closed when ASHA secret hash is unconfigured", async () => {
      app.privilegedAuthService.setHashes(undefined, ADMIN_HASH);

      const uid = `asha-unconfigured-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Sunita ASHA",
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_UNAVAILABLE_MSG);
    });

    it("cannot use ASHA secret to register as ADMIN", async () => {
      const uid = `asha-cross-admin-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Cross Role Attacker",
          requestedRole: "ADMIN",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });
  });

  describe("4. Admin Account Registration Tests", () => {
    it("successfully creates Admin account with valid Admin registration secret", async () => {
      const uid = `admin-valid-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Platform Admin",
          requestedRole: "ADMIN",
          registrationSecret: ADMIN_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("ADMIN");
      expect(body.data.user.displayName).toBe("Platform Admin");
    });

    it("rejects Admin registration with incorrect secret", async () => {
      const uid = `admin-invalid-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Fake Admin",
          requestedRole: "ADMIN",
          registrationSecret: "WrongAdminCode!",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("fails closed when Admin secret hash is unconfigured", async () => {
      app.privilegedAuthService.setHashes(ASHA_HASH, undefined);

      const uid = `admin-unconfigured-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Platform Admin",
          requestedRole: "ADMIN",
          registrationSecret: ADMIN_SECRET,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_UNAVAILABLE_MSG);
    });

    it("cannot use Admin secret to register as ASHA", async () => {
      const uid = `admin-cross-asha-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Cross Role Admin",
          requestedRole: "ASHA",
          registrationSecret: ADMIN_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });
  });

  describe("5. Security & Invariant Tests", () => {
    it("rejects arbitrary / unknown role requests", async () => {
      const uid = `arbitrary-role-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Hacker",
          requestedRole: "SUPER_ADMIN",
          registrationSecret: "any",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it("never echoes registrationSecret or hashes in responses", async () => {
      const uid = `secret-echo-check-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer test_token_${uid}`,
        },
        payload: {
          displayName: "Security Auditor",
          requestedRole: "ADMIN",
          registrationSecret: ADMIN_SECRET,
        },
      });

      const raw = res.body;
      expect(raw).not.toContain(ADMIN_SECRET);
      expect(raw).not.toContain(ADMIN_HASH);
      expect(raw).not.toContain(ASHA_HASH);
    });

    it("enforces rate-limiting on repeated failed privileged registration attempts", async () => {
      const service = new PrivilegedAuthService(ASHA_HASH, ADMIN_HASH);
      const testIp = "192.168.1.100";

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        const result = service.verifyPrivilegedRole("ADMIN", "wrong-code", testIp);
        expect(result.allowed).toBe(false);
        expect(result.statusCode).toBe(403);
      }

      // 6th attempt should be rate limited (429)
      const rateLimitedResult = service.verifyPrivilegedRole("ADMIN", "wrong-code", testIp);
      expect(rateLimitedResult.allowed).toBe(false);
      expect(rateLimitedResult.statusCode).toBe(429);
      expect(rateLimitedResult.error).toContain("Too many failed privileged registration attempts");
    });
  });

  describe("6. Role Propagation & Authorization Invariant Tests", () => {
    it("resolves ASHA role correctly from authenticated session token", async () => {
      const uid = `asha-resolve-${Date.now()}`;
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer test_token_${uid}_asha`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("ASHA");
    });

    it("resolves ADMIN role correctly from authenticated session token", async () => {
      const uid = `admin-resolve-${Date.now()}`;
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer test_token_${uid}_admin`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("ADMIN");
    });

    it("resolves CITIZEN role correctly from authenticated session token", async () => {
      const uid = `citizen-resolve-${Date.now()}`;
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer test_token_${uid}_citizen`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe("CITIZEN");
    });

    it("rejects CITIZEN role when accessing admin-only endpoint", async () => {
      const uid = `cit-to-admin-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/role/assign",
        headers: {
          authorization: `Bearer test_token_${uid}_citizen`,
        },
        payload: {
          targetUid: "target-user-01",
          newRole: "ASHA",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Forbidden");
    });

    it("rejects ASHA role when accessing admin-only endpoint", async () => {
      const uid = `asha-to-admin-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/role/assign",
        headers: {
          authorization: `Bearer test_token_${uid}_asha`,
        },
        payload: {
          targetUid: "target-user-02",
          newRole: "ADMIN",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Forbidden");
    });
  });

  describe("7. Pre-Validation Endpoint Security Tests (Pre-Account Creation)", () => {
    it("successfully pre-validates ASHA role with correct secret code", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.allowed).toBe(true);
      expect(body.data.role).toBe("ASHA");
    });

    it("rejects ASHA pre-validation with incorrect secret code", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ASHA",
          registrationSecret: "WrongAshaCode!",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("successfully pre-validates ADMIN role with correct secret code", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ADMIN",
          registrationSecret: ADMIN_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.allowed).toBe(true);
      expect(body.data.role).toBe("ADMIN");
    });

    it("rejects ADMIN pre-validation with incorrect secret code", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ADMIN",
          registrationSecret: "WrongAdminCode!",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("allows CITIZEN pre-validation without secret", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "CITIZEN",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.allowed).toBe(true);
      expect(body.data.role).toBe("CITIZEN");
    });

    it("rejects cross-role secret in pre-validation (ASHA code for ADMIN)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ADMIN",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_INVALID_CODE_MSG);
    });

    it("fails closed in pre-validation if secret hash is unconfigured", async () => {
      app.privilegedAuthService.setHashes(undefined, ADMIN_HASH);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/prevalidate",
        payload: {
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe(SAFE_UNAVAILABLE_MSG);
    });
  });

  describe("8. End-to-End Registration Lifecycle & Role Persistence Tests", () => {
    it("creates ASHA profile on first write when registering via /auth/register", async () => {
      const uid = `brand-new-asha-${Date.now()}`;
      const token = `test_token_${uid}`;

      // 1. Send registration request
      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          displayName: "Sunita ASHA",
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(regRes.statusCode).toBe(HTTP_STATUS.OK);
      const regBody = regRes.json();
      expect(regBody.success).toBe(true);
      expect(regBody.data.user.role).toBe("ASHA");

      // 2. Verify stored profile directly in database
      const stored = await app.userRepository.getUserById(uid);
      expect(stored).not.toBeNull();
      expect(stored?.role).toBe("ASHA");

      // 3. Subsequent normal login /sync preserves ASHA role
      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      expect(syncRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(syncRes.json().data.user.role).toBe("ASHA");

      // 4. /auth/me returns ASHA
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(meRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(meRes.json().data.user.role).toBe("ASHA");
    });

    it("promotes an existing CITIZEN profile to ASHA upon valid /auth/register submission", async () => {
      const uid = `citizen-to-promote-${Date.now()}`;
      const token = `test_token_${uid}`;

      // 1. Initial citizen creation
      await app.userRepository.createUserProfile({
        uid,
        email: `${uid}@test.swasthyasetu.gov.in`,
        displayName: "Citizen User",
        phoneNumber: null,
        role: "CITIZEN",
        consentStatus: "pending",
        consentVersion: null,
        consentedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Submit verified ASHA registration
      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          requestedRole: "ASHA",
          registrationSecret: ASHA_SECRET,
        },
      });

      expect(regRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(regRes.json().data.user.role).toBe("ASHA");

      // 3. Stored profile is now ASHA
      const stored = await app.userRepository.getUserById(uid);
      expect(stored?.role).toBe("ASHA");
    });

    it("creates ADMIN profile on first write and persists across normal syncs", async () => {
      const uid = `brand-new-admin-${Date.now()}`;
      const token = `test_token_${uid}`;

      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          displayName: "System Admin",
          requestedRole: "ADMIN",
          registrationSecret: ADMIN_SECRET,
        },
      });

      expect(regRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(regRes.json().data.user.role).toBe("ADMIN");

      const stored = await app.userRepository.getUserById(uid);
      expect(stored?.role).toBe("ADMIN");

      // Normal sync preserves ADMIN
      const syncRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sync",
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      expect(syncRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(syncRes.json().data.user.role).toBe("ADMIN");
    });
  });
});
