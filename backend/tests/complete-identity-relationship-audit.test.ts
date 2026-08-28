import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { hashSecret } from "../src/utils/secret-hash.js";

describe("Complete Citizen <-> Household <-> ASHA <-> Case <-> Admin Relationship & Security Audit Suite", () => {
  let app: FastifyInstance;

  const ASHA_SECRET = "ValidAshaCode2026!";
  const ADMIN_SECRET = "ValidAdminCode2026!";
  const ASHA_HASH = hashSecret(ASHA_SECRET);
  const ADMIN_HASH = hashSecret(ADMIN_SECRET);

  const citizenAToken = "test_token_citizenA_citizen";
  const citizenBToken = "test_token_citizenB_citizen";
  const ashaAToken = "test_token_ashaA_asha";
  const ashaBToken = "test_token_ashaB_asha";
  const adminAToken = "test_token_adminA_admin";

  const establishConsent = async (token: string) => {
    return app.inject({
      method: "POST",
      url: "/api/v1/auth/consent",
      headers: { authorization: `Bearer ${token}` },
      payload: { consentVersion: "1.0", accepted: true },
    });
  };

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    app.privilegedAuthService.setHashes(ASHA_HASH, ADMIN_HASH);

    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();

    await seedSchemeRegistry(app.schemeRepository, true);
  });

  // ============================================================================
  // 1. AUTHENTICATION & PRIVILEGED REGISTRATION SECURITY
  // ============================================================================

  it("1-8: Auth Invariants - Role creation, persistence, sync idempotency, and fail-closed secrets", async () => {
    // 1. Citizen registration
    const citReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: { requestedRole: "CITIZEN", displayName: "Citizen A" },
    });
    expect(citReg.statusCode).toBe(HTTP_STATUS.OK);
    expect(citReg.json().data.user.role).toBe("CITIZEN");

    // 2. ASHA registration with valid code
    const ashaReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        requestedRole: "ASHA",
        registrationSecret: ASHA_SECRET,
        displayName: "ASHA Shanthi",
      },
    });
    expect(ashaReg.statusCode).toBe(HTTP_STATUS.OK);
    expect(ashaReg.json().data.user.role).toBe("ASHA");
    expect(ashaReg.json().data.user.ashaServiceCode).toMatch(/^ASHA-[A-Z]{2,3}-[A-Z0-9]{4,6}$/);
    const ashaAServiceCode = ashaReg.json().data.user.ashaServiceCode;

    // 3. Admin registration with valid secret
    const adminReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${adminAToken}` },
      payload: {
        requestedRole: "ADMIN",
        registrationSecret: ADMIN_SECRET,
        displayName: "Admin Officer",
      },
    });
    expect(adminReg.statusCode).toBe(HTTP_STATUS.OK);
    expect(adminReg.json().data.user.role).toBe("ADMIN");

    // 4. Prevalidate fails closed for wrong ASHA secret
    const badAshaPreval = await app.inject({
      method: "POST",
      url: "/api/v1/auth/prevalidate",
      payload: { requestedRole: "ASHA", registrationSecret: "WRONG_SECRET" },
    });
    expect(badAshaPreval.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // 5. Prevalidate fails closed for wrong Admin secret
    const badAdminPreval = await app.inject({
      method: "POST",
      url: "/api/v1/auth/prevalidate",
      payload: { requestedRole: "ADMIN", registrationSecret: "WRONG_SECRET" },
    });
    expect(badAdminPreval.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // 6. Existing ASHA role is preserved across login syncs
    const ashaSync = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sync",
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(ashaSync.statusCode).toBe(HTTP_STATUS.OK);
    expect(ashaSync.json().data.user.role).toBe("ASHA");
    expect(ashaSync.json().data.user.ashaServiceCode).toBe(ashaAServiceCode);

    // 7. Existing Admin role is preserved across login syncs
    const adminSync = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sync",
      headers: { authorization: `Bearer ${adminAToken}` },
    });
    expect(adminSync.statusCode).toBe(HTTP_STATUS.OK);
    expect(adminSync.json().data.user.role).toBe("ADMIN");

    // 8. Client cannot promote Citizen by supplying role: ADMIN in sync
    const citSync = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sync",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: { role: "ADMIN" } as any,
    });
    expect(citSync.statusCode).toBe(HTTP_STATUS.OK);
    expect(citSync.json().data.user.role).toBe("CITIZEN");
  });

  // ============================================================================
  // 2. CITIZEN ↔ HOUSEHOLD ↔ MEMBER OWNERSHIP & ISOLATION
  // ============================================================================

  it("9-13: Citizen & Household - Server-side ownerUid enforcement and IDOR defense", async () => {
    await establishConsent(citizenAToken);
    await establishConsent(citizenBToken);

    // 9. Citizen A creates household
    const hhResA = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: {
        headOfHouseholdName: "Siddharth Verma",
        rationCardNumber: "RC-KA-0001",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru Urban",
        village: "Ward 12",
        pincode: "560001",
      },
    });
    expect(hhResA.statusCode).toBe(HTTP_STATUS.CREATED);
    const hhA = hhResA.json().data.household;
    expect(hhA.ownerUid).toBe("citizenA");

    // 10. Citizen A sends spoofed ownerUid in creation payload -> server overrides with authenticated UID
    const spoofHhRes = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenBToken}` },
      payload: {
        ownerUid: "citizenA", // Attacker attempts to claim Citizen A's identity
        headOfHouseholdName: "Attacker Family",
        rationCardNumber: "RC-KA-0002",
        incomeCategory: "APL",
        state: "Karnataka",
        district: "Bengaluru Urban",
        village: "Ward 15",
        pincode: "560002",
      } as any,
    });
    expect(spoofHhRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const hhB = spoofHhRes.json().data.household;
    expect(hhB.ownerUid).toBe("citizenB"); // Strictly enforced as citizenB

    // 11. Citizen A adds family members
    const memRes = await app.inject({
      method: "POST",
      url: "/api/v1/households/me/members",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: {
        fullName: "Ramesh Verma",
        age: 72,
        gender: "male",
        relationship: "parent",
        disabilityStatus: false,
        chronicConditions: ["hypertension"],
      },
    });
    expect(memRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const memberId = memRes.json().data.member.id;

    // 12. Citizen B cannot read Citizen A's household via /households/me
    const myHhB = await app.inject({
      method: "GET",
      url: "/api/v1/households/me",
      headers: { authorization: `Bearer ${citizenBToken}` },
    });
    expect(myHhB.statusCode).toBe(HTTP_STATUS.OK);
    expect(myHhB.json().data.household.headOfHouseholdName).toBe("Attacker Family");
    expect(myHhB.json().data.household.ownerUid).toBe("citizenB");

    // 13. Citizen B cannot modify or delete Citizen A's family member
    const badDeleteMem = await app.inject({
      method: "DELETE",
      url: `/api/v1/households/me/members/${memberId}`,
      headers: { authorization: `Bearer ${citizenBToken}` },
    });
    expect(badDeleteMem.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
  });

  // ============================================================================
  // 3. ASHA SERVICE CODE LOOKUP & PRIVACY BOUNDARY
  // ============================================================================

  it("14-17: ASHA Directory - Exact lookup, format validation, and zero UID/PII leakage", async () => {
    await establishConsent(citizenAToken);
    await establishConsent(ashaAToken);

    // Register ASHA A
    const ashaReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: {
        requestedRole: "ASHA",
        registrationSecret: ASHA_SECRET,
        displayName: "Priya Sharma",
      },
    });
    const serviceCode = ashaReg.json().data.user.ashaServiceCode;

    // 14. Valid lookup
    const lookupRes = await app.inject({
      method: "GET",
      url: `/api/v1/asha/directory/${serviceCode}`,
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(lookupRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = lookupRes.json().data;
    expect(data.serviceCode).toBe(serviceCode);
    expect(data.displayName).toBe("Priya Sharma");

    // 17. Zero leakage of private fields
    expect(data.uid).toBeUndefined();
    expect(data.email).toBeUndefined();
    expect(data.phoneNumber).toBeUndefined();
    expect(data.registrationSecret).toBeUndefined();

    // 15. Format-compliant but non-existent lookup returns application 404
    const badLookup = await app.inject({
      method: "GET",
      url: "/api/v1/asha/directory/ASHA-KA-ZZ99",
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(badLookup.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(badLookup.json().code).toBe("ASHA_NOT_FOUND");

    // 16. Format-invalid lookup returns 400
    const formatBadLookup = await app.inject({
      method: "GET",
      url: "/api/v1/asha/directory/INVALID_CODE",
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(formatBadLookup.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  // ============================================================================
  // 4. CITIZEN ↔ ASHA CONNECTION & CASE LIFECYCLE
  // ============================================================================

  it("18-39: Connection Lifecycle, Caseload, IDOR Defense, and Idempotency", async () => {
    await establishConsent(citizenAToken);
    await establishConsent(ashaAToken);
    await establishConsent(ashaBToken);
    await establishConsent(adminAToken);

    // Register ASHA A & B
    const ashaAReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: { requestedRole: "ASHA", registrationSecret: ASHA_SECRET, displayName: "ASHA Shanthi" },
    });
    const ashaACode = ashaAReg.json().data.user.ashaServiceCode;

    const ashaBReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaBToken}` },
      payload: { requestedRole: "ASHA", registrationSecret: ASHA_SECRET, displayName: "ASHA Radha" },
    });
    const ashaBCode = ashaBReg.json().data.user.ashaServiceCode;
    expect(ashaACode).not.toBe(ashaBCode);

    // Create Citizen A household
    await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: {
        headOfHouseholdName: "Siddharth Verma",
        rationCardNumber: "RC-KA-1111",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Village A",
        pincode: "560001",
      },
    });

    // 18. Citizen A sends connection request to ASHA A
    const reqRes = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: { serviceCode: ashaACode, notes: "Please assist with senior healthcare" },
    });
    expect(reqRes.statusCode).toBe(HTTP_STATUS.CREATED);
    const requestId = reqRes.json().data.id;
    expect(reqRes.json().data.status).toBe("PENDING");
    expect(reqRes.json().data.ashaUid).toBe("ashaA");

    // 22. Duplicate submission is idempotent (returns existing PENDING request)
    const dupReq = await app.inject({
      method: "POST",
      url: "/api/v1/citizen/asha-connection/request",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: { serviceCode: ashaACode },
    });
    expect(dupReq.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(dupReq.json().data.id).toBe(requestId);

    // 24. ASHA B checks queue -> Cannot see ASHA A's request
    const queueB = await app.inject({
      method: "GET",
      url: "/api/v1/asha/connection-requests",
      headers: { authorization: `Bearer ${ashaBToken}` },
    });
    expect(queueB.statusCode).toBe(HTTP_STATUS.OK);
    expect(queueB.json().data.requests).toHaveLength(0);

    // 23. ASHA A checks queue -> Sees request from Citizen A
    const queueA = await app.inject({
      method: "GET",
      url: "/api/v1/asha/connection-requests",
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(queueA.statusCode).toBe(HTTP_STATUS.OK);
    expect(queueA.json().data.requests).toHaveLength(1);
    expect(queueA.json().data.requests[0].id).toBe(requestId);

    // 26. ASHA B attempts to accept ASHA A's request -> Rejected with 404 (IDOR Defense)
    const badAccept = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${ashaBToken}` },
    });
    expect(badAccept.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // 25. ASHA A accepts request
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: { note: "Accepted. Will visit tomorrow." },
    });
    expect(acceptRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(acceptRes.json().data.status).toBe("ACTIVE");

    // 28. Accepting already active request is rejected
    const repeatAccept = await app.inject({
      method: "POST",
      url: `/api/v1/asha/connection-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(repeatAccept.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

    // 30-32. Verify AshaCase created and correctly linked
    const casesRes = await app.inject({
      method: "GET",
      url: "/api/v1/asha/cases",
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(casesRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(casesRes.json().data.cases).toHaveLength(1);
    const caseItem = casesRes.json().data.cases[0];
    expect(caseItem.assignedAshaUid).toBe("ashaA");
    expect(caseItem.headOfHouseholdName).toBe("Siddharth Verma");

    // 35-36. ASHA B cannot access or mutate ASHA A's case
    const ashaBGetCase = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseItem.id}`,
      headers: { authorization: `Bearer ${ashaBToken}` },
    });
    expect(ashaBGetCase.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    const ashaBPatchCase = await app.inject({
      method: "PATCH",
      url: `/api/v1/asha/cases/${caseItem.id}`,
      headers: { authorization: `Bearer ${ashaBToken}` },
      payload: { status: "CLOSED" },
    });
    expect(ashaBPatchCase.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // 37. Citizen cannot access ASHA case management endpoints
    const citGetCase = await app.inject({
      method: "GET",
      url: `/api/v1/asha/cases/${caseItem.id}`,
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(citGetCase.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // Citizen checks active connection status
    const citConnStatus = await app.inject({
      method: "GET",
      url: "/api/v1/citizen/asha-connection",
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(citConnStatus.statusCode).toBe(HTTP_STATUS.OK);
    expect(citConnStatus.json().data.status).toBe("ACTIVE");
    expect(citConnStatus.json().data.asha.serviceCode).toBe(ashaACode);
  });

  // ============================================================================
  // 5. ADMIN CASE GOVERNANCE & ASSIGNMENT
  // ============================================================================

  it("40-46: Admin Governance - Cross-caseload inspection and valid ASHA assignment", async () => {
    await establishConsent(citizenAToken);
    await establishConsent(ashaAToken);
    await establishConsent(ashaBToken);
    await establishConsent(adminAToken);

    // Register ASHA A & B, and Admin
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: { requestedRole: "ASHA", registrationSecret: "ASHA-KARNATAKA-2026" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${ashaBToken}` },
      payload: { requestedRole: "ASHA", registrationSecret: "ASHA-KARNATAKA-2026" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { authorization: `Bearer ${adminAToken}` },
      payload: { requestedRole: "ADMIN", registrationSecret: "SWASTHYA-ADMIN-ROOT-2026" },
    });

    // Create household & case
    const hhRes = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: { authorization: `Bearer ${citizenAToken}` },
      payload: {
        headOfHouseholdName: "Governance Family",
        rationCardNumber: "RC-KA-9999",
        incomeCategory: "BPL",
        state: "Karnataka",
        district: "Bengaluru",
        village: "Gov Ward",
        pincode: "560001",
      },
    });
    const householdId = hhRes.json().data.household.id;

    // 41-42. Citizen & ASHA cannot access Admin endpoints
    const citAdminCall = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${citizenAToken}` },
    });
    expect(citAdminCall.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    const ashaAdminCall = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(ashaAdminCall.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // 44. Admin cannot assign case to a Citizen
    const badAssignCitizen = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminAToken}` },
      payload: { householdId, ashaUid: "citizenA" },
    });
    expect(badAssignCitizen.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

    // 45. Admin cannot assign case to non-existent user
    const badAssignMissing = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminAToken}` },
      payload: { householdId, ashaUid: "nonexistent-uid-404" },
    });
    expect(badAssignMissing.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

    // 43. Admin assigns case to ASHA B
    const assignRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cases/assign",
      headers: { authorization: `Bearer ${adminAToken}` },
      payload: { householdId, ashaUid: "ashaB" },
    });
    expect(assignRes.statusCode).toBe(HTTP_STATUS.OK);
    expect(assignRes.json().data.case.assignedAshaUid).toBe("ashaB");

    // 40. Admin lists platform cases
    const adminList = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cases",
      headers: { authorization: `Bearer ${adminAToken}` },
    });
    expect(adminList.statusCode).toBe(HTTP_STATUS.OK);
    expect(adminList.json().data.cases.length).toBeGreaterThan(0);
  });
});
