import { describe, it, expect, beforeEach } from "vitest";
import { ConnectionRepository } from "../src/repositories/connection.repository.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { HouseholdRepository } from "../src/repositories/household.repository.js";
import { CaseRepository } from "../src/repositories/case.repository.js";
import { ConnectionService, ConnectionServiceError } from "../src/services/connection.service.js";
import { UserProfile } from "../../shared/types/auth.js";
import { Household } from "../../shared/types/household.js";

describe("Phase 9.1 — ConnectionService Unit Tests", () => {
  let connectionRepo: ConnectionRepository;
  let userRepo: UserRepository;
  let householdRepo: HouseholdRepository;
  let caseRepo: CaseRepository;
  let service: ConnectionService;

  const mockAshaProfile: UserProfile = {
    uid: "asha_priya_123",
    email: "priya.asha@karnataka.gov.in",
    displayName: "Priya Sharma",
    phoneNumber: "+919876543210",
    role: "ASHA",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-08-28T00:00:00Z",
    ashaServiceCode: "ASHA-KA-7K42",
    serviceArea: "Doddaballapura Primary Health Center",
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
  };

  const mockCitizenProfile: UserProfile = {
    uid: "citizen_ramesh_456",
    email: "ramesh@example.com",
    displayName: "Ramesh Kumar",
    phoneNumber: "+919123456780",
    role: "CITIZEN",
    consentStatus: "accepted",
    consentVersion: "1.0",
    consentedAt: "2026-08-28T00:00:00Z",
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
  };

  const mockHousehold: Household = {
    id: "hh_ramesh_001",
    ownerUid: "citizen_ramesh_456",
    headOfHouseholdName: "Ramesh Kumar",
    rationCardNumber: "RC-KA-992817",
    incomeCategory: "BPL",
    state: "Karnataka",
    district: "Bangalore Rural",
    village: "Doddaballapura",
    pincode: "561203",
    contactPhone: "+919123456780",
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
  };

  beforeEach(async () => {
    connectionRepo = new ConnectionRepository(null);
    userRepo = new UserRepository(null);
    householdRepo = new HouseholdRepository(null);
    caseRepo = new CaseRepository(null);

    connectionRepo.clearMemoryStore();
    userRepo.clearMemoryStore();
    householdRepo.clearMemoryStore();
    caseRepo.clearMemoryStore();

    await userRepo.createUserProfile(mockAshaProfile);
    await userRepo.createUserProfile(mockCitizenProfile);
    await householdRepo.createHousehold(mockHousehold);

    service = new ConnectionService(connectionRepo, userRepo, householdRepo, caseRepo);
  });

  describe("Service Code Generation & Auto-Assignment", () => {
    it("should generate a valid formatted service code", () => {
      const code = service.generateServiceCode("KA");
      expect(code).toMatch(/^ASHA-KA-[A-Z0-9]{4}$/);
    });

    it("should ensure ASHA profile has a service code if missing", async () => {
      const ashaWithoutCode: UserProfile = {
        ...mockAshaProfile,
        uid: "asha_sunita_999",
        ashaServiceCode: null,
      };
      await userRepo.createUserProfile(ashaWithoutCode);

      const result = await service.ensureAshaServiceCode(ashaWithoutCode);
      expect(result.ashaServiceCode).toMatch(/^ASHA-KA-[A-Z0-9]{4}$/);
    });
  });

  describe("Public ASHA Directory Resolution", () => {
    it("should resolve public directory info without leaking UID, email, or phone", async () => {
      const publicInfo = await service.resolveAshaServiceCode("ASHA-KA-7K42");
      expect(publicInfo.serviceCode).toBe("ASHA-KA-7K42");
      expect(publicInfo.displayName).toBe("Priya Sharma");
      expect(publicInfo.serviceArea).toBe("Doddaballapura Primary Health Center");

      // Verify no sensitive keys leaked
      expect((publicInfo as any).uid).toBeUndefined();
      expect((publicInfo as any).email).toBeUndefined();
      expect((publicInfo as any).phoneNumber).toBeUndefined();
    });

    it("should throw 404 for invalid service code", async () => {
      await expect(service.resolveAshaServiceCode("ASHA-KA-UNKNOWN")).rejects.toThrowError(
        ConnectionServiceError
      );
    });
  });

  describe("Citizen Connection Request Lifecycle", () => {
    it("should allow citizen to request connection with valid service code", async () => {
      const request = await service.requestConnection(
        mockCitizenProfile,
        "ASHA-KA-7K42",
        "Need help enrolling elderly parent in PM-JAY"
      );

      expect(request.status).toBe("PENDING");
      expect(request.householdId).toBe(mockHousehold.id);
      expect(request.citizenUid).toBe(mockCitizenProfile.uid);
      expect(request.ashaUid).toBe(mockAshaProfile.uid);
      expect(request.responseNote).toBe("Need help enrolling elderly parent in PM-JAY");
    });

    it("should reject connection request if user is not a citizen", async () => {
      await expect(
        service.requestConnection(mockAshaProfile, "ASHA-KA-7K42")
      ).rejects.toThrowError(ConnectionServiceError);
    });

    it("should reject connection request if citizen has no household profile", async () => {
      const citizenWithoutHousehold: UserProfile = {
        ...mockCitizenProfile,
        uid: "citizen_new_999",
      };
      await userRepo.createUserProfile(citizenWithoutHousehold);

      await expect(
        service.requestConnection(citizenWithoutHousehold, "ASHA-KA-7K42")
      ).rejects.toThrowError("Please create your household profile before connecting");
    });
  });

  describe("ASHA Queue & Decision Flow", () => {
    it("should list pending requests for authenticated ASHA worker only", async () => {
      await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");

      const pending = await service.listPendingRequestsForAsha(mockAshaProfile);
      expect(pending.length).toBe(1);
      expect(pending[0].headOfHouseholdName).toBe("Ramesh Kumar");

      // Another ASHA has 0 pending requests
      const otherAsha: UserProfile = {
        ...mockAshaProfile,
        uid: "asha_kavita_888",
        ashaServiceCode: "ASHA-KA-9999",
      };
      const otherPending = await service.listPendingRequestsForAsha(otherAsha);
      expect(otherPending.length).toBe(0);
    });

    it("should accept connection request and atomically create/assign AshaCase", async () => {
      const request = await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");

      const accepted = await service.acceptConnectionRequest(
        request.id,
        mockAshaProfile,
        "Welcome to the PHC caseload."
      );

      expect(accepted.status).toBe("ACTIVE");
      expect(accepted.responseNote).toBe("Welcome to the PHC caseload.");

      // Verify that authoritative AshaCase exists and is assigned
      const authoritativeCase = await caseRepo.getCaseByHouseholdId(mockHousehold.id);
      expect(authoritativeCase).toBeDefined();
      expect(authoritativeCase?.assignedAshaUid).toBe(mockAshaProfile.uid);
      expect(authoritativeCase?.headOfHouseholdName).toBe("Ramesh Kumar");

      // Verify activity logged
      const activities = await caseRepo.getActivities(authoritativeCase!.id);
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].actorUid).toBe(mockAshaProfile.uid);
    });

    it("should prevent cross-ASHA IDOR when accepting requests", async () => {
      const request = await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");

      const attackerAsha: UserProfile = {
        ...mockAshaProfile,
        uid: "asha_attacker_666",
        ashaServiceCode: "ASHA-KA-6666",
      };

      await expect(
        service.acceptConnectionRequest(request.id, attackerAsha)
      ).rejects.toThrowError("Connection request not found or access denied.");
    });

    it("should reject connection request with note", async () => {
      const request = await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");

      const rejected = await service.rejectConnectionRequest(
        request.id,
        mockAshaProfile,
        "Household belongs to adjacent sub-center ward."
      );

      expect(rejected.status).toBe("REJECTED");
      expect(rejected.responseNote).toBe("Household belongs to adjacent sub-center ward.");
    });
  });

  describe("Citizen Status Queries", () => {
    it("should return NONE when no connection requested", async () => {
      const status = await service.getCitizenConnectionStatus(mockCitizenProfile);
      expect(status.status).toBe("NONE");
    });

    it("should return PENDING after request is submitted", async () => {
      await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");
      const status = await service.getCitizenConnectionStatus(mockCitizenProfile);
      expect(status.status).toBe("PENDING");
      expect(status.asha?.displayName).toBe("Priya Sharma");
    });

    it("should return ACTIVE after ASHA accepts request", async () => {
      const request = await service.requestConnection(mockCitizenProfile, "ASHA-KA-7K42");
      await service.acceptConnectionRequest(request.id, mockAshaProfile);

      const status = await service.getCitizenConnectionStatus(mockCitizenProfile);
      expect(status.status).toBe("ACTIVE");
      expect(status.asha?.displayName).toBe("Priya Sharma");
      expect(status.asha?.serviceCode).toBe("ASHA-KA-7K42");
    });
  });
});
