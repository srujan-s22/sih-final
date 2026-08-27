import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { HTTP_STATUS } from "../src/config/constants.js";
import { FastifyInstance } from "fastify";

describe("Household & Member Domain API (/api/v1/households)", () => {
  let app: FastifyInstance;

  const citizen1Token = "test_token_citizen101_citizen";
  const citizen2Token = "test_token_citizen102_citizen";

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure memory stores are clean for isolated unit testing
    app.userRepository.clearMemoryStore();
    app.householdRepository.clearMemoryStore();
  });

  // Helper to establish accepted consent for a test user
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

  describe("Authentication & Consent Boundaries", () => {
    it("rejects unauthenticated requests with 401 AUTH_TOKEN_MISSING", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
      });

      expect(response.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("AUTH_TOKEN_MISSING");
    });

    it("blocks unconsented users from household access with 403 CONSENT_REQUIRED", async () => {
      // First sign in without submitting consent (consent status is pending)
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      expect(response.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe("CONSENT_REQUIRED");
    });
  });

  describe("Household Lifecycle & Persistence", () => {
    it("returns null data for authenticated citizen without a household (empty state)", async () => {
      await establishConsent(citizen1Token);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it("creates a household and validates identical persistence on retrieval", async () => {
      await establishConsent(citizen1Token);

      const payload = {
        headOfHouseholdName: "Sunita Devi",
        rationCardNumber: "RC-BR-2026-9901",
        incomeCategory: "BPL",
        state: "Bihar",
        district: "Patna",
        village: "Bakhtiyarpur",
        pincode: "803212",
        contactPhone: "9876543210",
      };

      // 1. Create Household
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload,
      });

      expect(createRes.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createRes.body);
      expect(createBody.success).toBe(true);
      expect(createBody.data.isNew).toBe(true);
      expect(createBody.data.household.ownerUid).toBe("citizen101");
      expect(createBody.data.household.headOfHouseholdName).toBe("Sunita Devi");

      // 2. Retrieve Household and verify persistence match
      const getRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      expect(getRes.statusCode).toBe(HTTP_STATUS.OK);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.success).toBe(true);
      expect(getBody.data.household.id).toBe(createBody.data.household.id);
      expect(getBody.data.household.ownerUid).toBe("citizen101");
      expect(getBody.data.household.headOfHouseholdName).toBe("Sunita Devi");
      expect(getBody.data.household.rationCardNumber).toBe("RC-BR-2026-9901");
      expect(getBody.data.household.incomeCategory).toBe("BPL");
      expect(getBody.data.household.pincode).toBe("803212");
      expect(getBody.data.members).toEqual([]);
    });

    it("updates household details and maintains persistence", async () => {
      await establishConsent(citizen1Token);

      await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-BR-2026-9901",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });

      const updateRes = await app.inject({
        method: "PATCH",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          incomeCategory: "AAY",
          contactPhone: "9123456789",
        },
      });

      expect(updateRes.statusCode).toBe(HTTP_STATUS.OK);
      const updateBody = JSON.parse(updateRes.body);
      expect(updateBody.data.household.incomeCategory).toBe("AAY");
      expect(updateBody.data.household.contactPhone).toBe("9123456789");

      // Verify persistence via GET
      const getRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });
      const getBody = JSON.parse(getRes.body);
      expect(getBody.data.household.incomeCategory).toBe("AAY");
      expect(getBody.data.household.contactPhone).toBe("9123456789");
    });
  });

  describe("Household Members Lifecycle & Persistence", () => {
    beforeEach(async () => {
      await establishConsent(citizen1Token);
      await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-BR-2026-9901",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });
    });

    it("adds a member and verifies identical persistence", async () => {
      const memberPayload = {
        fullName: "Rahul Kumar",
        age: 14,
        gender: "male",
        relationship: "Son",
        disabilityStatus: false,
        chronicConditions: ["Asthma"],
      };

      // 1. Add Member
      const addRes = await app.inject({
        method: "POST",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: memberPayload,
      });

      expect(addRes.statusCode).toBe(HTTP_STATUS.CREATED);
      const addBody = JSON.parse(addRes.body);
      expect(addBody.success).toBe(true);
      expect(addBody.data.member.fullName).toBe("Rahul Kumar");
      expect(addBody.data.member.age).toBe(14);
      expect(addBody.data.member.gender).toBe("male");
      expect(addBody.data.member.relationship).toBe("Son");
      expect(addBody.data.member.chronicConditions).toEqual(["Asthma"]);

      const memberId = addBody.data.member.id;

      // 2. Retrieve Members list and verify exact match
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      expect(listRes.statusCode).toBe(HTTP_STATUS.OK);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data.members.length).toBe(1);
      expect(listBody.data.members[0].id).toBe(memberId);
      expect(listBody.data.members[0].fullName).toBe("Rahul Kumar");
    });

    it("updates a member and removes a member with full confirmation", async () => {
      // Add member
      const addRes = await app.inject({
        method: "POST",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          fullName: "Pooja Kumari",
          age: 18,
          gender: "female",
          relationship: "Daughter",
          disabilityStatus: false,
          chronicConditions: [],
        },
      });
      const memberId = JSON.parse(addRes.body).data.member.id;

      // Update member
      const updateRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/households/me/members/${memberId}`,
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          age: 19,
        },
      });

      expect(updateRes.statusCode).toBe(HTTP_STATUS.OK);
      const updateBody = JSON.parse(updateRes.body);
      expect(updateBody.data.member.age).toBe(19);

      // Delete member
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/households/me/members/${memberId}`,
        headers: { authorization: `Bearer ${citizen1Token}` },
      });

      expect(deleteRes.statusCode).toBe(HTTP_STATUS.OK);

      // Verify member is gone
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
      });
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data.members.length).toBe(0);
    });
  });

  describe("Security & IDOR Boundary Enforcement", () => {
    it("strictly ignores client-provided ownerUid in creation and update payloads", async () => {
      await establishConsent(citizen1Token);

      // Attempt to spoof ownerUid during creation
      const spoofCreateRes = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          ownerUid: "hacker_spoofed_uid",
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-BR-2026-9901",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });

      expect(spoofCreateRes.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(spoofCreateRes.body);
      // Must be set to authentic token UID (citizen101), NEVER the spoofed UID
      expect(createBody.data.household.ownerUid).toBe("citizen101");

      // Attempt to overwrite ownerUid during update
      const spoofUpdateRes = await app.inject({
        method: "PATCH",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          ownerUid: "hacker_spoofed_uid_2",
          incomeCategory: "AAY",
        },
      });

      expect(spoofUpdateRes.statusCode).toBe(HTTP_STATUS.OK);
      const updateBody = JSON.parse(spoofUpdateRes.body);
      expect(updateBody.data.household.ownerUid).toBe("citizen101");
    });

    it("prevents Citizen B from accessing or mutating Citizen A's household data (IDOR isolation)", async () => {
      // Citizen A sets up household and member
      await establishConsent(citizen1Token);
      const aHhRes = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Citizen A Head",
          rationCardNumber: "RC-A-1234",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });
      const aMemberRes = await app.inject({
        method: "POST",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          fullName: "Citizen A Member",
          age: 25,
          gender: "male",
          relationship: "Son",
        },
      });
      const aMemberId = JSON.parse(aMemberRes.body).data.member.id;

      // Citizen B signs in with their own token
      await establishConsent(citizen2Token);

      // 1. Citizen B GET /households/me returns null (not Citizen A's household)
      const bGetHhRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me",
        headers: { authorization: `Bearer ${citizen2Token}` },
      });
      expect(JSON.parse(bGetHhRes.body).data).toBeNull();

      // 2. Citizen B GET /households/me/members returns 404 (Citizen B has no household)
      const bGetMembersRes = await app.inject({
        method: "GET",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen2Token}` },
      });
      expect(bGetMembersRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

      // 3. Citizen B cannot update or delete Citizen A's member
      const bUpdateMemberRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/households/me/members/${aMemberId}`,
        headers: { authorization: `Bearer ${citizen2Token}` },
        payload: { fullName: "Hacked Member Name" },
      });
      expect(bUpdateMemberRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

      const bDeleteMemberRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/households/me/members/${aMemberId}`,
        headers: { authorization: `Bearer ${citizen2Token}` },
      });
      expect(bDeleteMemberRes.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe("Input Validation Boundaries", () => {
    it("rejects invalid pincode, missing required fields, and invalid income category", async () => {
      await establishConsent(citizen1Token);

      // Missing required fields
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
        },
      });
      expect(res1.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      // Invalid pincode
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-12345",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "123", // invalid
        },
      });
      expect(res2.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      // Invalid income category
      const res3 = await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-12345",
          incomeCategory: "SUPER_RICH", // invalid enum
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });
      expect(res3.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    });

    it("rejects invalid member age", async () => {
      await establishConsent(citizen1Token);
      await app.inject({
        method: "POST",
        url: "/api/v1/households",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          headOfHouseholdName: "Sunita Devi",
          rationCardNumber: "RC-12345",
          incomeCategory: "BPL",
          state: "Bihar",
          district: "Patna",
          village: "Bakhtiyarpur",
          pincode: "803212",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/households/me/members",
        headers: { authorization: `Bearer ${citizen1Token}` },
        payload: {
          fullName: "Rahul Kumar",
          age: -5, // invalid age
          gender: "male",
          relationship: "Son",
        },
      });
      expect(res.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    });
  });
});
