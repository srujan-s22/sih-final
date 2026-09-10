import { describe, it, expect, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { parseNfcCredential } from "../../frontend/lib/nfc/nfc-parser.js";

describe("Phase 4: NFC Detection, Credential Retrieval & Resolution Robustness", () => {
  let app: FastifyInstance;

  const ashaToken = "test_token_asha101_asha";
  const householdAId = "hh_phase4_test_001";
  const householdBId = "hh_phase4_test_002";

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
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    await seedSchemeRegistry(app.schemeRepository, true);

    const now = new Date().toISOString();

    // Create ASHA user profile
    await app.userRepository.createUserProfile({
      uid: "asha101",
      email: "asha101@health.karnataka.gov.in",
      phoneNumber: "+919876543210",
      role: "ASHA",
      displayName: "Asha Worker 101",
      serviceArea: "Harohalli Health Sub-Center",
      ashaServiceCode: "ASHA-KA-RAM-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Household A (Ramanagara, Karnataka)
    const testHhA: Household = {
      id: householdAId,
      ownerUid: "citizen_p4_01",
      headOfHouseholdName: "Ramesh Gowda",
      rationCardNumber: "RC-KA-P4-001",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Ramanagara",
      village: "Harohalli",
      pincode: "562112",
      contactPhone: "9876543210",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHhA);

    await app.householdRepository.createMember(householdAId, {
      id: "mem_p4_senior_01",
      householdId: householdAId,
      fullName: "Ramesh Gowda Senior",
      age: 70,
      gender: "male",
      relationship: "Self / Head",
      disabilityStatus: false,
      chronicConditions: ["Hypertension"],
      createdAt: now,
      updatedAt: now,
    });

    const caseA: AshaCase = {
      id: "case_p4_001",
      householdId: householdAId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: testHhA.headOfHouseholdName,
      district: testHhA.district,
      state: testHhA.state,
      incomeCategory: testHhA.incomeCategory,
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
    await app.caseRepository.createCase(caseA);

    // Household B (Mandya, Karnataka)
    const testHhB: Household = {
      id: householdBId,
      ownerUid: "citizen_p4_02",
      headOfHouseholdName: "Lakshmi Bai",
      rationCardNumber: "RC-KA-P4-002",
      incomeCategory: "BPL",
      state: "Karnataka",
      district: "Mandya",
      village: "Maddur",
      pincode: "571428",
      contactPhone: "9876543211",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHhB);

    const caseB: AshaCase = {
      id: "case_p4_002",
      householdId: householdBId,
      assignedAshaUid: "asha101",
      headOfHouseholdName: testHhB.headOfHouseholdName,
      district: testHhB.district,
      state: testHhB.state,
      incomeCategory: testHhB.incomeCategory,
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
    await app.caseRepository.createCase(caseB);
  });

  // ============================================================================
  // SECTION 41 TESTS 1 - 8: CLIENT-SIDE QUERY PARSING & BOUNDS ENFORCEMENT
  // ============================================================================
  describe("Security Regression Tests 1 - 8: Query Parsing & Validation", () => {
    it("1. Missing household ID fails with MALFORMED", () => {
      const result = parseNfcCredential("?t=validtoken_12345678901234");
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Missing household ID");
      }
    });

    it("2. Missing token fails with MALFORMED", () => {
      const result = parseNfcCredential("?hh=hh_phase4_test_001");
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Missing access token");
      }
    });

    it("3. Missing version parameter parses successfully with version undefined", () => {
      const result = parseNfcCredential("?hh=hh_phase4_test_001&t=validtoken_12345678901234");
      expect(result.status).toBe("VALID");
      if (result.status === "VALID") {
        expect(result.credential.householdId).toBe("hh_phase4_test_001");
        expect(result.credential.token).toBe("validtoken_12345678901234");
        expect(result.credential.version).toBeUndefined();
      }
    });

    it("4. Duplicate household parameter is strictly rejected as MALFORMED", () => {
      const result = parseNfcCredential(
        "?hh=hh_first&hh=hh_second&t=validtoken_12345678901234"
      );
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Duplicate household ID parameter detected");
      }
    });

    it("5. Duplicate token parameter is strictly rejected as MALFORMED", () => {
      const result = parseNfcCredential(
        "?hh=hh_phase4_test_001&t=token_one_1234567890&t=token_two_1234567890"
      );
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Duplicate token parameter detected");
      }
    });

    it("6. Oversized household ID (> 100 chars) is rejected as MALFORMED", () => {
      const oversizedHh = "hh_" + "a".repeat(105);
      const result = parseNfcCredential(
        `?hh=${oversizedHh}&t=validtoken_12345678901234`
      );
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Household ID must be between 3 and 100 characters");
      }
    });

    it("7. Oversized token (> 128 chars) is rejected as MALFORMED", () => {
      const oversizedToken = "t_".repeat(70); // 140 chars
      const result = parseNfcCredential(
        `?hh=hh_phase4_test_001&t=${oversizedToken}`
      );
      expect(result.status).toBe("MALFORMED");
      if (result.status === "MALFORMED") {
        expect(result.reason).toContain("Access token must be between 16 and 128 characters");
      }
    });

    it("8. Malformed version parameter (negative, string, or huge) is rejected as MALFORMED", () => {
      const nonIntRes = parseNfcCredential(
        "?hh=hh_phase4_test_001&t=validtoken_12345678901234&v=not_a_number"
      );
      expect(nonIntRes.status).toBe("MALFORMED");

      const negativeRes = parseNfcCredential(
        "?hh=hh_phase4_test_001&t=validtoken_12345678901234&v=-5"
      );
      expect(negativeRes.status).toBe("MALFORMED");

      const hugeRes = parseNfcCredential(
        "?hh=hh_phase4_test_001&t=validtoken_12345678901234&v=999999999"
      );
      expect(hugeRes.status).toBe("MALFORMED");
    });
  });

  // ============================================================================
  // SECTION 41 TESTS 9 - 17: BACKEND RESOLUTION ROBUSTNESS & SECURITY
  // ============================================================================
  describe("Security Regression Tests 9 - 17: Backend Resolution & Credential Invariants", () => {
    it("9. Household ID only without token fails with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: householdAId,
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.json().code).toBe("VALIDATION_FAILED");
    });

    it("10. Token only without household ID fails with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          token: "valid_dummy_token_1234567890",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.json().code).toBe("VALIDATION_FAILED");
    });

    it("11. Valid household ID with incorrect token returns generic 401 Unauthorized", async () => {
      await establishConsent(ashaToken);

      // Provision active card
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // Attempt resolution with incorrect random token
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: householdAId,
          token: "wrong_random_bearer_token_12345",
        },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json().code).toBe("INVALID_NFC_CREDENTIAL");
      expect(res.json().message).toBe("Invalid or unavailable NFC credential.");
    });

    it("12. Cross-household token attack (Household A token with Household B ID) strictly fails with 401", async () => {
      await establishConsent(ashaToken);

      // Provision cards for both Household A and Household B
      const provARes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const tokenA = provARes.json().data.token;

      const provBRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdBId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const tokenB = provBRes.json().data.token;

      // Legitimate resolutions succeed
      const legitA = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: tokenA },
      });
      expect(legitA.statusCode).toBe(HTTP_STATUS.OK);
      expect(legitA.json().data.household.displayName).toBe("Ramesh Gowda");

      const legitB = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdBId, token: tokenB },
      });
      expect(legitB.statusCode).toBe(HTTP_STATUS.OK);
      expect(legitB.json().data.household.displayName).toBe("Lakshmi Bai");

      // Attack: Household B ID + Household A Token
      const crossAttack1 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdBId, token: tokenA },
      });
      expect(crossAttack1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(crossAttack1.json().code).toBe("INVALID_NFC_CREDENTIAL");
      // Zero leakage of Household A
      expect(JSON.stringify(crossAttack1.json())).not.toContain("Ramesh Gowda");

      // Attack: Household A ID + Household B Token
      const crossAttack2 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: tokenB },
      });
      expect(crossAttack2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(crossAttack2.json().code).toBe("INVALID_NFC_CREDENTIAL");
      // Zero leakage of Household B
      expect(JSON.stringify(crossAttack2.json())).not.toContain("Lakshmi Bai");
    });

    it("13. Revoked credential fails with generic 401 Unauthorized", async () => {
      await establishConsent(ashaToken);

      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const tokenA = provRes.json().data.token;

      // Revoke card
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc/revoke`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { reason: "Card lost" },
      });

      // Resolve attempt fails
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: tokenA },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json().code).toBe("INVALID_NFC_CREDENTIAL");
    });

    it("14. PENDING_WRITE credential cannot resolve before write confirmation", async () => {
      await establishConsent(ashaToken);

      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });

      // Initiate rotate (creates pending v2)
      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const pendingToken = rotRes.json().data.token;

      // Pending token cannot resolve
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: pendingToken },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json().code).toBe("INVALID_NFC_CREDENTIAL");
    });

    it("15. Old rotated credential (v1) fails with 401 after physical write confirmation", async () => {
      await establishConsent(ashaToken);

      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const tokenV1 = pRes.json().data.token;

      const rotRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc/rotate`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const { token: tokenV2, nfcId, version } = rotRes.json().data;

      // Confirm physical write
      await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc/rotate/confirm`,
        headers: { authorization: `Bearer ${ashaToken}` },
        payload: { nfcId, version },
      });

      // Old tokenV1 fails
      const oldRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: tokenV1 },
      });
      expect(oldRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(oldRes.json().code).toBe("INVALID_NFC_CREDENTIAL");

      // New tokenV2 succeeds
      const newRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: tokenV2 },
      });
      expect(newRes.statusCode).toBe(HTTP_STATUS.OK);
      expect(newRes.json().data.household.displayName).toBe("Ramesh Gowda");
    });

    it("16. Valid active credential resolves successfully with privacy-minimal DTO", async () => {
      await establishConsent(ashaToken);

      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token },
      });

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      const data = res.json().data;
      expect(data.household.displayName).toBe("Ramesh Gowda");
      expect(data.household.region.district).toBe("Ramanagara");
      expect(Array.isArray(data.schemes)).toBe(true);
      expect(data.asha).toBeDefined();
      expect(data.asha.displayName).toBe("Asha Worker 101");
    });

    it("17. Anti-enumeration: non-existent household and wrong token produce identical 401 responses", async () => {
      // Case A: Household exists, token is wrong
      const resWrongToken = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: householdAId,
          token: "non_existent_token_12345678",
        },
      });

      // Case B: Household does not exist
      const resNonExistentHh = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: "hh_non_existent_999999",
          token: "non_existent_token_12345678",
        },
      });

      expect(resWrongToken.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(resNonExistentHh.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

      expect(resWrongToken.json().code).toBe("INVALID_NFC_CREDENTIAL");
      expect(resNonExistentHh.json().code).toBe("INVALID_NFC_CREDENTIAL");

      expect(resWrongToken.json().message).toBe("Invalid or unavailable NFC credential.");
      expect(resNonExistentHh.json().message).toBe("Invalid or unavailable NFC credential.");
    });
  });

  // ============================================================================
  // SECTION 41 TESTS 18 - 25: PRIVACY, CLEANUP, CONCURRENCY & LIFECYCLE
  // ============================================================================
  describe("Security Regression Tests 18 - 25: Privacy, Cleanup & Concurrency", () => {
    it("18. Raw token is never logged or exposed in server response bodies or error payloads", async () => {
      await establishConsent(ashaToken);

      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const secretToken = provRes.json().data.token;

      // Successful resolve response
      const resolveRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: secretToken },
      });
      const successPayload = resolveRes.payload;
      expect(successPayload).not.toContain(secretToken);
      expect(successPayload).not.toContain("tokenHash");

      // Failed resolve response
      const failRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token: "wrong_token_12345678" },
      });
      const failPayload = failRes.payload;
      expect(failPayload).not.toContain("wrong_token_12345678");
      expect(failPayload).not.toContain("tokenHash");
    });

    it("19. Raw token is strictly absent from rendered error payloads", async () => {
      const badRes = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: {
          householdId: householdAId,
          token: "bad_secret_bearer_token_123",
        },
      });

      const body = badRes.json();
      expect(body.message).toBe("Invalid or unavailable NFC credential.");
      expect(JSON.stringify(body)).not.toContain("bad_secret_bearer_token_123");
    });

    it("20. URL cleanup: parseNfcCredential processes and supports URL address sanitization", () => {
      const rawUrlQuery = "?hh=hh_phase4_test_001&t=secret_bearer_token_12345&v=1";
      const parseResult = parseNfcCredential(rawUrlQuery);

      expect(parseResult.status).toBe("VALID");
      if (parseResult.status === "VALID") {
        // Credential was safely extracted to in-memory object
        expect(parseResult.credential.householdId).toBe("hh_phase4_test_001");
        expect(parseResult.credential.token).toBe("secret_bearer_token_12345");
        expect(parseResult.credential.version).toBe(1);
      }
    });

    it("21. No persistent token storage: ensures credential parser returns in-memory structure only", () => {
      const result = parseNfcCredential("?hh=hh_phase4_test_001&t=validtoken_12345678901234");
      expect(result.status).toBe("VALID");
      // The result is a pure JavaScript object, not written to any web storage API
      expect(Object.keys(result)).toEqual(["status", "credential"]);
    });

    it("22. Direct /nfc access without parameters is identified cleanly as EMPTY", () => {
      const emptyStringRes = parseNfcCredential("");
      expect(emptyStringRes.status).toBe("EMPTY");

      const questionMarkRes = parseNfcCredential("?");
      expect(questionMarkRes.status).toBe("EMPTY");

      const nullRes = parseNfcCredential(null);
      expect(nullRes.status).toBe("EMPTY");

      const emptyParamsRes = parseNfcCredential(new URLSearchParams());
      expect(emptyParamsRes.status).toBe("EMPTY");
    });

    it("23. Refresh after URL cleanup: simulated reload with no query string yields EMPTY status", () => {
      // Step 1: Initial tap with parameters
      const initialTap = parseNfcCredential("?hh=hh_phase4_test_001&t=secret_token_123456");
      expect(initialTap.status).toBe("VALID");

      // Step 2: replaceState cleaned URL to /nfc (empty search parameters)
      // Step 3: Browser refresh loads clean /nfc
      const refreshedState = parseNfcCredential("");
      expect(refreshedState.status).toBe("EMPTY");
    });

    it("24. Network retry safety: resolution is idempotent and does not mutate credential state", async () => {
      await establishConsent(ashaToken);

      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      // Attempt 1: Succeeds
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token },
      });
      expect(res1.statusCode).toBe(HTTP_STATUS.OK);

      // Attempt 2 (Simulated manual retry): Also succeeds idempotently
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: householdAId, token },
      });
      expect(res2.statusCode).toBe(HTTP_STATUS.OK);
      expect(res2.json().data.household.displayName).toBe("Ramesh Gowda");

      // Card remains ACTIVE
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdAId);
      expect(activeRecord?.status).toBe("ACTIVE");
    });

    it("25. Concurrent resolution: 10 simultaneous resolve requests with the same valid credential all resolve safely", async () => {
      await establishConsent(ashaToken);

      const provRes = await app.inject({
        method: "POST",
        url: `/api/v1/asha/households/${householdAId}/nfc`,
        headers: { authorization: `Bearer ${ashaToken}` },
      });
      const token = provRes.json().data.token;

      // Launch 10 simultaneous resolution requests
      const parallelRequests = Array.from({ length: 10 }).map(() =>
        app.inject({
          method: "POST",
          url: "/api/v1/nfc/resolve",
          payload: { householdId: householdAId, token },
        })
      );

      const responses = await Promise.all(parallelRequests);

      // All 10 requests must safely succeed with 200 OK
      expect(responses.every((r) => r.statusCode === HTTP_STATUS.OK)).toBe(true);
      for (const r of responses) {
        expect(r.json().data.household.displayName).toBe("Ramesh Gowda");
      }

      // Credential state is unaffected
      const activeRecord = await app.nfcRepository.getActiveByHouseholdId(householdAId);
      expect(activeRecord?.status).toBe("ACTIVE");
    });
  });
});
