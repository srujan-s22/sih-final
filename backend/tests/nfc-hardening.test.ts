import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import crypto from "node:crypto";
import {
  buildNfcUrl,
  getPublicOrigin,
  writeNfcTag,
} from "../../frontend/lib/nfc/nfc-writer.js";
import { parseNfcCredential } from "../../frontend/lib/nfc/nfc-parser.js";

const getGlobal = (): Record<string, any> => globalThis as Record<string, any>;

describe("Phase 2 Hardening: NFC Rotation Failure Safety & Dynamic URL Resolution", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_asha101_asha";
  const householdId = "hh_hardening_test_001";

  const establishConsent = async (token: string) => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        consentVersion: "1.0",
        accepted: true,
      },
    });
  };

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    const now = new Date().toISOString();

    const testHousehold: Household = {
      id: householdId,
      ownerUid: "citizen_hard_01",
      headOfHouseholdName: "Mohan Lal",
      rationCardNumber: "RC-KA-HARD-01",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Ramanagara",
      village: "Harohalli",
      pincode: "562112",
      contactPhone: "9876543210",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHousehold);

    const testCase: AshaCase = {
      id: "case_hard_001",
      householdId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: "Mohan Lal",
      district: "Ramanagara",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 1,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(testCase);
  });

  // =========================================================================
  // ISSUE 1: NFC ROTATION FAILURE SAFETY (10 TESTS)
  // =========================================================================
  describe("Issue 1 — NFC Rotation Failure Safety", () => {
    it("TEST 1: rotateNfc creates PENDING_WRITE credential while active credential remains ACTIVE", async () => {
      await establishConsent(ashaToken);

      // 1. Initial provision (Version 1)
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // 2. Rotate to Version 2
      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { reason: "Card replacement test" },
      });
      expect(rotRes.statusCode).toBe(HTTP_STATUS.OK);

      // Verify repository records directly
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
      expect(activeRecord).toBeDefined();
      expect(activeRecord!.version).toBe(1);
      expect(activeRecord!.status).toBe("ACTIVE");

      const pendingRecord = await app.nfcRepository.getPendingByHouseholdId(householdId);
      expect(pendingRecord).toBeDefined();
      expect(pendingRecord!.version).toBe(2);
      expect(pendingRecord!.status).toBe("PENDING_WRITE");
    });

    it("TEST 2: resolving tag before rotation confirmation still succeeds using active credential (v1)", async () => {
      await establishConsent(ashaToken);

      // 1. Provision v1
      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token1 = JSON.parse(pRes.payload).data.token;

      // 2. Initiate rotate (creates pending v2)
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // 3. Resolve using token1 - MUST succeed
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token1 },
      });
      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(JSON.parse(resolveRes.payload).data.household.displayName).toBe("Mohan Lal");
    });

    it("TEST 3: resolving tag using pending credential (v2) fails with 401 before confirmation", async () => {
      await establishConsent(ashaToken);

      // 1. Provision v1
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // 2. Initiate rotate (token2 is returned to ASHA)
      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token2 = JSON.parse(rotRes.payload).data.token;

      // 3. Try resolving token2 before physical write confirm - MUST fail
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token2 },
      });
      expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it("TEST 4: successful write + POST /rotate/confirm revokes v1 and activates v2", async () => {
      await establishConsent(ashaToken);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { nfcId, version } = JSON.parse(rotRes.payload).data;

      // Confirm rotation
      const confirmRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId, version, reason: "Physical write verified" },
      });

      expect(confirmRes.statusCode).toBe(HTTP_STATUS.OK);
      const confirmBody = JSON.parse(confirmRes.payload);
      expect(confirmBody.success).toBe(true);
      expect(confirmBody.data.status).toBe("ACTIVE");
      expect(confirmBody.data.version).toBe(2);

      // In repository: active is now v2, pending is null
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
      expect(activeRecord!.version).toBe(2);
      expect(activeRecord!.status).toBe("ACTIVE");

      const pendingRecord = await app.nfcRepository.getPendingByHouseholdId(householdId);
      expect(pendingRecord).toBeNull();
    });

    it("TEST 5: after confirm, v1 resolves to 401 and v2 resolves to 200", async () => {
      await establishConsent(ashaToken);

      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token1 = JSON.parse(pRes.payload).data.token;

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { token: token2, nfcId, version } = JSON.parse(rotRes.payload).data;

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId, version },
      });

      // Token 1 is now dead
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token1 },
      });
      expect(res1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

      // Token 2 is alive
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token2 },
      });
      expect(res2.statusCode).toBe(HTTP_STATUS.OK);
    });

    it("TEST 6: failed write + POST /rotate/cancel revokes v2 and leaves v1 ACTIVE", async () => {
      await establishConsent(ashaToken);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { nfcId } = JSON.parse(rotRes.payload).data;

      // Cancel rotation
      const cancelRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/cancel`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId, reason: "Phone lost NFC connection" },
      });

      expect(cancelRes.statusCode).toBe(HTTP_STATUS.OK);
      const cancelBody = JSON.parse(cancelRes.payload);
      expect(cancelBody.success).toBe(true);
      expect(cancelBody.data.activeVersion).toBe(1);

      // Active is still v1
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
      expect(activeRecord!.version).toBe(1);
      expect(activeRecord!.status).toBe("ACTIVE");

      // Pending is cleared
      const pendingRecord = await app.nfcRepository.getPendingByHouseholdId(householdId);
      expect(pendingRecord).toBeNull();
    });

    it("TEST 7: after cancel, v1 continues resolving to 200 and v2 resolves to 401", async () => {
      await establishConsent(ashaToken);

      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token1 = JSON.parse(pRes.payload).data.token;

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { token: token2, nfcId } = JSON.parse(rotRes.payload).data;

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/cancel`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId },
      });

      // v1 remains working
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token1 },
      });
      expect(res1.statusCode).toBe(HTTP_STATUS.OK);

      // v2 is invalid
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: token2 },
      });
      expect(res2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it("TEST 8: superseding pending rotation cleans up old pending and creates new pending v3", async () => {
      await establishConsent(ashaToken);

      // Provision v1
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // Rotate to v2 (pending)
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // Rotate again without confirming v2 -> supersedes v2 with v3
      const rotRes2 = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      expect(rotRes2.statusCode).toBe(HTTP_STATUS.OK);
      const { version: v3 } = JSON.parse(rotRes2.payload).data;
      expect(v3).toBe(3);

      const pendingRecord = await app.nfcRepository.getPendingByHouseholdId(householdId);
      expect(pendingRecord!.version).toBe(3);
      expect(pendingRecord!.status).toBe("PENDING_WRITE");

      // Active is still v1
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
      expect(activeRecord!.version).toBe(1);
    });

    it("TEST 9: confirm with wrong version / wrong nfcId fails with 409 / 400", async () => {
      await establishConsent(ashaToken);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { nfcId } = JSON.parse(rotRes.payload).data;

      // Bad version
      const badVersionRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId, version: 99 },
      });
      expect(badVersionRes.statusCode).toBe(HTTP_STATUS.CONFLICT);

      // Bad nfcId
      const badIdRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId: "nfc_fake_id", version: 2 },
      });
      expect(badIdRes.statusCode).toBe(HTTP_STATUS.CONFLICT);
    });

    it("TEST 10: status endpoint reflects active credential and pending replacement metadata", async () => {
      await establishConsent(ashaToken);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      const statusRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      expect(statusRes.statusCode).toBe(HTTP_STATUS.OK);
      const statusBody = JSON.parse(statusRes.payload).data;
      expect(statusBody.hasActiveNfc).toBe(true);
      expect(statusBody.record.version).toBe(1);
      expect(statusBody.pendingReplacement).toBeDefined();
      expect(statusBody.pendingReplacement.version).toBe(2);
    });
  });

  // =========================================================================
  // ISSUE 2: CONFIGURED PRODUCTION NFC URL (7 TESTS)
  // =========================================================================
  describe("Issue 2 — Configured Production NFC URL & Origin Resolution", () => {
    const originalEnv = { ...process.env };
    const originalWindow = getGlobal().window;

    beforeEach(() => {
      // Clear URL env vars for isolated test assertions
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete getGlobal().window;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      if (originalWindow !== undefined) {
        getGlobal().window = originalWindow;
      } else {
        delete getGlobal().window;
      }
    });

    it("TEST 1: customOrigin parameter takes highest precedence", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://env-domain.gov.in";
      const origin = getPublicOrigin("https://custom-domain.org");
      expect(origin).toBe("https://custom-domain.org");

      const url = buildNfcUrl("hh_1", "tok", "https://custom-domain.org");
      expect(url).toContain("https://custom-domain.org/nfc?");
    });

    it("TEST 2: NEXT_PUBLIC_SITE_URL environment variable is used when present", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://swasthyasetu.karnataka.gov.in";
      const origin = getPublicOrigin();
      expect(origin).toBe("https://swasthyasetu.karnataka.gov.in");

      const url = buildNfcUrl("hh_1", "tok");
      expect(url).toBe("https://swasthyasetu.karnataka.gov.in/nfc?hh=hh_1&t=tok");
      expect(url).not.toContain("&v=1");
    });

    it("TEST 3: NEXT_PUBLIC_APP_URL environment variable is used when NEXT_PUBLIC_SITE_URL is absent", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_APP_URL = "https://app.swasthyasetu.org";
      const origin = getPublicOrigin();
      expect(origin).toBe("https://app.swasthyasetu.org");
    });

    it("TEST 4: NEXT_PUBLIC_VERCEL_URL is formatted with https:// when window is undefined", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete getGlobal().window;
      process.env.NEXT_PUBLIC_VERCEL_URL = "swasthyasetu-preview.vercel.app";

      const origin = getPublicOrigin();
      expect(origin).toBe("https://swasthyasetu-preview.vercel.app");
    });

    it("TEST 5: window.location.origin is prioritized over NEXT_PUBLIC_VERCEL_URL on client-side", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_VERCEL_URL = "long-preview-branch-name-12345.vercel.app";

      getGlobal().window = {
        location: {
          origin: "https://sih-final-frontend-ten.vercel.app",
        },
      };

      // In the browser, window.location.origin MUST win over long Vercel branch/preview URLs
      const origin = getPublicOrigin();
      expect(origin).toBe("https://sih-final-frontend-ten.vercel.app");
      expect(origin).not.toContain("long-preview-branch-name");
    });

    it("TEST 6: development localhost fallback is used in non-production environments", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete getGlobal().window;
      process.env.NODE_ENV = "test";

      const origin = getPublicOrigin();
      expect(origin).toBe("http://localhost:3000");
    });

    it("TEST 7: throws explicit error in production when no origin is configured and window is undefined (SSR safety)", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete getGlobal().window;
      process.env.NODE_ENV = "production";

      expect(() => getPublicOrigin()).toThrow("NFC URL generation failed: No public site origin configured");
    });

    it("TEST 8: buildNfcUrl omits &v=1 for version 1 but preserves &v=2 for higher versions", () => {
      const urlV1 = buildNfcUrl("hh_123", "tok_abc", "https://swasthyasetu.org", 1);
      expect(urlV1).toBe("https://swasthyasetu.org/nfc?hh=hh_123&t=tok_abc");
      expect(urlV1).not.toContain("&v=");

      const urlV2 = buildNfcUrl("hh_123", "tok_abc", "https://swasthyasetu.org", 2);
      expect(urlV2).toBe("https://swasthyasetu.org/nfc?hh=hh_123&t=tok_abc&v=2");
    });

    it("TEST 9: generated production NDEF URI message size is comfortably below 117 bytes", () => {
      // Real production values:
      // Canonical origin: https://sih-final-frontend-ten.vercel.app (41 chars)
      // Field household ID: hh_1789034000000_a8b9c (22 chars)
      // Real token: crypto.randomBytes(32).toString("base64url") (43 chars)
      const canonicalOrigin = "https://sih-final-frontend-ten.vercel.app";
      const householdId = "hh_1789034000000_a8b9c";
      const token = crypto.randomBytes(32).toString("base64url");
      expect(token.length).toBe(43);

      const url = buildNfcUrl(householdId, token, canonicalOrigin, 1);
      expect(url).not.toContain("&v=1");
      expect(url.length).toBe(117);

      // In Chromium / W3C NFC Forum Well-Known URI record (RTD_URI):
      // https:// is compressed to 1 prefix byte (0x04)
      const uriWithoutScheme = url.replace(/^https:\/\//, "");
      const payloadBytes = 1 + new TextEncoder().encode(uriWithoutScheme).length;
      const ndefMessageBytes = 4 + payloadBytes; // 4 bytes short-record header (0xD1, 0x01, len, 0x55)

      // Must be strictly below 117 bytes (usable capacity of standard 120-byte CC NTAG213 tags)
      expect(ndefMessageBytes).toBe(114);
      expect(ndefMessageBytes).toBeLessThan(117);

      // Total Type 2 Tag storage required (with 3-byte TLV wrapper: 0x03, len, 0xFE)
      const totalTagBytes = ndefMessageBytes + 3;
      expect(totalTagBytes).toBe(117);
      expect(totalTagBytes).toBeLessThanOrEqual(120);
    });

    it("TEST 10: parser still accepts the resulting production URL without v parameter", () => {
      const canonicalOrigin = "https://sih-final-frontend-ten.vercel.app";
      const householdId = "hh_1789034000000_a8b9c";
      const token = crypto.randomBytes(32).toString("base64url");

      const url = buildNfcUrl(householdId, token, canonicalOrigin, 1);
      const parsedUrl = new URL(url);
      const parseResult = parseNfcCredential(parsedUrl.search);

      expect(parseResult.status).toBe("VALID");
      if (parseResult.status === "VALID") {
        expect(parseResult.credential.householdId).toBe(householdId);
        expect(parseResult.credential.token).toBe(token);
        expect(parseResult.credential.version).toBeUndefined();
      }
    });

    it("TEST 11: writeNfcTag error handling sanitizes errors and never leaks raw tokens", async () => {
      const secretToken = "super_secret_token_1234567890abcdef";
      const url = buildNfcUrl("hh_test_123", secretToken, "https://swasthyasetu.org", 1);

      // Mock NDEFReader to throw a NetworkError with sensitive details in message
      const originalWindow = getGlobal().window;
      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          async write() {
            const err = new Error(`Failed to write due to an IO error: null for ${url}`);
            err.name = "NetworkError";
            throw err;
          }
        },
      };

      const result = await writeNfcTag(url);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Verify raw token, query parameters, or internal paths are never leaked in error messages
      expect(result.error).not.toContain(secretToken);
      expect(result.error).not.toContain("hh_test_123");
      expect(result.error).not.toContain("?");
      expect(result.error).toContain("NFC communication was interrupted");

      if (originalWindow) {
        getGlobal().window = originalWindow;
      } else {
        delete getGlobal().window;
      }
    });
  });
});
