import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { Household } from "@shared/types/household";
import { AshaCase } from "@shared/types/case";

describe("SwasthyaSetu — Scheme Care Work Resolution & Public Reflection", () => {
  let app: FastifyInstance;

  const citizenToken = "test_token_citizen101_citizen";
  const citizenUid = "citizen101";
  const ashaAssignedToken = "test_token_asha101_asha";
  const ashaAssignedUid = "asha101";
  const ashaOtherToken = "test_token_asha102_asha";
  const ashaOtherUid = "asha102";

  const householdId = "hh_care_res_001";
  const caseId = "case_care_res_001";
  let nfcToken: string;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Reset memory stores
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
    app.schemeRepository.clearMemoryStore();
    app.connectionRepository.clearMemoryStore();
    app.assistanceRepository.clearMemoryStore();
    app.caseRepository.clearMemoryStore();
    app.nfcRepository.clearMemoryStore();

    // Seed production schemes
    await seedSchemeRegistry(app.schemeRepository, true);

    // Establish consent for actors
    for (const token of [citizenToken, ashaAssignedToken, ashaOtherToken]) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/consent",
        headers: { authorization: `Bearer ${token}` },
        payload: { consentVersion: "1.0", accepted: true },
      });
    }

    // Set ASHA profiles
    await app.userRepository.updateUserProfile(ashaAssignedUid, {
      displayName: "Sunita ASHA",
      ashaServiceCode: "ASHA-KA-1111",
      serviceArea: "Nelamangala PHC",
      role: "ASHA",
    });

    await app.userRepository.updateUserProfile(ashaOtherUid, {
      displayName: "Other ASHA",
      ashaServiceCode: "ASHA-KA-2222",
      serviceArea: "Doddaballapura PHC",
      role: "ASHA",
    });

    const now = new Date().toISOString();

    // Create Household for citizen with 71-year-old senior (eligible for ab-pmjay)
    const testHousehold: Household = {
      id: householdId,
      ownerUid: citizenUid,
      headOfHouseholdName: "Suresh Patil",
      contactPhone: "9876543210",
      incomeCategory: "BPL",
      rationCardNumber: "RAT-KA-5521",
      state: "Karnataka",
      district: "Bengaluru Rural",
      village: "Nelamangala",
      pincode: "562123",
      createdAt: now,
      updatedAt: now,
    };
    await app.householdRepository.createHousehold(testHousehold);

    await app.householdRepository.createMember(householdId, {
      id: "mem_senior_71",
      householdId,
      fullName: "Nagappa Patil",
      age: 71,
      gender: "male",
      relationship: "Grandfather",
      createdAt: now,
      updatedAt: now,
    });

    // Create active AshaCase for the household assigned to Sunita ASHA
    const testCase: AshaCase = {
      id: caseId,
      householdId,
      assignedAshaUid: ashaAssignedUid,
      headOfHouseholdName: "Suresh Patil",
      district: "Bengaluru Rural",
      state: "Karnataka",
      incomeCategory: "BPL",
      memberCount: 2,
      status: "ACTIVE",
      priority: "HIGH",
      detectedGapsCount: 1,
      eligibleSchemesCount: 1,
      schemeId: "ab-pmjay",
      resolvedSchemes: [],
      lastContactAt: now,
      nextFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await app.caseRepository.createCase(testCase);

    // Provision NFC for the household
    const provRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/households/${householdId}/nfc`,
      headers: { authorization: `Bearer ${ashaAssignedToken}` },
    });
    expect(provRes.statusCode).toBe(HTTP_STATUS.CREATED);
    nfcToken = JSON.parse(provRes.payload).data.token;
  });

  it("1. Initially shows scheme as qualifying but not resolved in citizen eligibility and NFC", async () => {
    // Check citizen eligibility
    const eligRes = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(eligRes.statusCode).toBe(HTTP_STATUS.OK);
    const eligBody = JSON.parse(eligRes.payload);
    expect(eligBody.success).toBe(true);
    expect(eligBody.data.hasHousehold).toBe(true);
    expect(eligBody.data.resolvedSchemeIds).toEqual([]);

    const pmjayRes = eligBody.data.results.find((r: any) => r.schemeId === "ab-pmjay");
    expect(pmjayRes).toBeDefined();
    expect(pmjayRes.status).toBe("ELIGIBLE");

    // Check NFC public resolution
    const nfcRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcToken },
    });
    expect(nfcRes.statusCode).toBe(HTTP_STATUS.OK);
    const nfcBody = JSON.parse(nfcRes.payload);
    expect(nfcBody.success).toBe(true);

    const nfcPmjay = nfcBody.data.schemes.find((s: any) => s.schemeId === "ab-pmjay");
    // Before ASHA resolution, qualifying scheme reports ELIGIBLE (rendered as Eligible (Action Required) in UI)
    expect(nfcPmjay.eligibilityStatus).toBe("ELIGIBLE");
  });

  it("2. Enforces RBAC & IDOR on scheme resolution endpoint", async () => {
    // Non-ASHA (citizen) cannot resolve scheme
    const citizenAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/resolve-scheme`,
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { schemeId: "ab-pmjay", resolved: true },
    });
    expect(citizenAttempt.statusCode).toBe(HTTP_STATUS.FORBIDDEN);

    // Unassigned ASHA from different service area gets 404 Not Found (anti-enumeration security)
    const unassignedAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/resolve-scheme`,
      headers: { authorization: `Bearer ${ashaOtherToken}` },
      payload: { schemeId: "ab-pmjay", resolved: true },
    });
    expect(unassignedAttempt.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
  });

  it("3. ASHA resolving scheme updates resolvedSchemes, citizen eligibility, and public NFC", async () => {
    // Assigned ASHA marks scheme resolved
    const resolveRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/resolve-scheme`,
      headers: { authorization: `Bearer ${ashaAssignedToken}` },
      payload: {
        schemeId: "ab-pmjay",
        resolved: true,
        notes: "Verified Senior Citizen Ayushman Card created and handed over.",
      },
    });
    expect(resolveRes.statusCode).toBe(HTTP_STATUS.OK);
    const resolveBody = JSON.parse(resolveRes.payload);
    expect(resolveBody.success).toBe(true);
    expect(resolveBody.data.case.resolvedSchemes).toContain("ab-pmjay");

    // Check citizen eligibility now returns resolvedSchemeIds containing ab-pmjay
    const eligRes = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(eligRes.statusCode).toBe(HTTP_STATUS.OK);
    const eligBody = JSON.parse(eligRes.payload);
    expect(eligBody.data.resolvedSchemeIds).toContain("ab-pmjay");

    // Check NFC public resolution now reflects RESOLVED_ELIGIBLE
    const nfcRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcToken },
    });
    expect(nfcRes.statusCode).toBe(HTTP_STATUS.OK);
    const nfcBody = JSON.parse(nfcRes.payload);

    const nfcPmjay = nfcBody.data.schemes.find((s: any) => s.schemeId === "ab-pmjay");
    expect(nfcPmjay).toBeDefined();
    expect(nfcPmjay.eligibilityStatus).toBe("RESOLVED_ELIGIBLE");
  });

  it("4. ASHA reopening / unresolving scheme reverts eligibility and public NFC back to ACTION_REQUIRED", async () => {
    // Resolve first
    await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/resolve-scheme`,
      headers: { authorization: `Bearer ${ashaAssignedToken}` },
      payload: { schemeId: "ab-pmjay", resolved: true },
    });

    // Reopen scheme
    const reopenRes = await app.inject({
      method: "POST",
      url: `/api/v1/asha/cases/${caseId}/resolve-scheme`,
      headers: { authorization: `Bearer ${ashaAssignedToken}` },
      payload: { schemeId: "ab-pmjay", resolved: false, notes: "Correction requested by citizen." },
    });
    expect(reopenRes.statusCode).toBe(HTTP_STATUS.OK);
    const reopenBody = JSON.parse(reopenRes.payload);
    expect(reopenBody.data.case.resolvedSchemes).not.toContain("ab-pmjay");

    // Check citizen eligibility
    const eligRes = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility/me",
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    expect(eligRes.statusCode).toBe(HTTP_STATUS.OK);
    const eligBody = JSON.parse(eligRes.payload);
    expect(eligBody.data.resolvedSchemeIds).not.toContain("ab-pmjay");

    // Check NFC public resolution
    const nfcRes = await app.inject({
      method: "POST",
      url: "/api/v1/nfc/resolve",
      payload: { householdId, token: nfcToken },
    });
    expect(nfcRes.statusCode).toBe(HTTP_STATUS.OK);
    const nfcBody = JSON.parse(nfcRes.payload);
    const nfcPmjay = nfcBody.data.schemes.find((s: any) => s.schemeId === "ab-pmjay");
    expect(nfcPmjay.eligibilityStatus).toBe("ELIGIBLE");
  });
});
