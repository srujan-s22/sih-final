import * as crypto from "crypto";
import { UserProfile } from "../../../shared/types/auth.js";
import {
  HouseholdNfcRecord,
  NfcProvisionResponse,
  NfcRevokeResponse,
  NfcConfirmRotationResponse,
  NfcCancelRotationResponse,
  NfcResolveResponse,
  HouseholdNfcStatusResponse,
  NfcPublicSchemeSummary,
  NfcPublicAshaInfo,
} from "../../../shared/types/nfc.js";
import { NfcRepository } from "../repositories/nfc.repository.js";
import { HouseholdRepository } from "../repositories/household.repository.js";
import { CaseRepository } from "../repositories/case.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { EligibilityService } from "./eligibility/eligibility.service.js";
import { hashSecret, verifySecretHash } from "../utils/secret-hash.js";
import { HTTP_STATUS } from "../config/constants.js";

export class NfcServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "NfcServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface FailedAttemptTracker {
  count: number;
  resetAt: number;
}

export class NfcService {
  // In-memory rate-limiter tracker for brute-force mitigation on public endpoint
  private failedAttempts = new Map<string, FailedAttemptTracker>();
  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private nfcRepo: NfcRepository,
    private householdRepo: HouseholdRepository,
    private caseRepo: CaseRepository,
    private userRepo: UserRepository,
    private eligibilityService: EligibilityService
  ) {}

  /**
   * Generates a cryptographically random, high-entropy, URL-safe bearer token.
   * 32 random bytes encoded as base64url (~43 characters, 256 bits of entropy).
   */
  public generateSecureToken(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Helper to verify ASHA/Admin authorization for a specific household.
   */
  private async verifyHouseholdAuthorization(
    householdId: string,
    actorProfile: UserProfile
  ): Promise<void> {
    if (actorProfile.role === "ADMIN") {
      return; // Administrators have platform-wide case and household authority
    }

    if (actorProfile.role !== "ASHA") {
      throw new NfcServiceError(
        "Only ASHA healthcare workers and Administrators can manage household NFC credentials.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_ROLE"
      );
    }

    // ASHA workers may ONLY provision/manage NFC for households assigned to their caseload
    const householdCase = await this.caseRepo.getCaseByHouseholdId(householdId);
    if (!householdCase) {
      throw new NfcServiceError(
        "No healthcare case found for this household. Please ensure the case is assigned to you.",
        HTTP_STATUS.FORBIDDEN,
        "UNASSIGNED_HOUSEHOLD"
      );
    }

    const isDirectlyAssigned = householdCase.assignedAshaUid === actorProfile.uid;
    const isTemporarilyAssigned =
      householdCase.temporaryAssignment?.status === "ACTIVE" &&
      householdCase.temporaryAssignment.temporaryAshaUid === actorProfile.uid;

    if (!isDirectlyAssigned && !isTemporarilyAssigned) {
      throw new NfcServiceError(
        "You are not authorized to manage NFC credentials for this household because it is not in your assigned caseload.",
        HTTP_STATUS.FORBIDDEN,
        "FORBIDDEN_HOUSEHOLD_ACCESS"
      );
    }
  }

  /**
   * Provisions a brand new NFC credential for an authorized household.
   * STRICT INVARIANT: Exactly one active NFC credential per household.
   * The raw token is returned ONCE so the ASHA device can write it to the physical tag.
   */
  public async provisionNfc(
    householdId: string,
    actorProfile: UserProfile
  ): Promise<NfcProvisionResponse> {
    // 1. Verify caller authorization
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    // 2. Verify target household exists
    const household = await this.householdRepo.getHouseholdById(householdId);
    if (!household) {
      throw new NfcServiceError(
        "Household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    // 3. Prevent duplicate active credentials
    const existingActive = await this.nfcRepo.getActiveByHouseholdId(householdId);
    if (existingActive) {
      throw new NfcServiceError(
        "This household already has an active NFC credential. Please revoke or rotate the existing credential before issuing a new one.",
        HTTP_STATUS.CONFLICT,
        "DUPLICATE_ACTIVE_NFC"
      );
    }

    // 4. Calculate schema version based on previous history
    const historical = await this.nfcRepo.listByHouseholdId(householdId);
    const version = historical.length > 0 ? Math.max(...historical.map((r) => r.version)) + 1 : 1;

    // 5. Generate secure random token and compute deterministic SHA-256 hash
    const rawToken = this.generateSecureToken();
    const tokenHash = hashSecret(rawToken);
    const now = new Date().toISOString();
    const nfcId = `nfc_${householdId}_v${version}`;

    const newRecord: HouseholdNfcRecord = {
      id: nfcId,
      householdId,
      tokenHash,
      version,
      status: "ACTIVE",
      createdAt: now,
      createdBy: actorProfile.uid,
      updatedAt: now,
      updatedBy: actorProfile.uid,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    };

    try {
      await this.nfcRepo.createNfcRecord(newRecord);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("already exists")) {
        throw new NfcServiceError(
          "An active NFC credential already exists for this household.",
          HTTP_STATUS.CONFLICT,
          "DUPLICATE_ACTIVE_NFC"
        );
      }
      throw err;
    }

    return {
      householdId,
      nfcId,
      token: rawToken,
      version,
    };
  }

  /**
   * Initiates rotation for an existing household NFC credential (e.g. lost/damaged card).
   * HARDENED LIFECYCLE: Creates a PENDING_WRITE credential for the new version,
   * keeping the current ACTIVE credential 100% valid and operational until physical write confirmation.
   */
  public async rotateNfc(
    householdId: string,
    actorProfile: UserProfile,
    reason?: string
  ): Promise<NfcProvisionResponse> {
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    const household = await this.householdRepo.getHouseholdById(householdId);
    if (!household) {
      throw new NfcServiceError(
        "Household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    // Must have an active credential to rotate
    const existingActive = await this.nfcRepo.getActiveByHouseholdId(householdId);
    if (!existingActive) {
      throw new NfcServiceError(
        "No active NFC credential found for this household. Use initial registration instead.",
        HTTP_STATUS.NOT_FOUND,
        "NO_ACTIVE_NFC"
      );
    }

    // Clean up any stale or abandoned PENDING_WRITE record for this household
    await this.nfcRepo.cancelPendingRotation(
      householdId,
      undefined,
      actorProfile.uid,
      "SUPERSEDED_BY_NEW_ROTATION"
    );

    // Calculate next version
    const historical = await this.nfcRepo.listByHouseholdId(householdId);
    const version = historical.length > 0 ? Math.max(...historical.map((r) => r.version)) + 1 : 1;

    // Generate secure random token and hash
    const rawToken = this.generateSecureToken();
    const tokenHash = hashSecret(rawToken);
    const nfcId = `nfc_${householdId}_v${version}`;
    const now = new Date().toISOString();

    const pendingRecord: HouseholdNfcRecord = {
      id: nfcId,
      householdId,
      tokenHash,
      version,
      status: "PENDING_WRITE",
      createdAt: now,
      createdBy: actorProfile.uid,
      updatedAt: now,
      updatedBy: actorProfile.uid,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    };

    await this.nfcRepo.createNfcRecord(pendingRecord);

    return {
      householdId,
      nfcId,
      token: rawToken,
      version,
    };
  }

  /**
   * Confirms successful physical NFC card write during rotation.
   * Atomically invalidates previous active card and activates the pending credential.
   */
  public async confirmRotateNfc(
    householdId: string,
    nfcId: string,
    version: number,
    actorProfile: UserProfile,
    reason?: string
  ): Promise<NfcConfirmRotationResponse> {
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    const household = await this.householdRepo.getHouseholdById(householdId);
    if (!household) {
      throw new NfcServiceError(
        "Household record not found.",
        HTTP_STATUS.NOT_FOUND,
        "HOUSEHOLD_NOT_FOUND"
      );
    }

    try {
      const { activatedRecord } = await this.nfcRepo.activatePendingRotation(
        householdId,
        nfcId,
        version,
        actorProfile.uid,
        reason
      );

      return {
        success: true,
        householdId,
        nfcId: activatedRecord.id,
        version: activatedRecord.version,
        status: "ACTIVE",
        activatedAt: activatedRecord.updatedAt,
      };
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message.includes("state is invalid") || err.message.includes("not found"))
      ) {
        throw new NfcServiceError(
          "Pending replacement credential state is invalid or already updated.",
          HTTP_STATUS.CONFLICT,
          "STALE_REPLACEMENT_CREDENTIAL"
        );
      }
      throw err;
    }
  }

  /**
   * Cancels a pending rotation when physical write fails or ASHA leaves the workflow.
   * Ensures the existing active credential remains completely valid.
   */
  public async cancelRotateNfc(
    householdId: string,
    nfcId: string | undefined,
    actorProfile: UserProfile,
    reason?: string
  ): Promise<NfcCancelRotationResponse> {
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    await this.nfcRepo.cancelPendingRotation(
      householdId,
      nfcId,
      actorProfile.uid,
      reason || "REPLACEMENT_CANCELLED_OR_FAILED"
    );

    const activeRecord = await this.nfcRepo.getActiveByHouseholdId(householdId);

    return {
      success: true,
      householdId,
      cancelledNfcId: nfcId,
      activeVersion: activeRecord ? activeRecord.version : 0,
    };
  }

  /**
   * Explicitly revokes an active household NFC card (e.g. card stolen or deceased head).
   */
  public async revokeNfc(
    householdId: string,
    actorProfile: UserProfile,
    reason?: string
  ): Promise<NfcRevokeResponse> {
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    const activeRecord = await this.nfcRepo.getActiveByHouseholdId(householdId);
    if (!activeRecord) {
      throw new NfcServiceError(
        "No active NFC credential found for this household.",
        HTTP_STATUS.NOT_FOUND,
        "NFC_NOT_FOUND"
      );
    }

    const now = new Date().toISOString();
    await this.nfcRepo.updateNfcRecord(activeRecord.id, {
      status: "REVOKED",
      revokedAt: now,
      revokedBy: actorProfile.uid,
      revocationReason: reason || "MANUAL_REVOCATION",
      updatedAt: now,
      updatedBy: actorProfile.uid,
    });

    return {
      success: true,
      householdId,
      status: "REVOKED",
      revokedAt: now,
    };
  }

  /**
   * Safe status query for authorized ASHA / Admin to check if an active card exists.
   * Strictly returns metadata only — NEVER returns raw tokens or token hashes.
   */
  public async getHouseholdNfcStatus(
    householdId: string,
    actorProfile: UserProfile
  ): Promise<HouseholdNfcStatusResponse> {
    await this.verifyHouseholdAuthorization(householdId, actorProfile);

    const activeRecord = await this.nfcRepo.getActiveByHouseholdId(householdId);
    const pending = await this.nfcRepo.getPendingByHouseholdId(householdId);

    if (!activeRecord) {
      return {
        hasActiveNfc: false,
        record: null,
        pendingReplacement: pending
          ? {
              id: pending.id,
              version: pending.version,
              createdAt: pending.createdAt,
            }
          : null,
      };
    }

    return {
      hasActiveNfc: true,
      record: {
        id: activeRecord.id,
        householdId: activeRecord.householdId,
        version: activeRecord.version,
        status: activeRecord.status,
        createdAt: activeRecord.createdAt,
        updatedAt: activeRecord.updatedAt,
        revokedAt: activeRecord.revokedAt,
      },
      pendingReplacement: pending
        ? {
            id: pending.id,
            version: pending.version,
            createdAt: pending.createdAt,
          }
        : null,
    };
  }

  /**
   * Rate limiting check for public brute-force protection.
   */
  private checkRateLimit(clientKey: string): void {
    const now = Date.now();
    const entry = this.failedAttempts.get(clientKey);

    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= this.MAX_FAILED_ATTEMPTS) {
          throw new NfcServiceError(
            "Too many failed verification attempts. Please wait before trying again.",
            429,
            "RATE_LIMIT_EXCEEDED"
          );
        }
      } else {
        // Window expired, reset
        this.failedAttempts.delete(clientKey);
      }
    }
  }

  private recordFailedAttempt(clientKey: string): void {
    const now = Date.now();
    const entry = this.failedAttempts.get(clientKey);
    if (entry && now < entry.resetAt) {
      entry.count += 1;
    } else {
      this.failedAttempts.set(clientKey, {
        count: 1,
        resetAt: now + this.ATTEMPT_WINDOW_MS,
      });
    }
  }

  private recordSuccessfulAttempt(clientKey: string): void {
    this.failedAttempts.delete(clientKey);
  }

  /**
   * Resolves the unauthenticated public NFC tap request.
   * STRICT ANTI-ENUMERATION: Generic error on any verification failure to prevent household probing.
   * STRICT PRIVACY BOUNDARY: Returns ONLY the locked privacy-minimal public DTO.
   */
  public async resolvePublicNfc(
    householdId: string,
    token: string,
    clientIp: string = "unknown"
  ): Promise<NfcResolveResponse> {
    const rateLimitKey = `${clientIp}_${householdId}`;
    this.checkRateLimit(rateLimitKey);

    // Generic error helper to avoid revealing whether a household exists vs wrong token
    const genericFailure = () => {
      this.recordFailedAttempt(rateLimitKey);
      return new NfcServiceError(
        "Invalid or unavailable NFC credential.",
        HTTP_STATUS.UNAUTHORIZED,
        "INVALID_NFC_CREDENTIAL"
      );
    };

    if (!householdId || !token || token.trim().length < 16) {
      throw genericFailure();
    }

    // 1. Fetch active NFC record for the household
    const nfcRecord = await this.nfcRepo.getActiveByHouseholdId(householdId.trim());
    if (!nfcRecord || nfcRecord.status !== "ACTIVE") {
      throw genericFailure();
    }

    // 2. Constant-time cryptographic verification of token hash
    const isValidToken = verifySecretHash(token.trim(), nfcRecord.tokenHash);
    if (!isValidToken) {
      throw genericFailure();
    }

    // 3. Fetch household profile
    const household = await this.householdRepo.getHouseholdById(householdId.trim());
    if (!household) {
      throw genericFailure();
    }

    // Clear failed attempts on successful verification
    this.recordSuccessfulAttempt(rateLimitKey);

    // 4. Deterministic scheme eligibility evaluation using existing engine
    const members = await this.householdRepo.getMembers(household.id);
    const eligibilityResults = await this.eligibilityService.evaluateHouseholdForSchemes(
      household,
      members
    );

    // 5. Map eligibility results to safe public summaries
    const schemes: NfcPublicSchemeSummary[] = eligibilityResults.map((res) => ({
      schemeId: res.schemeId,
      name: res.schemeName,
      benefit: res.benefitSummary,
      nextSteps:
        res.nextActions && res.nextActions.length > 0
          ? res.nextActions[0].description
          : "Consult your local ASHA worker or nearest Primary Health Center for enrollment assistance.",
      eligibilityStatus:
        res.status === "ELIGIBLE"
          ? "ELIGIBLE"
          : res.status === "NEEDS_INFORMATION"
          ? "CHECK_REQUIRED"
          : "ACTION_REQUIRED",
    }));

    // 6. Resolve safe public ASHA worker directory information
    let ashaInfo: NfcPublicAshaInfo | null = null;
    const householdCase = await this.caseRepo.getCaseByHouseholdId(household.id);
    if (householdCase) {
      const activeAshaUid =
        householdCase.temporaryAssignment?.status === "ACTIVE"
          ? householdCase.temporaryAssignment.temporaryAshaUid
          : householdCase.assignedAshaUid;

      const ashaUser = await this.userRepo.getUserById(activeAshaUid);
      if (ashaUser) {
        ashaInfo = {
          displayName: ashaUser.displayName || "ASHA Healthcare Worker",
          serviceArea: ashaUser.serviceArea || `${household.district} Health Jurisdiction`,
          code: ashaUser.ashaServiceCode || "ASHA-GOV-CARE",
        };
      }
    }

    // 7. Assemble strictly privacy-minimal DTO
    // OMITTED: incomeCategory, rationCardNumber, contactPhone, member roster, medical conditions
    return {
      household: {
        displayName: household.headOfHouseholdName,
        region: {
          village: household.village,
          district: household.district,
          state: household.state,
        },
      },
      schemes,
      asha: ashaInfo,
    };
  }
}
