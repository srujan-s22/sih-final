import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { Household } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";

describe("Phase 1: Secure NFC Backend Foundation", () => {
  let app: FastifyInstance;

  const asha1Token = "test_token_asha101_asha";
  const asha2Token = "test_token_asha102_asha";
  const citizenToken = "test_token_citizen103_citizen";
  const adminToken = "test_token_admin104_admin";

  const householdId = "hh_1741549832_test01";
  const unassignedHouseholdId = "hh_1741549832_test02";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Clean all in-memory stores for isolated unit test runs
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    // Seed verified schemes for eligibility engine
    await seedSchemeRegistry(app.schemeRepository, true);

    // Create test household
    const now = new Date().toISOString();
    const testHousehold: Household = {
      id: householdId,
      ownerUid: "citizen103",
      headOfHouseholdName: "Suresh Sharma",
      rationCardNumber: "RC-KA-987654321",
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

    // Add household member: senior citizen (age 72)
    await app.householdRepository.createMember(householdId, {
      id: "mem_senior_72",
      householdId,
      fullName: "Suresh Sharma Senior",
      age: 72,
      gender: "male",
      relationship: "Self / Head",
      disabilityStatus: false,
      chronicConditions: ["Hypertension", "Diabetes"],
      createdAt: now,
      updatedAt: now,
    });

    // Create an assigned case for asha101
    const testCase: AshaCase = {
      id: "case_test_001",
      householdId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: testHousehold.headOfHouseholdName,
      district: testHousehold.district,
      state: testHousehold.state,
      incomeCategory: testHousehold.incomeCategory,
      memberCount: 1,
      status: "ACTIVE",
      priority: "NORMAL",
      detectedGapsCount: 0,
      eligibleSchemesCount: 1,
      lastContactAt: now,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(testCase);

    // Create an unassigned household (belongs to someone else, no case for asha101)
    const unassignedHh: Household = {
      id: unassignedHouseholdId,
      ownerUid: "citizen999",
      headOfHouseholdName: "Anita Devi",
      rationCardNumber: "RC-KA-112233445",
      incomeCategory: "APL",
      state: "Karnataka",
      district: "Bangalore Rural",
      village: "Nelamangala",
      pincode: "562123",
      contactPhone: "9988776655",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(unassignedHh);
  });

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

  // ============================================================================
  // A. PROVISIONING TESTS
  // ============================================================================
  describe("A. NFC Provisioning", () => {
    it("1. allows authorized assigned ASHA to provision NFC for their household", async () => {
      await establishConsent(asha1Token);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.householdId).toBe(householdId);
      expect(body.data.version).toBe(1);
      expect(typeof body.data.token).toBe("string");
      expect(body.data.token.length).toBeGreaterThanOrEqual(32);
      expect(body.data.nfcId).toBe(`nfc_${householdId}_v1`);
    });

    it("2. blocks unauthorized ASHA from provisioning NFC for another ASHA's household", async () => {
      await establishConsent(asha2Token);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha2Token}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("FORBIDDEN_HOUSEHOLD_ACCESS");
    });

    it("3. allows Admin to provision NFC for any household", async () => {
      await establishConsent(adminToken);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${unassignedHouseholdId}/nfc`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.householdId).toBe(unassignedHouseholdId);
      expect(body.data.version).toBe(1);
    });

    it("4. rejects duplicate active NFC provisioning with 409 CONFLICT", async () => {
      await establishConsent(asha1Token);

      // First provisioning succeeds
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      expect(res1.statusCode).toBe(HTTP_STATUS.CREATED);

      // Second provisioning attempt for the same active household fails
      const res2 = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(res2.statusCode).toBe(HTTP_STATUS.CONFLICT);
      const body = res2.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("DUPLICATE_ACTIVE_NFC");
    });

    it("5. generates high-entropy, URL-safe random token and does NOT store raw token in DB", async () => {
      await establishConsent(asha1Token);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      const rawToken = res.json().data.token;
      expect(rawToken).toMatch(/^[a-zA-Z0-9_-]+$/); // URL-safe base64url characters only

      // Verify that database stores ONLY tokenHash and NOT rawToken
      const storedRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
      expect(storedRecord).toBeDefined();
      expect(storedRecord!.tokenHash).toBeDefined();
      expect(storedRecord!.tokenHash).not.toBe(rawToken); // Must be cryptographic hash
      expect((storedRecord as any).token).toBeUndefined(); // Raw token never saved
    });
  });

  // ============================================================================
  // B. VALIDATION & ROTATION TESTS
  // ============================================================================
  describe("B. NFC Validation & Rotation", () => {
    it("7. resolves valid Household ID + Token with 200 OK", async () => {
      await establishConsent(asha1Token);

      const provisionRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const { token } = provisionRes.json().data;

      // Public verification call
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token,
        },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      const body = resolveRes.json();
      expect(body.success).toBe(true);
      expect(body.data.household.displayName).toBe("Suresh Sharma");
      expect(body.data.household.region.district).toBe("Ramanagara");
      expect(Array.isArray(body.data.schemes)).toBe(true);
    });

    it("8. rejects invalid token for existing household with generic 401", async () => {
      await establishConsent(asha1Token);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token: "invalid_tampered_token_string_12345678",
        },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = resolveRes.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("INVALID_NFC_CREDENTIAL");
      expect(body.message).toBe("Invalid or unavailable NFC credential.");
    });

    it("9. rejects unknown household with generic 401 without leaking existence", async () => {
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: "hh_completely_unknown_9999",
          token: "some_random_token_string_1234567890",
        },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = resolveRes.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("INVALID_NFC_CREDENTIAL");
      expect(body.message).toBe("Invalid or unavailable NFC credential.");
    });

    it("10. rejects revoked NFC card with generic 401", async () => {
      await establishConsent(asha1Token);

      const provisionRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const { token } = provisionRes.json().data;

      // Explicitly revoke card
      const revokeRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/revoke`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { reason: "Card damaged by water" },
      });
      expect(revokeRes.statusCode).toBe(HTTP_STATUS.OK);

      // Attempting to resolve with revoked token fails
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token,
        },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(resolveRes.json().code).toBe("INVALID_NFC_CREDENTIAL");
    });

    it("11 & 12. rotating NFC card invalidates old token and validates new token", async () => {
      await establishConsent(asha1Token);

      // 1. Initial provision (Version 1)
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const token1 = res1.json().data.token;

      // 2. Rotate NFC card (Version 2)
      const resRotate = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: { reason: "Physical tag lost by family" },
      });
      expect(resRotate.statusCode).toBe(HTTP_STATUS.OK);
      const { token: token2, version: version2 } = resRotate.json().data;
      expect(version2).toBe(2);
      expect(token2).not.toBe(token1);

      // 3. Confirm physical write completion
      const confirmRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${asha1Token}` },
        payload: {
          nfcId: `nfc_${householdId}_v2`,
          version: 2,
          reason: "Replacement card written",
        },
      });
      expect(confirmRes.statusCode).toBe(HTTP_STATUS.OK);

      // 4. Old token1 MUST fail
      const oldResolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token: token1,
        },
      });
      expect(oldResolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

      // 5. New token2 MUST succeed
      const newResolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token: token2,
        },
      });
      expect(newResolveRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(newResolveRes.json().data.household.displayName).toBe("Suresh Sharma");
    });
  });

  // ============================================================================
  // C. PRIVACY BOUNDARY TESTS
  // ============================================================================
  describe("C. Privacy Boundary & Data Minimization", () => {
    it("13 & 14. public response contains ONLY approved fields and strictly OMITS all sensitive data", async () => {
      await establishConsent(asha1Token);

      const provisionRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });
      const { token } = provisionRes.json().data;

      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId,
          token,
        },
      });

      expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
      const data = resolveRes.json().data;

      // 1. APPROVED FIELDS PRESENT
      expect(data.household).toBeDefined();
      expect(data.household.displayName).toBe("Suresh Sharma");
      expect(data.household.region).toEqual({
        village: "Harohalli",
        district: "Ramanagara",
        state: "Karnataka",
      });
      expect(Array.isArray(data.schemes)).toBe(true);

      // 2. STRICT PRIVACY VERIFICATION: SENSITIVE FIELDS MUST BE STRICTLY UNDEFINED
      const rawDataString = JSON.stringify(data);

      // Income category must NOT be exposed
      expect((data.household as any).incomeCategory).toBeUndefined();
      expect(rawDataString).not.toContain("BPL");
      expect(rawDataString).not.toContain("incomeCategory");

      // Ration card must NOT be exposed
      expect((data.household as any).rationCardNumber).toBeUndefined();
      expect(rawDataString).not.toContain("RC-KA-987654321");

      // Phone numbers must NOT be exposed
      expect((data.household as any).contactPhone).toBeUndefined();
      expect(rawDataString).not.toContain("9876543210");

      // Member roster & medical diagnoses must NOT be exposed
      expect((data as any).members).toBeUndefined();
      expect(rawDataString).not.toContain("Hypertension");
      expect(rawDataString).not.toContain("Diabetes");
      expect(rawDataString).not.toContain("mem_senior_72");

      // Aadhaar, case details, tokens, hashes must NOT be exposed
      expect(rawDataString).not.toContain("aadhaar");
      expect(rawDataString).not.toContain("case_test_001");
      expect(rawDataString).not.toContain("tokenHash");
      expect(rawDataString).not.toContain(token);
    });
  });

  // ============================================================================
  // D. SECURITY & RBAC TESTS
  // ============================================================================
  describe("D. Security & RBAC Guardrails", () => {
    it("15. unauthenticated provisioning fails with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it("16. citizen role is forbidden from provisioning NFC with 403", async () => {
      await establishConsent(citizenToken);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${citizenToken}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.json().code).toBe("INSUFFICIENT_ROLE");
    });

    it("17. unassigned household throws 403 FORBIDDEN_HOUSEHOLD_ACCESS for ASHA", async () => {
      await establishConsent(asha1Token);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${unassignedHouseholdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it("18. malformed input on resolve endpoint is rejected with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: "hh_short",
          token: "short", // Under 16 characters
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.json().code).toBe("VALIDATION_FAILED");
    });
  });

  // ============================================================================
  // E. CONCURRENCY & ATOMICITY TESTS
  // ============================================================================
  describe("E. Concurrency & Atomicity", () => {
    it("21. concurrent provisioning attempts cannot create multiple active NFC credentials", async () => {
      await establishConsent(asha1Token);

      // Launch 5 parallel provisioning requests simultaneously
      const parallelPromises = Array.from({ length: 5 }).map(() =>
        app.inject({
          method: "POST",
          url: `/api/v1/asha/households/${householdId}/nfc`,
          headers: { authorization: `Bearer ${asha1Token}` },
        })
      );

      const results = await Promise.all(parallelPromises);

      // Exactly ONE request must succeed with 201 CREATED
      const successfulCreations = results.filter((r) => r.statusCode === HTTP_STATUS.CREATED);
      const rejectedDuplicates = results.filter((r) => r.statusCode === HTTP_STATUS.CONFLICT);

      expect(successfulCreations.length).toBe(1);
      expect(rejectedDuplicates.length).toBe(4);

      // Verify that repository contains exactly ONE active credential
      const allRecords = await app.nfcRepository.listByHouseholdId(householdId);
      const activeRecords = allRecords.filter((r) => r.status === "ACTIVE");
      expect(activeRecords.length).toBe(1);
    });
  });

  // ============================================================================
  // F. STATUS QUERY TESTS
  // ============================================================================
  describe("F. Safe NFC Status Query", () => {
    it("22. returns hasActiveNfc: false when no card has been provisioned", async () => {
      await establishConsent(asha1Token);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.hasActiveNfc).toBe(false);
      expect(body.data.record).toBeNull();
    });

    it("23. returns hasActiveNfc: true with safe metadata (no token/hash) when card is active", async () => {
      await establishConsent(asha1Token);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/asha/households/${householdId}/nfc`,
        headers: { authorization: `Bearer ${asha1Token}` },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.hasActiveNfc).toBe(true);
      expect(body.data.record.version).toBe(1);
      expect(body.data.record.status).toBe("ACTIVE");

      // Verify NO token or tokenHash is leaked
      const rawString = JSON.stringify(body);
      expect(rawString).not.toContain("tokenHash");
      expect(body.data.record.token).toBeUndefined();
    });
  });
});
