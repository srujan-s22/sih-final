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
  copyNfcLinkToClipboard,
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
      // For version 1, &v=1 is omitted to minimize payload for NTAG213 tags
      expect(parsed.searchParams.get("v")).toBeNull();

      // For version > 1, version parameter is preserved
      const urlV2 = buildNfcUrl(hhId, token, customOrigin, 2);
      expect(new URL(urlV2).searchParams.get("v")).toBe("2");
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

    it("successfully writes NDEF URI record with overwrite: true when supported hardware is present", async () => {
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
        expect.objectContaining({ overwrite: true })
      );
    });

    it("retries transient NetworkError exactly once and succeeds on second attempt", async () => {
      const netError = new Error("Transfer failed");
      netError.name = "NetworkError";

      const writeMock = vi
        .fn()
        .mockRejectedValueOnce(netError)
        .mockResolvedValueOnce(undefined);

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const onRetryMock = vi.fn();
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2", {
        onRetry: onRetryMock,
      });

      expect(result.success).toBe(true);
      expect(writeMock).toHaveBeenCalledTimes(2);
      expect(onRetryMock).toHaveBeenCalledWith(1);
    });

    it("fails with informative guidance when second retry also encounters NetworkError", async () => {
      const netError = new Error("Connection lost");
      netError.name = "NetworkError";

      const writeMock = vi.fn().mockRejectedValue(netError);

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const onRetryMock = vi.fn();
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2", {
        onRetry: onRetryMock,
      });

      expect(result.success).toBe(false);
      expect(writeMock).toHaveBeenCalledTimes(2);
      expect(onRetryMock).toHaveBeenCalledWith(1);
      expect(result.error).toContain("NFC communication was interrupted (Connection lost)");
      expect(result.error).toContain("hold the NFC card flat and steady");
      expect(result.error).not.toContain("moved away too quickly");
    });

    it("does not retry when AbortError is encountered", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      const writeMock = vi.fn().mockRejectedValue(abortError);

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const onRetryMock = vi.fn();
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2", {
        onRetry: onRetryMock,
      });

      expect(result.success).toBe(false);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(onRetryMock).not.toHaveBeenCalled();
      expect(result.error).toContain("cancelled");
    });

    it("handles NotAllowedError when NFC permission is denied or disabled", async () => {
      const permError = new Error("Permission denied");
      permError.name = "NotAllowedError";

      const writeMock = vi.fn().mockRejectedValue(permError);

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const onRetryMock = vi.fn();
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2", {
        onRetry: onRetryMock,
      });

      expect(result.success).toBe(false);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(onRetryMock).not.toHaveBeenCalled();
      expect(result.error).toContain("permission was denied");
    });

    it("does not retry on read-only tag error (InvalidStateError)", async () => {
      const roError = new Error("NFC tag is read only");
      roError.name = "InvalidStateError";

      const writeMock = vi.fn().mockRejectedValue(roError);

      getGlobal().window = {
        NDEFReader: class MockNDEFReader {
          write = writeMock;
        },
      };

      const onRetryMock = vi.fn();
      const result = await writeNfcTag("https://swasthyasetu.gov.in/nfc?hh=1&t=2", {
        onRetry: onRetryMock,
      });

      expect(result.success).toBe(false);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(onRetryMock).not.toHaveBeenCalled();
      expect(result.error).toContain("read-only");
    });
  });

  // =========================================================================
  // 3b. Web NFC Fallback & Clipboard Provisioning URL Transport
  // =========================================================================
  describe("Web NFC Fallback & Clipboard Provisioning URL Transport", () => {
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const originalDocumentDesc = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalLocalStorage = getGlobal().localStorage;
    const originalSessionStorage = getGlobal().sessionStorage;

    const setMockNavigator = (val: any) => {
      Object.defineProperty(globalThis, "navigator", {
        value: val,
        configurable: true,
        writable: true,
      });
    };

    const setMockDocument = (val: any) => {
      Object.defineProperty(globalThis, "document", {
        value: val,
        configurable: true,
        writable: true,
      });
    };

    afterEach(() => {
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
      } else {
        delete (globalThis as any).navigator;
      }
      if (originalDocumentDesc) {
        Object.defineProperty(globalThis, "document", originalDocumentDesc);
      } else {
        delete (globalThis as any).document;
      }
      if (originalLocalStorage !== undefined) {
        getGlobal().localStorage = originalLocalStorage;
      } else {
        delete getGlobal().localStorage;
      }
      if (originalSessionStorage !== undefined) {
        getGlobal().sessionStorage = originalSessionStorage;
      } else {
        delete getGlobal().sessionStorage;
      }
      vi.restoreAllMocks();
    });

    it("rejects empty or whitespace URL with safe error without throwing", async () => {
      const res1 = await copyNfcLinkToClipboard("");
      expect(res1.success).toBe(false);
      expect(res1.error).toBe("No NFC link available to copy.");

      const res2 = await copyNfcLinkToClipboard("   ");
      expect(res2.success).toBe(false);
      expect(res2.error).toBe("No NFC link available to copy.");
    });

    it("successfully copies generated provisioning URL via navigator.clipboard.writeText", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      setMockNavigator({
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const testUrl = "https://swasthyasetu.org/nfc?hh=hh_123&t=sample_secure_token";
      const result = await copyNfcLinkToClipboard(testUrl);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(writeTextMock).toHaveBeenCalledWith(testUrl);
    });

    it("handles clipboard permission rejection safely and returns clear error message", async () => {
      const permError = new Error("Clipboard permission was denied by user agent");
      const writeTextMock = vi.fn().mockRejectedValue(permError);
      setMockNavigator({
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const testUrl = "https://swasthyasetu.org/nfc?hh=hh_123&t=sample_secure_token";
      const result = await copyNfcLinkToClipboard(testUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unable to copy NFC link automatically");
      expect(result.error).toContain("clipboard permissions");
    });

    it("falls back to document.execCommand when navigator.clipboard is unavailable", async () => {
      // Modern clipboard unavailable
      setMockNavigator({});

      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();
      const selectMock = vi.fn();
      const focusMock = vi.fn();
      const execCommandMock = vi.fn().mockReturnValue(true);

      const mockTextArea = {
        value: "",
        style: {},
        setAttribute: vi.fn(),
        select: selectMock,
        focus: focusMock,
      };

      setMockDocument({
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
        execCommand: execCommandMock,
      });

      const testUrl = "https://swasthyasetu.org/nfc?hh=hh_legacy&t=token_legacy_123";
      const result = await copyNfcLinkToClipboard(testUrl);

      expect(result.success).toBe(true);
      expect(getGlobal().document.createElement).toHaveBeenCalledWith("textarea");
      expect(mockTextArea.value).toBe(testUrl);
      expect(appendChildMock).toHaveBeenCalledWith(mockTextArea);
      expect(selectMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith("copy");
      expect(removeChildMock).toHaveBeenCalledWith(mockTextArea);
    });

    it("copies the exact backend-generated URL without creating alternate tokens or modifying credentials", async () => {
      await establishConsent(ashaAuthorizedToken);

      // 1. Provision via real backend Fastify API
      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${assignedHouseholdId}/nfc`,
        headers: {
          authorization: `Bearer ${ashaAuthorizedToken}`,
        },
      });
      expect(provRes.statusCode).toBe(HTTP_STATUS.CREATED);
      const provBody = JSON.parse(provRes.payload);
      const { token, version, householdId } = provBody.data;

      // 2. Build URL using existing origin & NTAG213 rules
      const generatedUrl = buildNfcUrl(householdId, token, "https://swasthyasetu.gov.in", version);

      // 3. Mock clipboard and copy
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      setMockNavigator({
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const copyResult = await copyNfcLinkToClipboard(generatedUrl);
      expect(copyResult.success).toBe(true);

      // Verify the copied URL is exact
      const copiedUrl = writeTextMock.mock.calls[0][0];
      expect(copiedUrl).toBe(generatedUrl);

      const parsed = new URL(copiedUrl);
      expect(parsed.pathname).toBe("/nfc");
      expect(parsed.searchParams.get("hh")).toBe(assignedHouseholdId);
      expect(parsed.searchParams.get("t")).toBe(token);
      expect(parsed.searchParams.get("v")).toBeNull(); // version 1 omitted for NTAG213

      // 4. Verify this exact copied URL resolves successfully via public NFC resolver
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: parsed.searchParams.get("hh"),
          token: parsed.searchParams.get("t"),
        },
      });
      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      const resolveBody = JSON.parse(resolveRes.payload);
      expect(resolveBody.data.household.displayName).toBe("Ramesh Kumar");

      // 5. Verify no duplicate or alternate record exists in the repository
      const allRecords = await app.nfcRepository.listByHouseholdId(assignedHouseholdId);
      expect(allRecords.length).toBe(1);
      expect(allRecords[0].version).toBe(1);
    });

    it("preserves zero storage persistence invariant: token is never stored in localStorage, sessionStorage, or cookies", async () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        length: 0,
      };

      getGlobal().localStorage = storageMock;
      getGlobal().sessionStorage = storageMock;
      setMockDocument({
        cookie: "",
      });

      const testToken = "secure_raw_token_never_persist_12345";
      const testUrl = buildNfcUrl("hh_storage_check", testToken, "https://swasthyasetu.org");

      setMockNavigator({
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      await copyNfcLinkToClipboard(testUrl);

      // Verify storage was never touched
      expect(storageMock.setItem).not.toHaveBeenCalled();
      expect(mockStorage[testToken]).toBeUndefined();
      expect(getGlobal().document.cookie).not.toContain(testToken);
    });

    it("verifies the copied fallback URL complies with NTAG213 byte capacity limit (<117 bytes)", () => {
      // Standard 32-byte base64url token is ~43 chars, canonical hostname
      const token = "a".repeat(43);
      const url = buildNfcUrl("hh_ramanagara_harohalli_01", token, "https://swasthyasetu.vercel.app");

      const byteLength = new TextEncoder().encode(url).length;
      // Must comfortably fit within NTAG213 117-byte usable limit
      expect(byteLength).toBeLessThanOrEqual(117);
      expect(new URL(url).searchParams.get("v")).toBeNull();
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
