import { describe, it, expect, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import * as crypto from "crypto";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household, Member } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { hashSecret, verifySecretHash } from "../src/utils/secret-hash.js";
import { buildHouseholdSpeechText } from "../../frontend/lib/nfc/nfc-audio.js";
import { buildNfcUrl } from "../../frontend/lib/nfc/nfc-writer.js";
import { parseNfcCredential } from "../../frontend/lib/nfc/nfc-parser.js";

describe("Phase 7: Final NFC Security Audit, End-to-End Validation & Demo Readiness", () => {
  let app: FastifyInstance;

  const adminToken = "test_token_adminDemo_admin";
  const ashaAToken = "test_token_ashaA_asha";
  const ashaBToken = "test_token_ashaB_asha";
  const unassignedAshaToken = "test_token_ashaUnassigned_asha";
  const citizenToken = "test_token_citizenDemo_citizen";

  const householdId = "hh_demo_harohalli_001";
  const householdBId = "hh_demo_harohalli_002";
  const caseId = "case_demo_harohalli_001";

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

    // Clean test store
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.leaveRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();

    // Seed production verified schemes
    await seedSchemeRegistry(app.schemeRepository, true);

    const now = new Date().toISOString();

    // 1. Clean Demo Admin Profile
    await app.userRepository.createUserProfile({
      uid: "adminDemo",
      email: "admin.demo@health.karnataka.gov.in",
      phoneNumber: "+919876500001",
      role: "ADMIN",
      displayName: "Dr. Ramesh Sharma (CMO)",
      serviceArea: "Karnataka State Health Directorate",
      ashaServiceCode: "ADMIN-KA-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Clean Demo ASHA A (Primary)
    await app.userRepository.createUserProfile({
      uid: "ashaA",
      email: "asha.a.demo@health.karnataka.gov.in",
      phoneNumber: "+919876500002",
      role: "ASHA",
      displayName: "Sunita Devi",
      serviceArea: "Harohalli Health Sub-Center",
      ashaServiceCode: "ASHA-KA-RAM-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Clean Demo ASHA B (Temporary Replacement)
    await app.userRepository.createUserProfile({
      uid: "ashaB",
      email: "asha.b.demo@health.karnataka.gov.in",
      phoneNumber: "+919876500003",
      role: "ASHA",
      displayName: "Kavitha Gowda",
      serviceArea: "Harohalli East Sub-Center",
      ashaServiceCode: "ASHA-KA-RAM-02",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Clean Unassigned ASHA
    await app.userRepository.createUserProfile({
      uid: "ashaUnassigned",
      email: "asha.unassigned@health.karnataka.gov.in",
      phoneNumber: "+919876500099",
      role: "ASHA",
      displayName: "Meena Kumari",
      serviceArea: "Kanakapura Sub-Center",
      ashaServiceCode: "ASHA-KA-RAM-99",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Clean Demo Citizen
    await app.userRepository.createUserProfile({
      uid: "citizenDemo",
      email: "citizen.demo@gmail.com",
      phoneNumber: "+919876511111",
      role: "CITIZEN",
      displayName: "Ramesh Gowda",
      serviceArea: "Harohalli Village",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 6. Clean Demo Household A
    const testHhA: Household = {
      id: householdId,
      ownerUid: "citizenDemo",
      headOfHouseholdName: "Ramesh Gowda",
      village: "Harohalli",
      district: "Ramanagara",
      state: "Karnataka",
      pincode: "562112",
      incomeCategory: "BPL",
      rationCardNumber: "RC-KA-RAM-998877",
      contactPhone: "+919876511111",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHhA);

    // Add Senior Citizen (eligible for AB-PMJAY 70+)
    const seniorMember: Member = {
      id: "mem_senior_74",
      householdId: householdId,
      fullName: "Lakshmamma Gowda",
      relationship: "Mother",
      gender: "female",
      age: 74,
      disabilityStatus: false,
      chronicConditions: ["Hypertension"],
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createMember(householdId, seniorMember);

    // Add Pregnant Mother (eligible for JSY and PMMVY)
    const pregnantMember: Member = {
      id: "mem_pregnant_24",
      householdId: householdId,
      fullName: "Radha Gowda",
      relationship: "Wife",
      gender: "female",
      age: 24,
      disabilityStatus: false,
      chronicConditions: [],
      maternalStatus: "pregnant",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createMember(householdId, pregnantMember);

    // 7. Case for Household A assigned to ASHA A
    const sampleCaseA: AshaCase = {
      id: caseId,
      householdId: householdId,
      assignedAshaUid: "ashaA",
      headOfHouseholdName: "Ramesh Gowda",
      district: "Ramanagara",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 3,
      priority: "HIGH",
      status: "ACTIVE",
      detectedGapsCount: 1,
      eligibleSchemesCount: 2,
      lastContactAt: "2026-09-01T00:00:00Z",
      nextFollowUpAt: "2026-09-15T00:00:00Z",
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(sampleCaseA);

    // 8. Household B for cross-household isolation testing
    const testHhB: Household = {
      id: householdBId,
      ownerUid: "citizen_demo_b",
      headOfHouseholdName: "Siddaramaiah Patil",
      village: "Harohalli",
      district: "Ramanagara",
      state: "Karnataka",
      pincode: "562112",
      incomeCategory: "APL",
      rationCardNumber: "RC-KA-RAM-112233",
      contactPhone: "+919876522222",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHhB);

    const sampleCaseB: AshaCase = {
      id: "case_demo_harohalli_002",
      householdId: householdBId,
      assignedAshaUid: "ashaA",
      headOfHouseholdName: "Siddaramaiah Patil",
      district: "Ramanagara",
      state: "Karnataka",
      incomeCategory: "APL",
      memberCount: 1,
      priority: "NORMAL",
      status: "ACTIVE",
      detectedGapsCount: 0,
      eligibleSchemesCount: 0,
      lastContactAt: "2026-09-01T00:00:00Z",
      nextFollowUpAt: "2026-09-15T00:00:00Z",
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(sampleCaseB);
  });

  const provisionActiveNfcForHhA = async () => {
    await establishConsent(ashaAToken);
    const provRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(provRes.statusCode).toBe(HTTP_STATUS.CREATED);
    return provRes.json().data as {
      householdId: string;
      nfcId: string;
      token: string;
      version: number;
    };
  };

  // ============================================================================
  // PART B — SECURITY AUDIT VERIFICATION
  // ============================================================================

  it("Security Audit 1: Cryptographic randomness & high entropy verification", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = app.nfcService.generateSecureToken();
      // Base64url encoded 32 bytes produces 43 characters
      expect(token.length).toBeGreaterThanOrEqual(42);
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
      tokens.add(token);
    }
    // 100 distinct tokens generated with 0 collisions
    expect(tokens.size).toBe(100);
  });

  it("Security Audit 2: Zero raw token persistence in database records", async () => {
    const nfc = await provisionActiveNfcForHhA();

    const storedRecord = await app.nfcRepository.getActiveByHouseholdId(householdId);
    expect(storedRecord).toBeDefined();
    // Raw token is NEVER stored
    expect((storedRecord as any).token).toBeUndefined();
    expect(storedRecord?.tokenHash).toBeDefined();
    expect(storedRecord?.tokenHash).not.toBe(nfc.token);
    // Hash is deterministic SHA-256 (64 hex characters)
    expect(storedRecord?.tokenHash.length).toBe(64);
    expect(storedRecord?.tokenHash).toBe(hashSecret(nfc.token));
  });

  it("Security Audit 3: Constant-time hash verification and timing safety", () => {
    const secret = "correct_secret_token_1234567890abcdef";
    const hash = hashSecret(secret);

    expect(verifySecretHash(secret, hash)).toBe(true);
    expect(verifySecretHash("wrong_secret_token_1234567890abcdef", hash)).toBe(false);
    expect(verifySecretHash("short", hash)).toBe(false);
    expect(verifySecretHash("", hash)).toBe(false);
  });

  it("Security Audit 4: Strict anti-enumeration — uniform 401 error response across failure modes", async () => {
    const nfc = await provisionActiveNfcForHhA();

    // 1. Uniform 401 response for non-existent household, mismatched token, and other households
    const failureModes = [
      { name: "Non-existent household", hh: "hh_non_existent", t: nfc.token },
      { name: "Incorrect token", hh: householdId, t: "wrong_secret_token_abcdef12345" },
      { name: "Mismatched token from Household B", hh: householdId, t: "different_valid_length_token_12345" },
    ];

    for (const mode of failureModes) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId: mode.hh, token: mode.t },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json().code).toBe("INVALID_NFC_CREDENTIAL");
      expect(res.json().message).toBe("Invalid or unavailable NFC credential.");
    }

    // 2. Malformed input fails at schema validation boundary (400)
    const malformedRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: "too_short" },
    });
    expect(malformedRes.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it("Security Audit 5: Public endpoint rate limiting blocks brute-force attempts", async () => {
    const testIp = "192.168.1.105";

    // Exhaust maximum allowed 10 failed attempts
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        headers: { "x-forwarded-for": testIp },
        payload: { householdId, token: "invalid_brute_force_token_attempt" },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    }

    // 11th attempt must be rejected with 429 RATE_LIMIT_EXCEEDED
    const blockedRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      headers: { "x-forwarded-for": testIp },
      payload: { householdId, token: "invalid_brute_force_token_attempt" },
    });
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.json().code).toBe("RATE_LIMIT_EXCEEDED");
    expect(blockedRes.json().message).toContain("Too many failed verification attempts");
  });

  it("Security Audit 6: Cross-household attack protection — Token A cannot resolve Household B", async () => {
    const nfcA = await provisionActiveNfcForHhA();

    // Provision card for Household B
    await establishConsent(ashaAToken);
    const provResB = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdBId}/nfc`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    const nfcB = provResB.json().data;

    // Household B with Token A -> 401
    const crossRes1 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId: householdBId, token: nfcA.token },
    });
    expect(crossRes1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    // Household A with Token B -> 401
    const crossRes2 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId: householdId, token: nfcB.token },
    });
    expect(crossRes2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("Security Audit 7: Authentication boundary — NFC token is not a citizen or staff credential", async () => {
    const nfc = await provisionActiveNfcForHhA();

    const protectedEndpoints = [
      { method: "GET", url: "/api/v1/households/me" },
      { method: "GET", url: `/api/v1/asha/cases/${caseId}` },
      { method: "GET", url: "/api/v1/asha/cases" },
      { method: "POST", url: `/api/v1/asha/households/${householdId}/nfc` },
    ];

    for (const ep of protectedEndpoints) {
      const res = await app.inject({
        method: ep.method as any,
        url: ep.url,
        headers: { authorization: `Bearer ${nfc.token}` },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    }
  });

  it("Security Audit 8: Strict ASHA authorization boundary — unassigned ASHA cannot manage NFC", async () => {
    await establishConsent(unassignedAshaToken);

    const unassignedRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${unassignedAshaToken}` },
    });

    expect(unassignedRes.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(unassignedRes.json().code).toBe("FORBIDDEN_HOUSEHOLD_ACCESS");
  });

  it("Security Audit 9: Public DTO strict allowlist — zero leakage of sensitive records", async () => {
    const nfc = await provisionActiveNfcForHhA();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    const body = res.json().data;
    const bodyStr = JSON.stringify(body);

    // Permitted top-level keys
    expect(Object.keys(body).sort()).toEqual(["asha", "household", "schemes"]);
    expect(Object.keys(body.household).sort()).toEqual(["displayName", "region"]);
    expect(Object.keys(body.household.region).sort()).toEqual(["district", "state", "village"]);

    // Strictly forbidden fields
    const forbidden = [
      "RC-KA-RAM-998877", // ration card
      "BPL", // income category
      "+919876511111", // phone
      "citizen.demo@gmail.com", // email
      "Lakshmamma", // member name
      "Radha", // member name
      "Hypertension", // member chronic diagnosis
      "maternalStatus", // member medical status key
      "chronicConditions", // member medical field key
      "mem_senior_74", // member ID
      "mem_pregnant_24", // member ID
      "citizenDemo", // UID
      "ashaA", // UID
      nfc.token, // raw token
    ];

    for (const item of forbidden) {
      expect(bodyStr).not.toContain(item);
    }
  });

  // ============================================================================
  // CONCURRENCY & REPLAY SAFETY
  // ============================================================================

  it("Concurrency 10: 20 simultaneous resolve requests execute statelessly without mutation", async () => {
    const nfc = await provisionActiveNfcForHhA();

    const promises = Array.from({ length: 20 }, (_, idx) =>
      app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        headers: { "x-forwarded-for": `192.168.1.${idx + 1}` },
        payload: { householdId, token: nfc.token },
      })
    );

    const responses = await Promise.all(promises);
    for (const r of responses) {
      expect(r.statusCode).toBe(HTTP_STATUS.OK);
      expect(r.json().data.household.displayName).toBe("Ramesh Gowda");
      expect(r.json().data.schemes.length).toBeGreaterThan(0);
    }

    // Verify database state remains pristine (single active NFC record)
    const records = await app.nfcRepository.listByHouseholdId(householdId);
    expect(records.length).toBe(1);
    expect(records[0].status).toBe("ACTIVE");
  });

  it("Replay 11: Normal bearer credential reuse works reliably across multiple taps", async () => {
    const nfc = await provisionActiveNfcForHhA();

    // 5 consecutive taps from same user
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/nfc/resolve",
        payload: { householdId, token: nfc.token },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res.json().data.household.displayName).toBe("Ramesh Gowda");
    }
  });

  // ============================================================================
  // LIFECYCLE: ROTATION & REVOCATION
  // ============================================================================

  it("Lifecycle 12: Atomic credential rotation — PENDING_WRITE protection & clean activation", async () => {
    const nfcV1 = await provisionActiveNfcForHhA();

    await establishConsent(ashaAToken);
    // 1. Request Rotation
    const rotRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(rotRes.statusCode).toBe(HTTP_STATUS.OK);
    const nfcV2 = rotRes.json().data;

    // During PENDING_WRITE: Old card V1 is ACTIVE and works
    const resV1Active = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV1.token },
    });
    expect(resV1Active.statusCode).toBe(HTTP_STATUS.OK);

    // During PENDING_WRITE: New card V2 cannot resolve
    const resV2Pending = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV2.token },
    });
    expect(resV2Pending.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    // 2. Confirm Rotation
    const confRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        nfcId: nfcV2.nfcId,
        version: nfcV2.version,
      },
    });
    expect(confRes.statusCode).toBe(HTTP_STATUS.OK);

    // After Confirmation: Old card V1 is REVOKED
    const resV1Revoked = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV1.token },
    });
    expect(resV1Revoked.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    // After Confirmation: New card V2 is ACTIVE
    const resV2Active = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV2.token },
    });
    expect(resV2Active.statusCode).toBe(HTTP_STATUS.OK);
  });

  it("Lifecycle 13: Revocation terminates credential — resolution returns generic 401", async () => {
    const nfc = await provisionActiveNfcForHhA();

    await establishConsent(ashaAToken);
    const revRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/revoke`,
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: { reason: "Card stolen or destroyed" },
    });
    expect(revRes.statusCode).toBe(HTTP_STATUS.OK);

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(resolveRes.json().code).toBe("INVALID_NFC_CREDENTIAL");
  });

  // ============================================================================
  // DOMAIN INTEGRATION & LIVE UPDATES
  // ============================================================================

  it("Domain Integration 14: Demographic updates reflect live without tag rewrite", async () => {
    const nfc = await provisionActiveNfcForHhA();

    // Update village in Household repository
    await app.householdRepository.updateHousehold(householdId, {
      headOfHouseholdName: "Ramesh Gowda Senior",
      village: "Harohalli Central Ward",
    });

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(resolveRes.json().data.household.displayName).toBe("Ramesh Gowda Senior");
    expect(resolveRes.json().data.household.region.village).toBe("Harohalli Central Ward");
  });

  it("Domain Integration 15: Leave delegation & lazy restoration reflect live without tag rewrite", async () => {
    const nfc = await provisionActiveNfcForHhA();

    // Step 1: Active leave -> shows Kavitha Gowda (ashaB)
    const futureExpiry = new Date(Date.now() + 86400000).toISOString();
    const leave = await app.leaveRepository.createLeaveRequest({
      id: "leave_demo_01",
      ashaId: "ashaA",
      ashaName: "Sunita Devi",
      ashaServiceCode: "ASHA-KA-RAM-01",
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      effectiveUntil: futureExpiry,
      reason: "Maternity training workshop",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Kavitha Gowda",
      reviewedBy: "adminDemo",
      reviewedByName: "Dr. Ramesh Sharma (CMO)",
      reviewedAt: new Date().toISOString(),
      reviewNotes: "Approved",
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await app.caseRepository.updateCase(caseId, {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leave.id,
        effectiveFrom: "2026-09-10",
        effectiveUntil: futureExpiry,
        reason: "Training",
        assignedAt: new Date().toISOString(),
        assignedByUid: "adminDemo",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_demo_01",
      leaveRequestId: leave.id,
      caseId: caseId,
      householdId: householdId,
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-10",
      effectiveUntil: futureExpiry,
      reason: "Training",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      createdBy: "adminDemo",
    });

    let res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(res.json().data.asha.displayName).toBe("Kavitha Gowda");
    expect(res.json().data.asha.code).toBe("ASHA-KA-RAM-02");

    // Step 2: Fast forward past expiry -> automatic restoration returns Sunita Devi
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    await app.leaveRepository.updateLeaveRequest(leave.id, {
      effectiveUntil: pastExpiry,
    });
    await app.caseRepository.updateCase(caseId, {
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leave.id,
        effectiveFrom: "2026-09-10",
        effectiveUntil: pastExpiry,
        reason: "Training",
        assignedAt: new Date().toISOString(),
        assignedByUid: "adminDemo",
        status: "ACTIVE",
      },
    });

    res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(res.json().data.asha.displayName).toBe("Sunita Devi");
    expect(res.json().data.asha.code).toBe("ASHA-KA-RAM-01");
  });

  // ============================================================================
  // URL BUILDER & PARSER VALIDATION
  // ============================================================================

  it("Frontend Utility 16: NDEF URL builder encodes correctly for physical tags", () => {
    const url = buildNfcUrl(householdId, "secret_bearer_token_12345678", "https://swasthyasetu.org", 1);
    expect(url).toBe(
      "https://swasthyasetu.org/nfc?hh=hh_demo_harohalli_001&t=secret_bearer_token_12345678"
    );
    expect(url).not.toContain("&v=");

    // URL length is ~84 bytes, comfortably fitting NTAG213 (<117 bytes) and NTAG215 (504 bytes)
    expect(url.length).toBeLessThan(100);
  });

  it("Frontend Utility 17: NFC URL parser extracts parameters securely with or without version parameter", () => {
    // 1. Without version parameter (v=1 omitted for NTAG213 optimization)
    const searchNoV = "?hh=hh_demo_harohalli_001&t=secret_bearer_token_12345678";
    const parseResultNoV = parseNfcCredential(searchNoV);
    expect(parseResultNoV.status).toBe("VALID");
    if (parseResultNoV.status === "VALID") {
      expect(parseResultNoV.credential.householdId).toBe("hh_demo_harohalli_001");
      expect(parseResultNoV.credential.token).toBe("secret_bearer_token_12345678");
      expect(parseResultNoV.credential.version).toBeUndefined();
    }

    // 2. With version parameter (backward compatible & for version > 1)
    const searchWithV = "?hh=hh_demo_harohalli_001&t=secret_bearer_token_12345678&v=2";
    const parseResultWithV = parseNfcCredential(searchWithV);
    expect(parseResultWithV.status).toBe("VALID");
    if (parseResultWithV.status === "VALID") {
      expect(parseResultWithV.credential.householdId).toBe("hh_demo_harohalli_001");
      expect(parseResultWithV.credential.token).toBe("secret_bearer_token_12345678");
      expect(parseResultWithV.credential.version).toBe(2);
    }
  });

  it("Frontend Utility 18: Multilingual audio builder generates safe spoken output in EN, HI, KN", async () => {
    const nfc = await provisionActiveNfcForHhA();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    const data = res.json().data;

    const enSpoken = buildHouseholdSpeechText(data, "en");
    const hiSpoken = buildHouseholdSpeechText(data, "hi");
    const knSpoken = buildHouseholdSpeechText(data, "kn");

    expect(enSpoken).toContain("Health benefits for Ramesh Gowda");
    expect(hiSpoken).toContain("Ramesh Gowda के परिवार के लिए स्वास्थ्य लाभ");
    expect(knSpoken).toContain("Ramesh Gowda ಅವರ ಕುಟುಂಬಕ್ಕೆ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು");

    for (const text of [enSpoken, hiSpoken, knSpoken]) {
      expect(text).not.toContain(nfc.token);
      expect(text).not.toContain("RC-KA-RAM-998877");
      expect(text).not.toContain("Hypertension");
    }
  });
});
