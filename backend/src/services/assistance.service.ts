import { UserProfile } from "../../../shared/types/auth.js";
import {
  AshaAssistanceRequest,
  CreateAssistanceRequestInput,
  UpdateAssistanceRequestInput,
  AssistanceStatus,
} from "../../../shared/types/assistance.js";
import { AssistanceRepository } from "../repositories/assistance.repository.js";
import { ConnectionRepository } from "../repositories/connection.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
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
    private caseRepo: CaseRepository
  ) {}

  /**
   * Citizen requests assistance from their connected ASHA worker.
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
      message: input.message.trim(),
      status: "PENDING",
      responseNote: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.assistanceRepo.createRequest(newRequest);

    // If an AshaCase exists for this household, log immutable audit activity
    const existingCase = await this.caseRepo.getCaseByHouseholdId(household.id);
    if (existingCase) {
      await this.caseRepo.createActivity(existingCase.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        caseId: existingCase.id,
        actorUid: citizenProfile.uid,
        actorRole: citizenProfile.role,
        actorName: citizenProfile.displayName || household.headOfHouseholdName,
        type: "CASE_ASSIGNED",
        description: `Citizen requested assistance: [${input.category}] ${input.schemeName ? `(${input.schemeName})` : ""}`,
        metadata: {
          assistanceRequestId: saved.id,
          category: input.category,
          schemeId: input.schemeId,
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
   * ASHA worker updates the status or response note of an assistance request.
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

    // IDOR protection: ASHA can only update requests assigned to their UID
    if (ashaProfile.role === "ASHA" && request.ashaUid !== ashaProfile.uid) {
      throw new AssistanceServiceError(
        "Assistance request not found or access denied.",
        HTTP_STATUS.NOT_FOUND,
        "REQUEST_NOT_FOUND"
      );
    }

    const now = new Date().toISOString();
    const isResolved = input.status === "RESOLVED" || input.status === "CLOSED";

    const updated = await this.assistanceRepo.updateRequest(requestId, {
      status: input.status,
      ...(input.responseNote !== undefined ? { responseNote: input.responseNote } : {}),
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
