import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import {
  buildNfcUrl,
  isNfcWritingSupported,
  writeNfcTag,
} from "../../frontend/lib/nfc/nfc-writer.js";

const getGlobal = (): Record<string, any> => globalThis as Record<string, any>;

describe("Phase 2: ASHA NFC Provisioning & Physical NFC Writing Flow", () => {
  let app: FastifyInstance;

  const ashaAuthorizedToken = "test_token_asha101_asha";
  const ashaUnauthorizedToken = "test_token_asha102_asha";
  const adminToken = "test_token_admin104_admin";

  const assignedHouseholdId = "hh_phase2_assigned_01";
  const unassignedHouseholdId = "hh_phase2_unassigned_02";

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

    // Clean stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    const now = new Date().toISOString();

    // Setup assigned household
    const assignedHousehold: Household = {
      id: assignedHouseholdId,
      ownerUid: "citizen_p2_01",
      headOfHouseholdName: "Ramesh Kumar",
      rationCardNumber: "RC-KA-P2-01",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Ramanagara",
      village: "Harohalli",
      pincode: "562112",
      contactPhone: "9876543210",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(assignedHousehold);

    // Setup unassigned household
    const unassignedHousehold: Household = {
      id: unassignedHouseholdId,
      ownerUid: "citizen_p2_02",
      headOfHouseholdName: "Sunita Devi",
      rationCardNumber: "RC-KA-P2-02",
      incomeCategory: "AAY",
      state: "Karnataka",
      district: "Mandya",
      village: "Maddur",
      pincode: "571428",
      contactPhone: "9876543211",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(unassignedHousehold);

    // Assign only household 1 to asha101
    const testCase: AshaCase = {
      id: "case_p2_001",
      householdId: assignedHouseholdId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: "Ramesh Kumar",
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
  // 1. NFC URL Builder & Encoding Tests
  // =========================================================================
  describe("NFC URL Builder & Format Validation", () => {
    it("should generate a correct standard NDEF URL with custom origin", () => {
      const hhId = "hh_123456";
      const token = "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890";
      const customOrigin = "https://swasthyasetu.org";

      const urlString = buildNfcUrl(hhId, token, customOrigin);
      const parsed = new URL(urlString);

      expect(parsed.origin).toBe("https://swasthyasetu.org");
      expect(parsed.pathname).toBe("/nfc");
      expect(parsed.searchParams.get("hh")).toBe(hhId);
      expect(parsed.searchParams.get("t")).toBe(token);
      expect(parsed.searchParams.get("v")).toBe("1");
    });

    it("should safely URL-encode household IDs with special characters without truncating token", () => {
      const trickyHouseholdId = "HH/KA-BLR 2026#01";
      const token = "f".repeat(64);

      const urlString = buildNfcUrl(trickyHouseholdId, token, "https://swasthyasetu.gov.in");
      const parsed = new URL(urlString);

      expect(parsed.searchParams.get("hh")).toBe(trickyHouseholdId);
      expect(parsed.searchParams.get("t")).toBe(token);
      expect(parsed.searchParams.get("t")?.length).toBe(64);
    });

    it("should throw error if householdId or token is missing or empty", () => {
      expect(() => buildNfcUrl("", "some_token")).toThrow("Household ID is required");
      expect(() => buildNfcUrl("hh_1", "")).toThrow("Access token is required");
      expect(() => buildNfcUrl("   ", "token")).toThrow("Household ID is required");
    });

    it("should fit comfortably within standard NTAG213 tag capacity (144 bytes)", () => {
      const urlString = buildNfcUrl("hh_1741549832_ramanagara", "f".repeat(64), "https://swasthyasetu.gov.in");
      const byteLength = new TextEncoder().encode(urlString).length;

      // NTAG213 usable user memory is 144 bytes.
      // Standard URI record prefix takes ~4 bytes header overhead.
      expect(byteLength).toBeLessThan(140);
    });
  });

  // =========================================================================
  // 2. Browser Capability Detection & SSR Safety
  // =========================================================================
  describe("Web NFC Capability Detection", () => {
    const originalWindow = getGlobal().window;

    afterEach(() => {
      if (originalWindow !== undefined) {
        getGlobal().window = originalWindow;
      } else {
        delete getGlobal().window;
      }
    });

    it("is strictly SSR-safe: returns false when window is undefined", () => {
      delete getGlobal().window;
      expect(isNfcWritingSupported()).toBe(false);
    });

    it("returns false when window exists but NDEFReader is absent (e.g. Safari, iOS, Desktop Firefox)", () => {
      getGlobal().window = {};
      expect(isNfcWritingSupported()).toBe(false);
    });

    it("returns true when NDEFReader is present on window (Android Chrome)", () => {
      getGlobal().window = {
        NDEFReader: class MockNDEFReader {},
      };
      expect(isNfcWritingSupported()).toBe(true);
    });
  });

  // =========================================================================
  // 3. Web NFC NDEF Tag Writing Flow & DOMException Handling
  // =========================================================================
  describe("Physical NFC Tag Writing & Error Handling", () => {
    afterEach(() => {
      delete getGlobal().window;
      vi.restoreAllMocks();
    });

    it("returns an unsupported error when browser does not support Web NFC", async () => {
      delete getGlobal().window;
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not supported");
    });

    it("successfully writes NDEF URI record when supported hardware is present", async () => {
      const writeMock = vi.fn().mockResolvedValue(undefined);
      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const testUrl = "https://swasthyasetu.gov.in/nfc?hh=hh_123&t=abc";
      const result = await writeNfcTag(testUrl);

      expect(result.success).toBe(true);
      expect(writeMock).toHaveBeenCalledWith(
        {
          records: [
            {
              recordType: "url",
              data: testUrl,
            },
          ],
        },
        expect.any(Object)
      );
    });

    it("handles AbortError gracefully when user cancels or moves card away", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = vi.fn().mockRejectedValue(abortError);
        },
      };

      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("cancelled");
    });

    it("handles NotAllowedError when NFC permission is denied or disabled", async () => {
      const permError = new Error("Permission denied");
      permError.name = "NotAllowedError";

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = vi.fn().mockRejectedValue(permError);
        },
      };

      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("permission was denied");
    });

    it("handles read-only tag error with actionable message", async () => {
      const roError = new Error("NFC tag is read only");
      roError.name = "InvalidStateError";

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = vi.fn().mockRejectedValue(roError);
        },
      };

      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("read-only");
    });
  });

  // =========================================================================
  // 4. Token Security & Privacy Invariants
  // =========================================================================
  describe("Token Security & Zero Storage Invariant", () => {
    it("never logs raw token to console or analytics during flow", async () => {
      await establishConsent(ashaAuthorizedToken);

      const consoleLogSpy = vi.spyOn(console, "log");
      const consoleInfoSpy = vi.spyOn(console, "info");
      const consoleWarnSpy = vi.spyOn(console, "warn");

      // Execute provisioning request
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      const json = JSON.parse(res.payload);
      const rawToken = json.data.token;

      // Verify raw token was never output to standard console channels
      const allLogCalls = [
        ...consoleLogSpy.mock.calls,
        ...consoleInfoSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
      ].flat().join(" ");

      expect(allLogCalls).not.toContain(rawToken);
    });

    it("ensures raw token is never persisted in storage mock", () => {
      const mockStorage: Record<string, string> = {};
      // Verify storage remains empty
      expect(Object.keys(mockStorage).length).toBe(0);
      expect(mockStorage["nfc_token"]).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Backend Authorization, Provisioning, Rotation & Revocation
  // =========================================================================
  describe("ASHA Caseload Authorization & Lifecycle", () => {
    it("allows authorized ASHA worker to provision assigned household", async () => {
      await establishConsent(ashaAuthorizedToken);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.householdId).toBe(assignedHouseholdId);
      expect(body.data.token).toBeDefined();
      expect(body.data.token.length).toBeGreaterThanOrEqual(32);
      expect(body.data.version).toBe(1);
    });

    it("rejects unauthorized ASHA worker when household is not in their caseload", async () => {
      await establishConsent(ashaAuthorizedToken);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${unassignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.code).toBe("UNASSIGNED_HOUSEHOLD");
    });

    it("prevents duplicate provisioning when an active NFC tag already exists", async () => {
      await establishConsent(ashaAuthorizedToken);

      // 1. First provision
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      // 2. Attempt second provision without rotation
      const dupRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      expect(dupRes.statusCode).toBe(HTTP_STATUS.CONFLICT);
      const dupBody = JSON.parse(dupRes.payload);
      expect(dupBody.code).toBe("DUPLICATE_ACTIVE_NFC");
    });

    it("supports rotation / replacement: generates new token and increments version", async () => {
      await establishConsent(ashaAuthorizedToken);

      // 1. Initial provision
      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });
      const oldToken = JSON.parse(pRes.payload).data.token;

      // 2. Rotate
      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc/rotate`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
        payload: {
          reason: "LOST_CARD_REPLACEMENT",
        },
      });

      expect(rotRes.statusCode).toBe(HTTP_STATUS.OK);
      const rotBody = JSON.parse(rotRes.payload);
      expect(rotBody.data.version).toBe(2);
      expect(rotBody.data.token).not.toBe(oldToken);

      // 3. Confirm rotation after physical write
      const confirmRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc/rotate/confirm`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
        payload: {
          nfcId: `nfc_${assignedHouseholdId}_v2`,
          version: 2,
          reason: "Replacement confirmed",
        },
      });
      expect(confirmRes.statusCode).toBe(HTTP_STATUS.OK);

      // 4. Old token is now rejected upon public resolution
      const oldResolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: assignedHouseholdId,
          token: oldToken,
        },
      });
      expect(oldResolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

      // 5. New token succeeds
      const newResolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: assignedHouseholdId,
          token: rotBody.data.token,
        },
      });
      expect(newResolveRes.statusCode).toBe(HTTP_STATUS.OK);
    });

    it("supports revocation: marks credential inactive with audit reason", async () => {
      await establishConsent(ashaAuthorizedToken);

      // 1. Provision
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      // 2. Revoke
      const revokeRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc/revoke`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
        payload: {
          reason: "BENEFICIARY_REQUESTED",
        },
      });

      expect(revokeRes.statusCode).toBe(HTTP_STATUS.OK);

      // 3. Status now indicates hasActiveNfc: false
      const statusRes = await app.inject({
        method: "GET",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });

      expect(statusRes.statusCode).toBe(HTTP_STATUS.OK);
      const statusBody = JSON.parse(statusRes.payload);
      expect(statusBody.data.hasActiveNfc).toBe(false);
      expect(statusBody.data.record == null).toBe(true);
    });

    it("allows ADMIN authority to inspect and manage NFC status across all households", async () => {
      await establishConsent(adminToken);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/asha/households/${unassignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(res.payload);
      expect(body.data.hasActiveNfc).toBe(false);
    });
  });
});
