import { describe, it, expect } from "vitest";
import { AIContextBuilder } from "../src/services/ai/ai-context-builder.js";
import { Household, Member } from "../../shared/types/household.js";
import { EligibilityResult } from "../../shared/types/eligibility.js";
import { EvidenceRecord } from "../../shared/types/evidence.js";

describe("AIContextBuilder Unit Tests (Phase 7 PII Minimization & Pseudonymization)", () => {
  const secret = "test-secret-key-12345";
  const builder = new AIContextBuilder(secret);

  it("1. derives stable HMAC-SHA256 anonymous user IDs for the same UID + purpose", () => {
    const uidA = "firebase_uid_citizen_101";
    const purpose1 = "EXPLAIN_ELIGIBILITY";

    const id1 = builder.deriveAnonymousUserId(uidA, purpose1);
    const id2 = builder.deriveAnonymousUserId(uidA, purpose1);

    expect(id1).toBe(id2);
    expect(id1.length).toBe(64); // SHA-256 hex string
    expect(id1).not.toContain(uidA);
    expect(id1).not.toContain(secret);
  });

  it("2. derives distinct anonymous user IDs for different UIDs with the same purpose", () => {
    const uidA = "firebase_uid_citizen_101";
    const uidB = "firebase_uid_citizen_102";
    const purpose = "EXPLAIN_ELIGIBILITY";

    const idA = builder.deriveAnonymousUserId(uidA, purpose);
    const idB = builder.deriveAnonymousUserId(uidB, purpose);

    expect(idA).not.toBe(idB);
  });

  it("3. derives distinct anonymous user IDs for the same UID with different purposes", () => {
    const uidA = "firebase_uid_citizen_101";
    const purpose1 = "EXPLAIN_ELIGIBILITY";
    const purpose2 = "GENERATE_ACTION_PLAN";

    const id1 = builder.deriveAnonymousUserId(uidA, purpose1);
    const id2 = builder.deriveAnonymousUserId(uidA, purpose2);

    expect(id1).not.toBe(id2);
  });

  it("4. strictly excludes citizen PII (full name, phone, email, ration card, address, UID) from AIContext", () => {
    const household: Household = {
      id: "hh_real_123",
      ownerUid: "firebase_owner_uid_999",
      headOfHouseholdName: "Sita Devi Secret",
      rationCardNumber: "RC-BR-9988776655",
      incomeCategory: "BPL",
      state: "Bihar",
      district: "Patna",
      village: "Secret Village 42",
      pincode: "803212",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const member: Member = {
      id: "mem_real_456",
      householdId: "hh_real_123",
      fullName: "Secret Grandfather",
      age: 72,
      gender: "male",
      relationship: "Grandfather",
      disabilityStatus: false,
      chronicConditions: ["Hypertension"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const context = builder.buildContext({
      purpose: "EXPLAIN_ELIGIBILITY",
      household,
      members: [member],
    });

    const serialized = JSON.stringify(context);

    // Assert PII is NOT present
    expect(serialized).not.toContain("Sita Devi Secret");
    expect(serialized).not.toContain("Secret Grandfather");
    expect(serialized).not.toContain("RC-BR-9988776655");
    expect(serialized).not.toContain("Secret Village 42");
    expect(serialized).not.toContain("firebase_owner_uid_999");
    expect(serialized).not.toContain("hh_real_123");
    expect(serialized).not.toContain("mem_real_456");

    // Assert safe fields ARE present
    expect(context.householdSummary.state).toBe("Bihar");
    expect(context.householdSummary.district).toBe("Patna");
    expect(context.householdSummary.incomeCategory).toBe("BPL");
    expect(context.memberSummaries[0].age).toBe(72);
    expect(context.memberSummaries[0].gender).toBe("male");
  });

  it("5. strictly includes only VERIFIED evidence records, excluding PENDING_REVIEW, DISCOVERED, and REJECTED", () => {
    const evidenceList: EvidenceRecord[] = [
      {
        id: "ev_verified_1",
        schemeId: "ab-pmjay",
        claim: "70+ cover",
        query: "pmjay query",
        queryHash: "hash1",
        sourceUrl: "https://pmjay.gov.in/guidelines",
        sourceDomain: "pmjay.gov.in",
        sourceOrganization: "NHA",
        officialTitle: "NHA Official Notice",
        sourceType: "OFFICIAL_GOVERNMENT",
        documentType: "GUIDELINE",
        relevantExcerpt: "Universal 70+ cover.",
        retrievedAt: new Date().toISOString(),
        verificationStatus: "VERIFIED",
        contentHash: "hash_c1",
        discoveredBy: "SEED",
        authorityScore: 95,
        relevanceScore: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ev_pending_2",
        schemeId: "ab-pmjay",
        claim: "Draft claim",
        query: "query2",
        queryHash: "hash2",
        sourceUrl: "https://mohfw.gov.in/draft",
        sourceDomain: "mohfw.gov.in",
        sourceOrganization: "MoHFW",
        officialTitle: "Draft Note",
        sourceType: "OFFICIAL_GOVERNMENT",
        documentType: "UNKNOWN",
        relevantExcerpt: "Draft text.",
        retrievedAt: new Date().toISOString(),
        verificationStatus: "PENDING_REVIEW",
        contentHash: "hash_c2",
        discoveredBy: "SEARCH",
        authorityScore: 85,
        relevanceScore: 70,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "ev_rejected_3",
        schemeId: "ab-pmjay",
        claim: "Commercial blog",
        query: "query3",
        queryHash: "hash3",
        sourceUrl: "https://policybazaar.com/claim",
        sourceDomain: "policybazaar.com",
        sourceOrganization: "Commercial Blog",
        officialTitle: "Blog Post",
        sourceType: "REJECTED",
        documentType: "UNKNOWN",
        relevantExcerpt: "Blog content.",
        retrievedAt: new Date().toISOString(),
        verificationStatus: "REJECTED",
        contentHash: "hash_c3",
        discoveredBy: "SEARCH",
        authorityScore: 0,
        relevanceScore: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const context = builder.buildContext({
      purpose: "EXPLAIN_ELIGIBILITY",
      evidence: evidenceList,
    });

    expect(context.verifiedEvidence.length).toBe(1);
    expect(context.verifiedEvidence[0].id).toBe("ev_verified_1");
    expect(context.verifiedEvidence[0].officialTitle).toBe("NHA Official Notice");
  });

  it("6. computes deterministic context hashes for identical contexts", () => {
    const context1 = builder.buildContext({
      purpose: "EXPLAIN_ELIGIBILITY",
      language: "en",
    });

    const context2 = builder.buildContext({
      purpose: "EXPLAIN_ELIGIBILITY",
      language: "en",
    });

    const hash1 = builder.computeContextHash(context1);
    const hash2 = builder.computeContextHash(context2);

    expect(hash1).toBe(hash2);
  });
});
