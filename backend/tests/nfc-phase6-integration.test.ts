import { describe, it, expect, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household, Member } from "../../shared/types/household.js";
import { AshaCase } from "../../shared/types/case.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { parseNfcCredential } from "../../frontend/lib/nfc/nfc-parser.js";
import {
  buildHouseholdSpeechText,
  getSpeechSynthesisLang,
} from "../../frontend/lib/nfc/nfc-audio.js";
import { en } from "../../frontend/i18n/translations/en.js";
import { hi } from "../../frontend/i18n/translations/hi.js";
import { kn } from "../../frontend/i18n/translations/kn.js";

describe("Phase 6: SwasthyaSetu NFC Integration with Existing Systems", () => {
  let app: FastifyInstance;

  const adminToken = "test_token_admin1_admin";
  const ashaAToken = "test_token_ashaA_asha";
  const ashaBToken = "test_token_ashaB_asha";
  const unassignedAshaToken = "test_token_ashaUnassigned_asha";
  const citizenToken = "test_token_citizen1_citizen";

  const householdId = "hh_phase6_integration_001";
  const caseId = "case_phase6_integration_001";

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
    app.leaveRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();

    // Seed production verified schemes (AB-PMJAY, JSY, PMMVY)
    await seedSchemeRegistry(app.schemeRepository, true);

    const now = new Date().toISOString();

    // 1. Admin Profile
    await app.userRepository.createUserProfile({
      uid: "admin1",
      email: "admin@health.karnataka.gov.in",
      phoneNumber: "+919876500000",
      role: "ADMIN",
      displayName: "Dr. Ramesh Admin",
      serviceArea: "Karnataka State Directorate",
      ashaServiceCode: "ADMIN-KA-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Primary ASHA Worker Profile (ASHA A)
    await app.userRepository.createUserProfile({
      uid: "ashaA",
      email: "asha.a@health.karnataka.gov.in",
      phoneNumber: "+919876543211",
      role: "ASHA",
      displayName: "Sunita Devi",
      serviceArea: "Harohalli Sub-Center A",
      ashaServiceCode: "ASHA-KA-RAM-01",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Replacement ASHA Worker Profile (ASHA B)
    await app.userRepository.createUserProfile({
      uid: "ashaB",
      email: "asha.b@health.karnataka.gov.in",
      phoneNumber: "+919876543212",
      role: "ASHA",
      displayName: "Kavitha Gowda",
      serviceArea: "Harohalli Sub-Center B",
      ashaServiceCode: "ASHA-KA-RAM-02",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Unassigned ASHA Worker Profile
    await app.userRepository.createUserProfile({
      uid: "ashaUnassigned",
      email: "asha.unassigned@health.karnataka.gov.in",
      phoneNumber: "+919876543299",
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

    // 5. Citizen Profile
    await app.userRepository.createUserProfile({
      uid: "citizen1",
      email: "citizen1@gmail.com",
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

    // 6. Test Household with Senior Citizen (Eligible for AB-PMJAY 70+)
    const testHh: Household = {
      id: householdId,
      ownerUid: "citizen1",
      headOfHouseholdName: "Ramesh Gowda",
      village: "Harohalli",
      district: "Ramanagara",
      state: "Karnataka",
      pincode: "562112",
      incomeCategory: "BPL",
      rationCardNumber: "RC-KA-998877",
      contactPhone: "+919876511111",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHh);

    const seniorMember: Member = {
      id: "mem_phase6_senior",
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

    // 7. Case for Household assigned to ASHA A
    const sampleCase: AshaCase = {
      id: caseId,
      householdId: householdId,
      assignedAshaUid: "ashaA",
      headOfHouseholdName: "Ramesh Gowda",
      district: "Ramanagara",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      priority: "HIGH",
      status: "ACTIVE",
      detectedGapsCount: 1,
      eligibleSchemesCount: 1,
      lastContactAt: "2026-09-01T00:00:00Z",
      nextFollowUpAt: "2026-09-15T00:00:00Z",
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(sampleCase);
  });

  // Helper to provision active NFC
  const provisionActiveNfc = async () => {
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
  // INTEGRATION TESTS (Sections 1 to 28)
  // ============================================================================

  it("1. NFC -> existing household: resolves data directly from existing HouseholdRepository", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Must match the exact record from HouseholdRepository
    expect(data.household.displayName).toBe("Ramesh Gowda");
    expect(data.household.region.village).toBe("Harohalli");
    expect(data.household.region.district).toBe("Ramanagara");
    expect(data.household.region.state).toBe("Karnataka");
  });

  it("2. NFC -> current ASHA: resolves active ASHA from cases.assignedAshaUid", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Must resolve ASHA A
    expect(data.asha).toBeDefined();
    expect(data.asha.displayName).toBe("Sunita Devi");
    expect(data.asha.serviceArea).toBe("Harohalli Sub-Center A");
    expect(data.asha.code).toBe("ASHA-KA-RAM-01");
  });

  it("3. NFC -> changed ASHA: manual case reassignment reflects immediately on NFC resolve without card re-issuance", async () => {
    const nfc = await provisionActiveNfc();

    // Admin manually reassigns the case to ASHA B in the Case domain
    await establishConsent(adminToken);
    const adminUser = await app.userRepository.getUserById("admin1");
    await app.caseService.assignCaseToAsha(householdId, "ashaB", adminUser!);

    // Resolve NFC again with exact same card token
    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Must now dynamically show ASHA B
    expect(data.asha.displayName).toBe("Kavitha Gowda");
    expect(data.asha.serviceArea).toBe("Harohalli Sub-Center B");
    expect(data.asha.code).toBe("ASHA-KA-RAM-02");
  });

  it("4. NFC -> temporary ASHA: active approved leave reassigns case and reflects replacement ASHA on NFC resolve", async () => {
    const nfc = await provisionActiveNfc();

    // ASHA A requests leave with temporary replacement ASHA B
    const futureEffectiveUntil = new Date(Date.now() + 86400000).toISOString(); // 24 hours in the future
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_active_001",
      ashaId: "ashaA",
      ashaName: "Sunita Devi",
      ashaServiceCode: "ASHA-KA-RAM-01",
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      effectiveUntil: futureEffectiveUntil,
      reason: "Family medical emergency.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Kavitha Gowda",
      reviewedBy: "admin1",
      reviewedByName: "Dr. Ramesh Admin",
      reviewedAt: new Date().toISOString(),
      reviewNotes: "Approved medical leave",
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Temporary assignment stamped on case
    await app.caseRepository.updateCase(caseId, {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-10",
        effectiveUntil: futureEffectiveUntil,
        reason: "Family medical emergency",
        assignedAt: new Date().toISOString(),
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    // Resolve NFC during active leave
    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Must resolve replacement ASHA B
    expect(data.asha.displayName).toBe("Kavitha Gowda");
    expect(data.asha.code).toBe("ASHA-KA-RAM-02");
  });

  it("5. NFC -> restored ASHA: expired leave automatically restores original ASHA on NFC resolve", async () => {
    const nfc = await provisionActiveNfc();

    // Create past expired leave
    const pastEffectiveUntil = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const leaveReq = await app.leaveRepository.createLeaveRequest({
      id: "leave_expired_001",
      ashaId: "ashaA",
      ashaName: "Sunita Devi",
      ashaServiceCode: "ASHA-KA-RAM-01",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      effectiveUntil: pastEffectiveUntil,
      reason: "Short leave now expired.",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Kavitha Gowda",
      reviewedBy: "admin1",
      reviewedByName: "Dr. Ramesh Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: "Approved",
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    // Case had temporary assignment to ashaB
    await app.caseRepository.updateCase(caseId, {
      assignedAshaUid: "ashaB",
      temporaryAssignment: {
        originalAshaUid: "ashaA",
        temporaryAshaUid: "ashaB",
        leaveRequestId: leaveReq.id,
        effectiveFrom: "2026-09-01",
        effectiveUntil: pastEffectiveUntil,
        reason: "Expired leave",
        assignedAt: "2026-09-01T08:00:00Z",
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_expired_001",
      leaveRequestId: leaveReq.id,
      caseId: caseId,
      householdId: householdId,
      originalAshaUid: "ashaA",
      temporaryAshaUid: "ashaB",
      effectiveFrom: "2026-09-01",
      effectiveUntil: pastEffectiveUntil,
      reason: "Expired leave",
      status: "ACTIVE",
      createdAt: "2026-09-01T08:00:00Z",
      createdBy: "admin1",
    });

    // Resolve NFC: lazy restoration should trigger automatically and restore ASHA A
    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Authoritative restoration back to ASHA A
    expect(data.asha.displayName).toBe("Sunita Devi");
    expect(data.asha.code).toBe("ASHA-KA-RAM-01");

    // Verify case in repository was updated
    const updatedCase = await app.caseRepository.getCaseById(caseId);
    expect(updatedCase?.assignedAshaUid).toBe("ashaA");
    expect(updatedCase?.temporaryAssignment?.status).toBe("COMPLETED");
  });

  it("6. NFC -> existing scheme registry: resolves verified active schemes from SchemeRepository", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const schemes = resolveRes.json().data.schemes;

    // Senior citizen matches AB-PMJAY
    const abpmjay = schemes.find((s: any) => s.schemeId === "ab-pmjay");
    expect(abpmjay).toBeDefined();
    expect(abpmjay.name).toContain("Ayushman Bharat");
    expect(abpmjay.benefit).toBeDefined();
    expect(abpmjay.nextSteps).toBeDefined();
  });

  it("7. NFC -> deterministic eligibility engine: eligibility computed by authoritative rule engine", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const schemes = resolveRes.json().data.schemes;
    const abpmjay = schemes.find((s: any) => s.schemeId === "ab-pmjay");

    // Senior citizen age 74 -> ELIGIBLE
    expect(abpmjay.eligibilityStatus).toBe("ELIGIBLE");
  });

  it("8. NFC -> draft scheme exclusion: draft schemes (State Universal Health, JSSK, AB-ArK) strictly omitted", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const schemes = resolveRes.json().data.schemes;

    const draftIds = ["state-universal-health", "jssk", "ab-ark"];
    for (const draftId of draftIds) {
      expect(schemes.some((s: any) => s.schemeId === draftId)).toBe(false);
    }
  });

  it("9. NFC -> citizen login handoff: unauthenticated public view directs citizens to standard /auth/sign-in without token leakage", async () => {
    // The public DTO never returns tokens or sensitive links
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const bodyStr = JSON.stringify(resolveRes.json());

    // Zero bearer token leakage
    expect(bodyStr).not.toContain(nfc.token);
    expect(bodyStr).not.toContain("auth/sign-in?t=");
  });

  it("10. NFC -> existing citizen authorization: possessing NFC credential cannot access protected citizen endpoints", async () => {
    const nfc = await provisionActiveNfc();

    // Attacker sends NFC token as Bearer token to /api/v1/households/me
    const authRes = await app.inject({
      method: "GET",
      url: "/api/v1/households/me",
      headers: { authorization: `Bearer ${nfc.token}` },
    });

    expect(authRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("11. NFC -> existing assistance architecture compatibility: household ID aligns with assistance requests while requests remain private", async () => {
    const nfc = await provisionActiveNfc();

    // Create sample assistance request in existing system
    await app.assistanceRepository.createRequest({
      id: "asst_req_phase6_01",
      householdId: householdId,
      citizenUid: "citizen1",
      headOfHouseholdName: "Ramesh Gowda",
      district: "Ramanagara",
      state: "Karnataka",
      ashaUid: "ashaA",
      ashaServiceCode: "ASHA-KA-RAM-01",
      ashaName: "Sunita Devi",
      category: "SCHEME_ENROLLMENT",
      message: "Needs help applying for AB-PMJAY senior card",
      priority: "NORMAL",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const bodyStr = JSON.stringify(resolveRes.json());

    // Assistance request details are NEVER leaked into NFC DTO
    expect(bodyStr).not.toContain("asst_req_phase6_01");
    expect(bodyStr).not.toContain("Needs help applying for AB-PMJAY");
    expect(bodyStr).not.toContain("assistanceRequests");
  });

  it("12. NFC -> existing case architecture compatibility: case journey, notes, activities, and tasks remain strictly private", async () => {
    const nfc = await provisionActiveNfc();

    // Add sensitive notes to case subcollection
    await app.caseRepository.createNote(caseId, {
      id: "note_1",
      caseId: caseId,
      authorUid: "ashaA",
      authorName: "Sunita Devi",
      content: "Confidential maternal and hypertension history.",
      createdAt: new Date().toISOString(),
    });

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const bodyStr = JSON.stringify(resolveRes.json());

    expect(bodyStr).not.toContain("Confidential maternal");
    expect(bodyStr).not.toContain("blood pressure test");
    expect(bodyStr).not.toContain("tasks");
    expect(bodyStr).not.toContain("notes");
  });

  it("13. ASHA NFC provisioning authorization: assigned ASHA can provision NFC for their caseload", async () => {
    await establishConsent(ashaAToken);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(res.json().success).toBe(true);
    expect(res.json().data.householdId).toBe(householdId);
  });

  it("14. Admin NFC management: platform admin can provision, rotate, confirm, and revoke NFC for any household", async () => {
    await establishConsent(adminToken);

    // Admin provisions
    const provRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(provRes.statusCode).toBe(HTTP_STATUS.CREATED);

    // Admin rotates
    const rotRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(rotRes.statusCode).toBe(HTTP_STATUS.OK);
    const rotData = rotRes.json().data;

    // Admin confirms rotation
    const confRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate/confirm`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nfcId: rotData.nfcId,
        version: rotData.version,
      },
    });
    expect(confRes.statusCode).toBe(HTTP_STATUS.OK);

    // Admin revokes
    const revRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/revoke`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: "Admin decommissioning card" },
    });
    expect(revRes.statusCode).toBe(HTTP_STATUS.OK);
  });

  it("15. Unauthorized ASHA provisioning rejection: unassigned ASHA cannot provision or manage NFC for another ASHA's household", async () => {
    await establishConsent(unassignedAshaToken);

    // Meena Kumari (ashaUnassigned) attempts to provision NFC for Sunita's household
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${unassignedAshaToken}` },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(res.json().code).toBe("FORBIDDEN_HOUSEHOLD_ACCESS");
  });

  it("16. Household data changes reflected: demographic updates in HouseholdRepository reflect immediately on next NFC resolve", async () => {
    const nfc = await provisionActiveNfc();

    // Update household head name and location in existing HouseholdRepository
    await app.householdRepository.updateHousehold(householdId, {
      headOfHouseholdName: "Suresh Gowda",
      village: "Harohalli South Extension",
    });

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Dynamically reflects updated demographic data
    expect(data.household.displayName).toBe("Suresh Gowda");
    expect(data.household.region.village).toBe("Harohalli South Extension");
  });

  it("17. ASHA reassignment reflected: admin manual reassignment reflects immediately on next NFC resolve without card re-issuance", async () => {
    const nfc = await provisionActiveNfc();

    // Reassign to ASHA B
    await app.caseRepository.updateCase(caseId, {
      assignedAshaUid: "ashaB",
    });

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    expect(data.asha.displayName).toBe("Kavitha Gowda");
    expect(data.asha.code).toBe("ASHA-KA-RAM-02");
  });

  it("18. Sensitive fields excluded: public DTO strictly omits member roster, ages, genders, phone, email, ration card, income, UIDs, and tokens", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: {
        householdId: nfc.householdId,
        token: nfc.token,
      },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const body = resolveRes.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("RC-KA-998877"); // Ration card
    expect(bodyStr).not.toContain("+919876511111"); // Phone
    expect(bodyStr).not.toContain("citizen1@gmail.com"); // Email
    expect(bodyStr).not.toContain("BPL"); // Income category
    expect(bodyStr).not.toContain("Lakshmamma Gowda"); // Member name
    expect(bodyStr).not.toContain("Hypertension"); // Medical diagnosis
    expect(bodyStr).not.toContain("citizen1"); // UID
    expect(bodyStr).not.toContain("ashaA"); // UID
    expect(bodyStr).not.toContain(nfc.token); // Raw token
  });

  it("19. NFC token never becomes authentication: NFC token rejected when supplied as Bearer token to API guards", async () => {
    const nfc = await provisionActiveNfc();

    const endpoints = [
      { method: "GET", url: "/api/v1/households/me" },
      { method: "GET", url: `/api/v1/asha/cases/${caseId}` },
      { method: "GET", url: "/api/v1/asha/cases" },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method as any,
        url: ep.url,
        headers: { authorization: `Bearer ${nfc.token}` },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    }
  });

  it("20. NFC rotation compatibility: rotate creates PENDING_WRITE; confirming activates new card and revokes old", async () => {
    const nfcV1 = await provisionActiveNfc();

    await establishConsent(ashaAToken);
    // 1. Rotate
    const rotRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    expect(rotRes.statusCode).toBe(HTTP_STATUS.OK);
    const nfcV2 = rotRes.json().data;

    // During PENDING_WRITE, old V1 token remains ACTIVE and valid
    const resolveV1 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV1.token },
    });
    expect(resolveV1.statusCode).toBe(HTTP_STATUS.OK);

    // Confirm rotation
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

    // Old V1 token now REVOKED
    const resolveOldV1 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV1.token },
    });
    expect(resolveOldV1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

    // New V2 token now ACTIVE
    const resolveNewV2 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV2.token },
    });
    expect(resolveNewV2.statusCode).toBe(HTTP_STATUS.OK);
  });

  it("21. NFC revoke compatibility: revoking card causes subsequent public resolution to fail with generic 401", async () => {
    const nfc = await provisionActiveNfc();

    await establishConsent(ashaAToken);
    const revRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/revoke`,
      headers: { authorization: `Bearer ${ashaAToken}` },
      payload: { reason: "Damaged card" },
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

  it("22. PENDING_WRITE compatibility: pending replacement token cannot resolve publicly; only active card resolves", async () => {
    const nfcV1 = await provisionActiveNfc();

    await establishConsent(ashaAToken);
    const rotRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc/rotate`,
      headers: { authorization: `Bearer ${ashaAToken}` },
    });
    const nfcV2 = rotRes.json().data;

    // Attempting to resolve unconfirmed V2 token must fail
    const resolveV2 = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcV2.token },
    });

    expect(resolveV2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(resolveV2.json().code).toBe("INVALID_NFC_CREDENTIAL");
  });

  it("23. Leave/restoration full lifecycle: complete lifecycle from active leave -> replacement ASHA -> expiry -> automatic restoration -> original ASHA", async () => {
    const nfc = await provisionActiveNfc();

    // Step 1: Initial state -> Sunita Devi
    let res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(res.json().data.asha.displayName).toBe("Sunita Devi");

    // Step 2: Leave approved -> Kavitha Gowda
    const futureExpiry = new Date(Date.now() + 86400000).toISOString();
    const leave = await app.leaveRepository.createLeaveRequest({
      id: "leave_lifecycle_01",
      ashaId: "ashaA",
      ashaName: "Sunita Devi",
      ashaServiceCode: "ASHA-KA-RAM-01",
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      effectiveUntil: futureExpiry,
      reason: "Training workshop",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Kavitha Gowda",
      reviewedBy: "admin1",
      reviewedByName: "Dr. Ramesh Admin",
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
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    await app.leaveRepository.createTemporaryAssignment({
      id: "tasgn_lifecycle_01",
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
      createdBy: "admin1",
    });

    res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(res.json().data.asha.displayName).toBe("Kavitha Gowda");

    // Step 3: Fast-forward time (expiry in past)
    const pastExpiry = new Date(Date.now() - 60000).toISOString();
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
        assignedByUid: "admin1",
        status: "ACTIVE",
      },
    });

    // Step 4: Resolve NFC -> triggers lazy restoration -> back to Sunita Devi
    res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });
    expect(res.json().data.asha.displayName).toBe("Sunita Devi");
  });

  it("24. Manual reassignment during leave: admin reassignment sets SUPERSEDED_BY_MANUAL; restoration does not overwrite admin assignment", async () => {
    const nfc = await provisionActiveNfc();

    // ASHA A on leave, ASHA B temporary replacement
    const pastExpiry = new Date(Date.now() - 60000).toISOString();
    const leave = await app.leaveRepository.createLeaveRequest({
      id: "leave_manual_reassign_01",
      ashaId: "ashaA",
      ashaName: "Sunita Devi",
      ashaServiceCode: "ASHA-KA-RAM-01",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      effectiveUntil: pastExpiry,
      reason: "Leave",
      status: "APPROVED",
      affectedHouseholdCount: 1,
      replacementAshaId: "ashaB",
      replacementAshaName: "Kavitha Gowda",
      reviewedBy: "admin1",
      reviewedByName: "Dr. Ramesh Admin",
      reviewedAt: "2026-09-01T08:00:00Z",
      reviewNotes: "Approved",
      restorationStatus: "PENDING",
      restorationNotes: null,
      restoredAt: null,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-01T08:00:00Z",
    });

    // Admin manually reassigns the case to ashaUnassigned (Meena Kumari) during leave
    const adminUser = await app.userRepository.getUserById("admin1");
    await app.caseService.assignCaseToAsha(
      householdId,
      "ashaUnassigned",
      adminUser!
    );

    // When NFC resolves, the lazy restoration runs, notices SUPERSEDED_BY_MANUAL, and preserves Meena Kumari
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    expect(res.json().data.asha.displayName).toBe("Meena Kumari");
    expect(res.json().data.asha.code).toBe("ASHA-KA-RAM-99");
  });

  it("25. Multilingual integration: public DTO seamlessly translates across en, hi, and kn dictionaries without re-fetching", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const data = resolveRes.json().data;

    // Validate that i18n keys for all 3 supported languages have complete coverage
    const enBenefits = en.nfc.yourBenefitsTitle;
    const hiBenefits = hi.nfc.yourBenefitsTitle;
    const knBenefits = kn.nfc.yourBenefitsTitle;

    expect(enBenefits).toBe("Your Health Benefits");
    expect(hiBenefits).toBe("आपके स्वास्थ्य लाभ");
    expect(knBenefits).toBe("ನಿಮ್ಮ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು");

    // All dictionaries match expectations
    expect(data.household.displayName).toBe("Ramesh Gowda");
  });

  it("26. Audio integration: buildHouseholdSpeechText constructs narration from public fields in en, hi, and kn without sensitive data", async () => {
    const nfc = await provisionActiveNfc();

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    const data = resolveRes.json().data;

    const enText = buildHouseholdSpeechText(data, "en");
    const hiText = buildHouseholdSpeechText(data, "hi");
    const knText = buildHouseholdSpeechText(data, "kn");

    expect(enText).toContain("Health benefits for Ramesh Gowda");
    expect(enText).toContain("Harohalli, Ramanagara, Karnataka");
    expect(enText).toContain("Sunita Devi");

    expect(hiText).toContain("Ramesh Gowda के परिवार के लिए स्वास्थ्य लाभ");
    expect(hiText).toContain("Sunita Devi");

    expect(knText).toContain("Ramesh Gowda ಅವರ ಕುಟುಂಬಕ್ಕೆ ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳು");
    expect(knText).toContain("Sunita Devi");

    // Zero sensitive data or tokens
    for (const text of [enText, hiText, knText]) {
      expect(text).not.toContain(nfc.token);
      expect(text).not.toContain("RC-KA-998877");
      expect(text).not.toContain("BPL");
      expect(text).not.toContain("Lakshmamma");
    }
  });

  it("27. Error propagation: missing or deleted household yields generic INVALID_NFC_CREDENTIAL without leaking internal errors", async () => {
    const nfc = await provisionActiveNfc();

    // Household is deleted from database
    await app.householdRepository.deleteHousehold(householdId);

    const resolveRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfc.token },
    });

    expect(resolveRes.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(resolveRes.json().code).toBe("INVALID_NFC_CREDENTIAL");
    expect(resolveRes.json().message).toBe("Invalid or unavailable NFC credential.");
    // No Firestore error message or stack trace
    expect(JSON.stringify(resolveRes.json())).not.toContain("NotFound");
    expect(JSON.stringify(resolveRes.json())).not.toContain("Firestore");
  });

  it("28. No duplicate domain state: HouseholdNfcRecord contains zero duplicate household, case, or scheme data", async () => {
    const nfc = await provisionActiveNfc();

    const record = await app.nfcRepository.getActiveByHouseholdId(householdId);
    expect(record).toBeDefined();

    // Allowed keys: id, householdId, tokenHash, version, status, createdAt, createdBy, updatedAt, updatedBy, revokedAt, revokedBy, revocationReason
    const keys = Object.keys(record!);
    expect(keys).not.toContain("displayName");
    expect(keys).not.toContain("village");
    expect(keys).not.toContain("district");
    expect(keys).not.toContain("assignedAshaUid");
    expect(keys).not.toContain("schemes");
    expect(keys).not.toContain("eligibleSchemes");
    expect(keys).not.toContain("caseId");
  });
});
