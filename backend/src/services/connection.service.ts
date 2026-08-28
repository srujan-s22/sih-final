import { UserProfile } from "../../../shared/types/auth.js";
import {
  AshaConnectionRequest,
  AshaPublicDirectoryInfo,
  CitizenConnectionStatusResponse,
} from "../../../shared/types/connection.js";
import { AshaCase } from "../../../shared/types/case.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { HTTP_STATUS } from "../config/constants.js";

export class ConnectionServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "ConnectionServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ConnectionService {
  constructor(
    private connectionRepo: ConnectionRepository,
    private userRepo: UserRepository,
    private householdRepo: HouseholdRepository,
    private caseRepo: CaseRepository
  ) {}

  /**
   * Generates a collision-resistant, human-readable ASHA Service Code (e.g. ASHA-KA-7K42).
   */
  public generateServiceCode(stateCode: string = "IN"): string {
    const cleanState = stateCode.trim().toUpperCase().replace(/[^A-Z]/g, "").substring(0, 2) || "IN";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omit confusing characters (0, 1, I, O)
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ASHA-${cleanState}-${randomPart}`;
  }

  /**
   * Idempotently ensures an ASHA user has a valid, unique ASHA Service Code.
   */
  public async ensureAshaServiceCode(ashaProfile: UserProfile): Promise<UserProfile> {
    if (ashaProfile.role !== "ASHA") {
      return ashaProfile;
    }

    if (ashaProfile.ashaServiceCode && ashaProfile.ashaServiceCode.trim().length > 0) {
      return ashaProfile;
    }

    // Generate unique service code with collision retry
    let attempts = 0;
    let serviceCode = "";
    while (attempts < 10) {
      serviceCode = this.generateServiceCode("KA");
      const existing = await this.userRepo.getUserByServiceCode(serviceCode);
      if (!existing || existing.uid === ashaProfile.uid) {
        break;
      }
      attempts++;
    }

    const updated = await this.userRepo.updateUserProfile(ashaProfile.uid, {
      ashaServiceCode: serviceCode,
      serviceArea: ashaProfile.serviceArea || "Field Jurisdiction",
    });

    return updated || { ...ashaProfile, ashaServiceCode: serviceCode };
  }

  /**
   * Resolves safe public ASHA directory information from a Service Code.
   * STRICT SECURITY BOUNDARY: Never returns UID, email, phone number, or secrets.
   */
  public async resolveAshaServiceCode(
    serviceCode: string
  ): Promise<AshaPublicDirectoryInfo> {
    const formatted = serviceCode.trim().toUpperCase();
    const asha = await this.userRepo.getUserByServiceCode(formatted);

    if (!asha || asha.role !== "ASHA") {
      throw new ConnectionServiceError(
        "ASHA worker not found for the provided service code. Please verify the code.",
        HTTP_STATUS.NOT_FOUND,
        "ASHA_NOT_FOUND"
      );
    }

    return {
      serviceCode: asha.ashaServiceCode || formatted,
      displayName: asha.displayName || "ASHA Healthcare Worker",
      serviceArea: asha.serviceArea || "Assigned Primary Health Center",
    };
  }

  /**
   * Citizen requests connection with an ASHA worker using their Service Code.
   * STRICT AUTHORIZATION: Enforces household ownership (household.ownerUid === citizenProfile.uid).
   */
  public async requestConnection(
    citizenProfile: UserProfile,
    serviceCode: string,
    notes?: string
  ): Promise<AshaConnectionRequest> {
    if (citizenProfile.role !== "CITIZEN") {
      throw new ConnectionServiceError(
        "Only citizens can request an ASHA connection.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const household = await this.householdRepo.getHouseholdByOwnerUid(citizenProfile.uid);
    if (!household) {
      throw new ConnectionServiceError(
        "Please create your household profile before connecting with an ASHA worker.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    const formattedCode = serviceCode.trim().toUpperCase();
    const asha = await this.userRepo.getUserByServiceCode(formattedCode);
    if (!asha || asha.role !== "ASHA") {
      throw new ConnectionServiceError(
        "ASHA worker not found for the provided service code.",
        HTTP_STATUS.NOT_FOUND,
        "ASHA_NOT_FOUND"
      );
    }

    // Check if household already has an active connection with this ASHA
    const activeConn = await this.connectionRepo.getActiveRequestByHouseholdId(household.id);
    if (activeConn && activeConn.ashaUid === asha.uid) {
      throw new ConnectionServiceError(
        "Your household is already actively connected to this ASHA worker.",
        HTTP_STATUS.BAD_REQUEST,
        "ALREADY_CONNECTED"
      );
    }

    // Check if there is already a pending request for this household
    const pendingConn = await this.connectionRepo.getPendingRequestByHouseholdId(household.id);
    if (pendingConn) {
      if (pendingConn.ashaUid === asha.uid) {
        return pendingConn;
      }
      // If pending with a different ASHA, revoke old pending request
      await this.connectionRepo.updateRequest(pendingConn.id, {
        status: "REVOKED",
        responseNote: "Superceded by new connection request.",
      });
    }

    const members = await this.householdRepo.getMembers(household.id);
    const now = new Date().toISOString();
    const requestId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newRequest: AshaConnectionRequest = {
      id: requestId,
      householdId: household.id,
      citizenUid: citizenProfile.uid,
      headOfHouseholdName: household.headOfHouseholdName,
      district: household.district,
      state: household.state,
      incomeCategory: household.incomeCategory,
      memberCount: members.length || 1,
      ashaUid: asha.uid,
      ashaServiceCode: asha.ashaServiceCode || formattedCode,
      ashaName: asha.displayName || "ASHA Healthcare Worker",
      status: "PENDING",
      requestedAt: now,
      respondedAt: null,
      responseNote: notes || null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.connectionRepo.createRequest(newRequest);

    // If an AshaCase already exists, log immutable activity
    const existingCase = await this.caseRepo.getCaseByHouseholdId(household.id);
    if (existingCase) {
      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: citizenProfile.uid,
        actorRole: citizenProfile.role,
        actorName: citizenProfile.displayName || household.headOfHouseholdName,
        type: "CASE_ASSIGNED",
        description: `Citizen requested connection with ASHA ${asha.displayName || asha.ashaServiceCode}`,
        metadata: { requestId: saved.id, requestedAshaUid: asha.uid },
        timestamp: now,
      });
    }

    return saved;
  }

  /**
   * Retrieves current connection status for a Citizen's household
   */
  public async getCitizenConnectionStatus(
    citizenProfile: UserProfile
  ): Promise<CitizenConnectionStatusResponse> {
    if (citizenProfile.role !== "CITIZEN") {
      throw new ConnectionServiceError(
        "Only citizens can query household connection status.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const household = await this.householdRepo.getHouseholdByOwnerUid(citizenProfile.uid);
    if (!household) {
      return { status: "NONE" };
    }

    // 1. Check Active Connection
    const active = await this.connectionRepo.getActiveRequestByHouseholdId(household.id);
    if (active) {
      return {
        status: "ACTIVE",
        connection: active,
        asha: {
          serviceCode: active.ashaServiceCode,
          displayName: active.ashaName,
          state: active.state,
          district: active.district,
        },
      };
    }

    // 2. Check Pending Request
    const pending = await this.connectionRepo.getPendingRequestByHouseholdId(household.id);
    if (pending) {
      return {
        status: "PENDING",
        connection: pending,
        asha: {
          serviceCode: pending.ashaServiceCode,
          displayName: pending.ashaName,
          state: pending.state,
          district: pending.district,
        },
      };
    }

    // 3. Check Recent Requests
    const history = await this.connectionRepo.listRequestsByCitizenUid(citizenProfile.uid);
    if (history.length > 0 && history[0].status === "REJECTED") {
      return {
        status: "REJECTED",
        connection: history[0],
      };
    }

    return { status: "NONE" };
  }

  /**
   * Lists all pending connection requests addressed to the authenticated ASHA worker
   */
  public async listPendingRequestsForAsha(
    ashaProfile: UserProfile
  ): Promise<AshaConnectionRequest[]> {
    if (ashaProfile.role !== "ASHA") {
      throw new ConnectionServiceError(
        "Only ASHA workers can inspect connection request queues.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    return this.connectionRepo.listRequestsByAshaUid(ashaProfile.uid, "PENDING");
  }

  /**
   * ASHA accepts a connection request:
   * Sets request to ACTIVE and integrates with the authoritative Phase 9 AshaCase model.
   */
  public async acceptConnectionRequest(
    requestId: string,
    ashaProfile: UserProfile,
    note?: string
  ): Promise<AshaConnectionRequest> {
    if (ashaProfile.role !== "ASHA") {
      throw new ConnectionServiceError(
        "Only ASHA workers can accept connection requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const request = await this.connectionRepo.getRequestById(requestId);
    if (!request || request.ashaUid !== ashaProfile.uid) {
      throw new ConnectionServiceError(
        "Connection request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    if (request.status !== "PENDING") {
      throw new ConnectionServiceError(
        `Cannot accept connection request with status '${request.status}'.`,
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const now = new Date().toISOString();

    // 1. Revoke any prior active connection for this household
    const priorActive = await this.connectionRepo.getActiveRequestByHouseholdId(request.householdId);
    if (priorActive && priorActive.id !== request.id) {
      await this.connectionRepo.updateRequest(priorActive.id, {
        status: "REVOKED",
        responseNote: "Reassigned to new ASHA worker.",
      });
    }

    // 2. Mark this request as ACTIVE
    const updatedRequest = await this.connectionRepo.updateRequest(requestId, {
      status: "ACTIVE",
      respondedAt: now,
      responseNote: note || "Connection accepted by ASHA worker.",
    });

    // 3. Atomically sync with the authoritative Phase 9 AshaCase model
    const existingCase = await this.caseRepo.getCaseByHouseholdId(request.householdId);
    if (existingCase) {
      await this.caseRepo.updateCase(existingCase.id, {
        assignedAshaUid: ashaProfile.uid,
        status: existingCase.status === "CLOSED" || existingCase.status === "RESOLVED" ? "ACTIVE" : existingCase.status,
      });

      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: ashaProfile.uid,
        actorRole: ashaProfile.role,
        actorName: ashaProfile.displayName || "ASHA Worker",
        type: "CASE_ASSIGNED",
        description: `ASHA ${ashaProfile.displayName || ashaProfile.uid} accepted household connection request`,
        metadata: { requestId, status: "ACTIVE" },
        timestamp: now,
      });
    } else {
      // Create new assigned AshaCase
      const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newCase: AshaCase = {
        id: caseId,
        householdId: request.householdId,
        assignedAshaUid: ashaProfile.uid,
        headOfHouseholdName: request.headOfHouseholdName,
        district: request.district,
        state: request.state,
        incomeCategory: request.incomeCategory,
        memberCount: request.memberCount,
        status: "NEW",
        priority: "NORMAL",
        detectedGapsCount: 0,
        eligibleSchemesCount: 0,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await this.caseRepo.createCase(newCase);

      await this.caseRepo.createActivity(caseId, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId,
        actorUid: ashaProfile.uid,
        actorRole: ashaProfile.role,
        actorName: ashaProfile.displayName || "ASHA Worker",
        type: "CASE_CREATED",
        description: `Case created upon ASHA connection acceptance for ${request.headOfHouseholdName}`,
        metadata: { requestId },
        timestamp: now,
      });
    }

    return updatedRequest!;
  }

  /**
   * ASHA rejects a connection request
   */
  public async rejectConnectionRequest(
    requestId: string,
    ashaProfile: UserProfile,
    note?: string
  ): Promise<AshaConnectionRequest> {
    if (ashaProfile.role !== "ASHA") {
      throw new ConnectionServiceError(
        "Only ASHA workers can reject connection requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const request = await this.connectionRepo.getRequestById(requestId);
    if (!request || request.ashaUid !== ashaProfile.uid) {
      throw new ConnectionServiceError(
        "Connection request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    if (request.status !== "PENDING") {
      throw new ConnectionServiceError(
        `Cannot reject connection request with status '${request.status}'.`,
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const now = new Date().toISOString();
    const updatedRequest = await this.connectionRepo.updateRequest(requestId, {
      status: "REJECTED",
      respondedAt: now,
      responseNote: note || "Connection request declined by ASHA worker.",
    });

    const existingCase = await this.caseRepo.getCaseByHouseholdId(request.householdId);
    if (existingCase) {
      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: ashaProfile.uid,
        actorRole: ashaProfile.role,
        actorName: ashaProfile.displayName || "ASHA Worker",
        type: "CASE_ASSIGNED",
        description: `ASHA rejected connection request for ${request.headOfHouseholdName}`,
        metadata: { requestId, status: "REJECTED", note },
        timestamp: now,
      });
    }

    return updatedRequest!;
  }
}
