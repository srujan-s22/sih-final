import { UserProfile } from "../../../shared/types/auth.js";
import {
  AshaAssistanceRequest,
  CreateAssistanceRequestInput,
  UpdateAssistanceRequestInput,
  AssistanceStatus,
} from "../../../shared/types/assistance.js";
import { Member, Household } from "../../../shared/types/household.js";
import { AssistanceRepository } from "../repositories/assistance.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { CaseService } from "./case.service.js";
import { HTTP_STATUS } from "../config/constants.js";

export class AssistanceServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AssistanceServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AssistanceService {
  constructor(
    private assistanceRepo: AssistanceRepository,
    private connectionRepo: ConnectionRepository,
    private householdRepo: HouseholdRepository,
    private caseRepo: CaseRepository,
    private caseService?: CaseService
  ) {}

  /**
   * Citizen requests assistance from their connected ASHA worker with beneficiary validation
   * and duplicate request prevention.
   */
  public async createAssistanceRequest(
    citizenProfile: UserProfile,
    input: CreateAssistanceRequestInput
  ): Promise<AshaAssistanceRequest> {
    if (citizenProfile.role !== "CITIZEN") {
      throw new AssistanceServiceError(
        "Only citizens can submit assistance requests to ASHA workers.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const household = await this.householdRepo.getHouseholdByOwnerUid(citizenProfile.uid);
    if (!household) {
      throw new AssistanceServiceError(
        "Please create your household profile before requesting ASHA assistance.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    // Verify active ASHA connection exists
    const activeConnection = await this.connectionRepo.getActiveRequestByHouseholdId(household.id);
    if (!activeConnection) {
      throw new AssistanceServiceError(
        "Your household must be connected to an active ASHA worker to request assistance.",
        HTTP_STATUS.BAD_REQUEST,
        "NO_ACTIVE_ASHA_CONNECTION"
      );
    }

    // Validate beneficiary member if provided
    let beneficiaryMember: Member | null = null;
    if (input.beneficiaryMemberId) {
      const members = await this.householdRepo.getMembers(household.id);
      beneficiaryMember = members.find((m) => m.id === input.beneficiaryMemberId) || null;
      if (!beneficiaryMember) {
        throw new AssistanceServiceError(
          "Selected beneficiary member was not found in your household.",
          HTTP_STATUS.BAD_REQUEST,
          "BENEFICIARY_NOT_FOUND"
        );
      }
    }

    // Prevent duplicate active assistance requests for same scheme & beneficiary
    if (input.schemeId) {
      const existingRequests = await this.assistanceRepo.listRequestsByCitizenUid(citizenProfile.uid);
      const duplicate = existingRequests.find(
        (r) =>
          r.schemeId === input.schemeId &&
          (input.beneficiaryMemberId ? r.beneficiaryMemberId === input.beneficiaryMemberId : true) &&
          !["RESOLVED", "DECLINED", "CLOSED"].includes(r.status)
      );

      if (duplicate) {
        throw new AssistanceServiceError(
          "An active assistance request already exists for this scheme and beneficiary.",
          HTTP_STATUS.CONFLICT,
          "DUPLICATE_ACTIVE_REQUEST"
        );
      }
    }

    const now = new Date().toISOString();
    const requestId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newRequest: AshaAssistanceRequest = {
      id: requestId,
      householdId: household.id,
      citizenUid: citizenProfile.uid,
      headOfHouseholdName: household.headOfHouseholdName,
      district: household.district,
      state: household.state,
      ashaUid: activeConnection.ashaUid,
      ashaServiceCode: activeConnection.ashaServiceCode,
      ashaName: activeConnection.ashaName,
      category: input.category,
      schemeId: input.schemeId || null,
      schemeName: input.schemeName || null,
      beneficiaryMemberId: beneficiaryMember ? beneficiaryMember.id : null,
      beneficiaryName: beneficiaryMember ? beneficiaryMember.fullName : null,
      beneficiaryAge: beneficiaryMember ? beneficiaryMember.age : null,
      beneficiaryRelationship: beneficiaryMember ? beneficiaryMember.relationship : null,
      message: input.message.trim(),
      priority: input.priority || "NORMAL",
      status: "PENDING",
      responseNote: null,
      declineReason: null,
      caseId: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.assistanceRepo.createRequest(newRequest);

    // If an AshaCase exists for this household, log immutable audit activity and link
    const existingCase = await this.caseRepo.getCaseByHouseholdId(household.id);
    if (existingCase) {
      await this.caseRepo.updateCase(existingCase.id, {
        status: "REQUESTED",
        priority: input.priority || existingCase.priority,
        schemeId: input.schemeId || existingCase.schemeId,
        schemeName: input.schemeName || existingCase.schemeName,
        beneficiaryMemberId: beneficiaryMember ? beneficiaryMember.id : existingCase.beneficiaryMemberId,
        beneficiaryName: beneficiaryMember ? beneficiaryMember.fullName : existingCase.beneficiaryName,
        assistanceRequestId: saved.id,
      });

      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: citizenProfile.uid,
        actorRole: citizenProfile.role,
        actorName: citizenProfile.displayName || household.headOfHouseholdName,
        type: "ASSISTANCE_REQUESTED",
        description: `Citizen requested assistance for [${input.category}] ${input.schemeName ? `(${input.schemeName})` : ""} - Beneficiary: ${beneficiaryMember?.fullName || "Household"}`,
        metadata: {
          assistanceRequestId: saved.id,
          category: input.category,
          schemeId: input.schemeId,
          beneficiaryMemberId: beneficiaryMember?.id,
        },
        timestamp: now,
      });
    }

    return saved;
  }

  /**
   * Retrieves assistance requests for the authenticated Citizen.
   */
  public async listCitizenAssistanceRequests(
    citizenProfile: UserProfile
  ): Promise<AshaAssistanceRequest[]> {
    if (citizenProfile.role !== "CITIZEN") {
      throw new AssistanceServiceError(
        "Only citizens can query citizen assistance requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    return this.assistanceRepo.listRequestsByCitizenUid(citizenProfile.uid);
  }

  /**
   * Retrieves assistance requests assigned to the authenticated ASHA worker.
   */
  public async listAshaAssistanceRequests(
    ashaProfile: UserProfile,
    status?: AssistanceStatus
  ): Promise<AshaAssistanceRequest[]> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new AssistanceServiceError(
        "Only ASHA workers and Administrators can inspect incoming assistance requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    if (ashaProfile.role === "ADMIN") {
      return this.assistanceRepo.listAllRequests(status);
    }

    return this.assistanceRepo.listRequestsByAshaUid(ashaProfile.uid, status);
  }

  /**
   * ASHA worker accepts an assistance request:
   * 1. Transitions request to ACCEPTED
   * 2. Finds or creates the AshaCase for this household
   * 3. Initializes scheme journey & field tasks
   * 4. Links caseId to request
   * 5. Logs audit activity
   */
  public async acceptAssistanceRequest(
    requestId: string,
    ashaProfile: UserProfile,
    responseNote?: string | null
  ): Promise<{ request: AshaAssistanceRequest; caseId: string }> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new AssistanceServiceError(
        "Only ASHA workers and Administrators can accept assistance requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const request = await this.assistanceRepo.getRequestById(requestId);
    if (!request) {
      throw new AssistanceServiceError(
        "Assistance request not found.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    // IDOR protection
    if (ashaProfile.role === "ASHA" && request.ashaUid !== ashaProfile.uid) {
      throw new AssistanceServiceError(
        "Assistance request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    const now = new Date().toISOString();
    let existingCase = await this.caseRepo.getCaseByHouseholdId(request.householdId);

    // If case doesn't exist, create it
    if (!existingCase) {
      const household = await this.householdRepo.getHouseholdById(request.householdId);
      const members = await this.householdRepo.getMembers(request.householdId);
      const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      existingCase = await this.caseRepo.createCase({
        id: caseId,
        householdId: request.householdId,
        assignedAshaUid: request.ashaUid,
        headOfHouseholdName: request.headOfHouseholdName,
        district: request.district,
        state: request.state,
        incomeCategory: household?.incomeCategory || "BPL",
        memberCount: members.length || 1,
        status: "ACCEPTED",
        priority: request.priority || "NORMAL",
        schemeId: request.schemeId || null,
        schemeName: request.schemeName || null,
        beneficiaryMemberId: request.beneficiaryMemberId || null,
        beneficiaryName: request.beneficiaryName || null,
        assistanceRequestId: requestId,
        detectedGapsCount: 0,
        eligibleSchemesCount: 0,
        lastContactAt: now,
        nextFollowUpAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // If request is associated with a scheme, initialize scheme journey & tasks
    let beneficiaryMember: Member | null = null;
    if (request.beneficiaryMemberId) {
      const members = await this.householdRepo.getMembers(request.householdId);
      beneficiaryMember = members.find((m) => m.id === request.beneficiaryMemberId) || null;
    }

    if (this.caseService && request.schemeId) {
      await this.caseService.initializeSchemeJourney(
        existingCase.id,
        request.schemeId,
        beneficiaryMember,
        ashaProfile
      );
    } else {
      await this.caseRepo.updateCase(existingCase.id, {
        status: "IN_PROGRESS",
        schemeId: request.schemeId || existingCase.schemeId,
        schemeName: request.schemeName || existingCase.schemeName,
        beneficiaryMemberId: request.beneficiaryMemberId || existingCase.beneficiaryMemberId,
        beneficiaryName: request.beneficiaryName || existingCase.beneficiaryName,
        assistanceRequestId: requestId,
      });
    }

    // Update request to ACCEPTED & link caseId
    const updatedRequest = await this.assistanceRepo.updateRequest(requestId, {
      status: "ACCEPTED",
      caseId: existingCase.id,
      responseNote: responseNote !== undefined ? responseNote : undefined,
    });

    // Record audit activity
    await this.caseRepo.createActivity(existingCase.id, {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      caseId: existingCase.id,
      actorUid: ashaProfile.uid,
      actorRole: ashaProfile.role,
      actorName: ashaProfile.displayName || "ASHA Worker",
      type: "REQUEST_ACCEPTED",
      description: `ASHA accepted assistance request for ${request.schemeName || request.category}`,
      metadata: { assistanceRequestId: requestId, schemeId: request.schemeId },
      timestamp: now,
    });

    return { request: updatedRequest || request, caseId: existingCase.id };
  }

  /**
   * ASHA worker declines an assistance request with a reason
   */
  public async declineAssistanceRequest(
    requestId: string,
    ashaProfile: UserProfile,
    reason: string
  ): Promise<AshaAssistanceRequest> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new AssistanceServiceError(
        "Only ASHA workers and Administrators can decline assistance requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const request = await this.assistanceRepo.getRequestById(requestId);
    if (!request) {
      throw new AssistanceServiceError(
        "Assistance request not found.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    // IDOR protection
    if (ashaProfile.role === "ASHA" && request.ashaUid !== ashaProfile.uid) {
      throw new AssistanceServiceError(
        "Assistance request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    const now = new Date().toISOString();
    const updated = await this.assistanceRepo.updateRequest(requestId, {
      status: "DECLINED",
      declineReason: reason.trim(),
      responseNote: reason.trim(),
      resolvedAt: now,
    });

    if (!updated) {
      throw new AssistanceServiceError(
        "Failed to decline assistance request.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "UPDATE_FAILED"
      );
    }

    // If an AshaCase exists, record audit activity
    const existingCase = await this.caseRepo.getCaseByHouseholdId(request.householdId);
    if (existingCase) {
      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: ashaProfile.uid,
        actorRole: ashaProfile.role,
        actorName: ashaProfile.displayName || "ASHA Worker",
        type: "REQUEST_DECLINED",
        description: `ASHA declined assistance request: ${reason.trim()}`,
        metadata: { assistanceRequestId: requestId, reason: reason.trim() },
        timestamp: now,
      });
    }

    return updated;
  }

  /**
   * ASHA worker updates status or adds response note to an assistance request
   */
  public async updateAssistanceRequest(
    requestId: string,
    ashaProfile: UserProfile,
    input: UpdateAssistanceRequestInput
  ): Promise<AshaAssistanceRequest> {
    if (ashaProfile.role !== "ASHA" && ashaProfile.role !== "ADMIN") {
      throw new AssistanceServiceError(
        "Only ASHA workers and Administrators can update assistance requests.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    const request = await this.assistanceRepo.getRequestById(requestId);
    if (!request) {
      throw new AssistanceServiceError(
        "Assistance request not found.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    // IDOR protection
    if (ashaProfile.role === "ASHA" && request.ashaUid !== ashaProfile.uid) {
      throw new AssistanceServiceError(
        "Assistance request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    const now = new Date().toISOString();
    const isResolved = input.status === "RESOLVED" || input.status === "CLOSED" || input.status === "DECLINED";

    const updated = await this.assistanceRepo.updateRequest(requestId, {
      status: input.status,
      ...(input.responseNote !== undefined ? { responseNote: input.responseNote } : {}),
      ...(input.declineReason !== undefined ? { declineReason: input.declineReason } : {}),
      ...(isResolved ? { resolvedAt: now } : {}),
    });

    if (!updated) {
      throw new AssistanceServiceError(
        "Failed to update assistance request.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "UPDATE_FAILED"
      );
    }

    // If an AshaCase exists for this household, log immutable audit activity
    const existingCase = await this.caseRepo.getCaseByHouseholdId(request.householdId);
    if (existingCase) {
      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: ashaProfile.uid,
        actorRole: ashaProfile.role,
        actorName: ashaProfile.displayName || "ASHA Worker",
        type: isResolved ? "STATUS_CHANGED" : "CASE_ASSIGNED",
        description: `ASHA updated assistance request to '${input.status}': ${input.responseNote || ""}`,
        metadata: {
          assistanceRequestId: requestId,
          newStatus: input.status,
          responseNote: input.responseNote,
        },
        timestamp: now,
      });
    }

    return updated;
  }
}

