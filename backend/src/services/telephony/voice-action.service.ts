import { VoiceSession } from "../../../../shared/types/voice.js";
import { SchemeService } from "../scheme.service.js";
import { HouseholdRepository } from "../../repositories/household.repository.js";
import { EligibilityService } from "../eligibility/eligibility.service.js";
import { AssistanceService } from "../assistance.service.js";
import { CaseRepository } from "../../repositories/case.repository.js";
import { ConnectionRepository } from "../../repositories/connection.repository.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { VoiceResponseFormatter } from "./voice-response-formatter.js";

export interface VoiceActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  requiresVerification?: boolean;
}

export class VoiceActionService {
  constructor(
    private schemeService: SchemeService,
    private householdRepository: HouseholdRepository,
    private eligibilityService: EligibilityService,
    private assistanceService: AssistanceService,
    private caseRepository: CaseRepository,
    private connectionRepository: ConnectionRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * 0. Emergency Escalation (Medical Safety Boundary)
   */
  public handleEmergencyRedirection(sessionOrLang?: VoiceSession | string): VoiceActionResult {
    const lang = typeof sessionOrLang === "string" ? sessionOrLang : sessionOrLang?.language;
    return {
      success: true,
      message: VoiceResponseFormatter.getEmergencyRedirection(lang),
      data: { isEmergency: true, emergencyNumber: "108" },
    };
  }

  /**
   * 1. Public Scheme Information (Unauthenticated safe)
   */
  public async getPublicSchemeInfo(
    schemeId?: string,
    sessionOrLang?: VoiceSession | string
  ): Promise<VoiceActionResult> {
    const lang = typeof sessionOrLang === "string" ? sessionOrLang : sessionOrLang?.language;
    const targetSchemeId = schemeId || "ab-pmjay";
    const scheme = await this.schemeService.getSchemeById(targetSchemeId);

    if (!scheme) {
      return {
        success: true,
        message: VoiceResponseFormatter.getGeneralSchemeInfo(lang),
        data: { schemeId: targetSchemeId },
      };
    }

    const cov = (scheme as any).coverageAmount || (scheme as any).coverage_amount;
    const shortDesc = scheme.description.slice(0, 180);
    return {
      success: true,
      message: VoiceResponseFormatter.getSchemeDetails(
        scheme.name,
        scheme.shortName,
        shortDesc,
        cov,
        lang
      ),
      data: {
        schemeId: scheme.id,
        name: scheme.name,
        shortName: scheme.shortName,
        coverageAmount: cov,
      },
    };
  }

  /**
   * 2. Verify Caller Identity
   * Checks verificationCode against registered household ration card or PIN
   */
  public async verifyCallerIdentity(
    session: VoiceSession,
    verificationCode?: string
  ): Promise<VoiceActionResult> {
    const lang = session.language;
    if (!verificationCode || verificationCode.trim().length === 0) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    const code = verificationCode.trim();

    // If householdId is already linked to session, verify against it
    if (session.householdId) {
      const household = await this.householdRepository.getHouseholdById(session.householdId);
      if (household) {
        const rc = household.rationCardNumber || "";
        const isMatch = rc.endsWith(code) || rc === code || code === "1234"; // 1234 dev fallback
        if (isMatch) {
          return {
            success: true,
            message: VoiceResponseFormatter.getVerificationSuccess(household.headOfHouseholdName, lang),
            data: { householdId: household.id, headName: household.headOfHouseholdName },
          };
        }
      }
    }

    // Try finding household by last digits of ration card
    if (session.citizenId) {
      const household = await this.householdRepository.getHouseholdByOwnerUid(session.citizenId);
      if (household) {
        const rc = household.rationCardNumber || "";
        if (rc.endsWith(code) || rc === code || code === "1234") {
          return {
            success: true,
            message: VoiceResponseFormatter.getVerificationSuccess(household.headOfHouseholdName, lang),
            data: { householdId: household.id, headName: household.headOfHouseholdName },
          };
        }
      }
    }

    return {
      success: false,
      message: VoiceResponseFormatter.getVerificationMismatch(lang),
      requiresVerification: true,
    };
  }

  /**
   * 3. Evaluate Eligible Schemes for Verified Household
   */
  public async getEligibleSchemes(session: VoiceSession): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    const household = await this.householdRepository.getHouseholdById(session.householdId);
    if (!household) {
      return {
        success: false,
        message: "Household profile not found. Please set up your household profile on the SwasthyaSetu portal.",
      };
    }

    const members = await this.householdRepository.getMembers(session.householdId);
    const evalResults = await this.eligibilityService.evaluateHouseholdForSchemes(household, members);
    const eligibleSchemes = evalResults.filter((s) => s.status === "ELIGIBLE");

    const message = VoiceResponseFormatter.getHouseholdEligibleSchemes(
      household.headOfHouseholdName,
      eligibleSchemes.map((s) => ({ id: s.schemeId, name: s.schemeName })),
      lang
    );

    return {
      success: true,
      message,
      data: {
        eligibleCount: eligibleSchemes.length,
        schemes: eligibleSchemes.map((s) => ({ id: s.schemeId, name: s.schemeName })),
      },
    };
  }

  /**
   * 4. Evaluate Specific Member Eligibility (e.g. 71-year-old grandfather for PM-JAY)
   */
  public async getEligibilityForMember(
    session: VoiceSession,
    memberIdentifier?: string,
    schemeId: string = "ab-pmjay"
  ): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    const household = await this.householdRepository.getHouseholdById(session.householdId);
    if (!household) {
      return {
        success: false,
        message: "Household profile not found.",
      };
    }

    const members = await this.householdRepository.getMembers(session.householdId);
    if (members.length === 0) {
      return {
        success: false,
        message: "No family members are currently registered in your household profile.",
      };
    }

    // Match member by identifier or seniority
    let targetMember = members[0];
    if (memberIdentifier === "senior_grandfather") {
      const senior = members.find((m) => m.age >= 60 || m.relationship.toLowerCase().includes("grandfather") || m.relationship.toLowerCase().includes("father"));
      if (senior) targetMember = senior;
    } else if (memberIdentifier === "maternal_mother") {
      const mother = members.find((m) => m.maternalStatus === "pregnant" || m.gender === "female");
      if (mother) targetMember = mother;
    }

    const evalResults = await this.eligibilityService.evaluateHouseholdForSchemes(household, members);
    const memberMatches = evalResults.filter(
      (s) => s.schemeId === schemeId && s.status === "ELIGIBLE"
    );

    const isEligible = memberMatches.length > 0 || (schemeId === "ab-pmjay" && targetMember.age >= 70);

    const message = VoiceResponseFormatter.getMemberEligibility(
      isEligible,
      targetMember.fullName,
      targetMember.age,
      targetMember.relationship,
      schemeId,
      lang
    );

    return {
      success: true,
      message,
      data: {
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        age: targetMember.age,
        isEligible,
        schemeId,
      },
    };
  }

  /**
   * 5. Check Active Assistance Status ($X/5$ for PM-JAY, $X/6$ for JSY)
   */
  public async getAssistanceStatus(
    session: VoiceSession,
    schemeId?: string
  ): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    // Look for active cases for this household
    const allCases = (await this.caseRepository.listAllCases()).filter(
      (c) => c.householdId === session.householdId
    );
    const activeCase = schemeId
      ? allCases.find((c) => c.schemeId === schemeId)
      : allCases[0];

    if (!activeCase) {
      return {
        success: true,
        message: VoiceResponseFormatter.getAssistanceStatus(false, "", "", 0, 0, lang),
        data: { hasActiveCase: false },
      };
    }

    const schemeName = activeCase.schemeName || (activeCase.schemeId === "jsy" ? "Janani Suraksha Yojana" : "Ayushman Bharat PM-JAY");
    const isPmjay = activeCase.schemeId === "ab-pmjay";
    const totalTasks = isPmjay ? 5 : 6;
    const completedTasks = (activeCase as any).completedTasksCount || 0;

    const message = VoiceResponseFormatter.getAssistanceStatus(
      true,
      schemeName,
      activeCase.status,
      completedTasks,
      totalTasks,
      lang
    );

    return {
      success: true,
      message,
      data: {
        caseId: activeCase.id,
        status: activeCase.status,
        completedTasks,
        totalTasks,
        schemeId: activeCase.schemeId,
      },
    };
  }

  /**
   * 6. Check Follow-Up Schedule
   */
  public async getFollowUpStatus(session: VoiceSession): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    const allCases = (await this.caseRepository.listAllCases()).filter(
      (c) => c.householdId === session.householdId
    );
    if (allCases.length === 0) {
      return {
        success: true,
        message: VoiceResponseFormatter.getFollowUpStatus(false, undefined, undefined, false, lang),
      };
    }

    let nearestFollowUp: any = null;
    for (const c of allCases) {
      const followUps = await this.caseRepository.getFollowUps(c.id);
      if (followUps && followUps.length > 0) {
        const pending = followUps.find((f: any) => f.status === "PENDING");
        if (pending) {
          nearestFollowUp = pending;
          break;
        }
      }
    }

    if (!nearestFollowUp) {
      return {
        success: true,
        message: VoiceResponseFormatter.getFollowUpStatus(false, undefined, undefined, false, lang),
      };
    }

    const dueDate = new Date(nearestFollowUp.dueAt || nearestFollowUp.scheduledAt).toLocaleDateString();
    const isOverdue = nearestFollowUp.isOverdue || new Date(nearestFollowUp.dueAt).getTime() < Date.now();

    const message = VoiceResponseFormatter.getFollowUpStatus(
      true,
      nearestFollowUp.title || nearestFollowUp.reason,
      dueDate,
      isOverdue,
      lang
    );

    return {
      success: true,
      message,
      data: { followUpId: nearestFollowUp.id, isOverdue, dueDate },
    };
  }

  /**
   * 7. Check Connected ASHA Details
   */
  public async getConnectedAsha(session: VoiceSession): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    const connection = await this.connectionRepository.getActiveRequestByHouseholdId(session.householdId);
    if (!connection || connection.status !== "ACTIVE") {
      return {
        success: true,
        message: VoiceResponseFormatter.getConnectedAsha(false, undefined, undefined, lang),
      };
    }

    const ashaUser = await this.userRepository.getUserById(connection.ashaUid);
    const ashaName = ashaUser?.displayName || "your local ASHA worker";
    const area = ashaUser?.serviceArea || "your village/ward";

    return {
      success: true,
      message: VoiceResponseFormatter.getConnectedAsha(true, ashaName, area, lang),
      data: {
        ashaUid: connection.ashaUid,
        ashaName,
        serviceArea: area,
      },
    };
  }

  /**
   * 8. Request Assistance (Idempotent — Reuses existing case if present)
   */
  public async requestAssistance(
    session: VoiceSession,
    schemeId: string = "ab-pmjay",
    memberId?: string,
    notes?: string
  ): Promise<VoiceActionResult> {
    const lang = session.language;
    if (session.verificationStatus !== "VERIFIED" || !session.householdId) {
      return {
        success: false,
        message: VoiceResponseFormatter.getVerificationPrompt(lang),
        requiresVerification: true,
      };
    }

    // 1. Check if an active case or assistance request already exists (Idempotency!)
    const existingCases = (await this.caseRepository.listAllCases()).filter(
      (c) => c.householdId === session.householdId
    );
    const matchingCase = existingCases.find((c) => c.schemeId === schemeId);

    if (matchingCase) {
      const isPmjay = matchingCase.schemeId === "ab-pmjay";
      const totalTasks = isPmjay ? 5 : 6;
      const completedTasks = (matchingCase as any).completedTasksCount || 0;
      return {
        success: true,
        message: VoiceResponseFormatter.getRequestAssistanceResult(
          true,
          matchingCase.schemeName || schemeId,
          completedTasks,
          totalTasks,
          lang
        ),
        data: { caseId: matchingCase.id, isExisting: true },
      };
    }

    // 2. Submit new assistance request via existing AssistanceService
    const scheme = await this.schemeService.getSchemeById(schemeId);
    const schemeName = scheme?.name || "Ayushman Bharat PM-JAY";

    const userProfile = session.citizenId ? await this.userRepository.getUserById(session.citizenId) : null;
    const citizenProfile: any = userProfile || {
      uid: session.citizenId || "voice_citizen_user",
      role: "CITIZEN",
      email: "voice.caller@swasthyasetu.gov.in",
      phoneNumber: session.maskedCallerNumber || "+919876543210",
      consentStatus: "accepted",
      consentVersion: "1.0",
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const created = await this.assistanceService.createAssistanceRequest(citizenProfile, {
        category: "DOCUMENT_HELP",
        schemeId,
        schemeName,
        beneficiaryMemberId: memberId || undefined,
        message: notes || "Assistance requested via SwasthyaSetu Voice Helpline.",
        priority: "HIGH",
      });

      const totalTasks = schemeId === "ab-pmjay" ? 5 : 6;
      return {
        success: true,
        message: VoiceResponseFormatter.getRequestAssistanceResult(
          false,
          schemeName,
          0,
          totalTasks,
          lang
        ),
        data: {
          requestId: created.id,
          isExisting: false,
          schemeName,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Unable to submit assistance request at this moment.",
      };
    }
  }

  /**
   * 9. End Call
   */
  public async endCall(session?: VoiceSession | string): Promise<VoiceActionResult> {
    const lang = typeof session === "string" ? session : session?.language;
    return {
      success: true,
      message: VoiceResponseFormatter.getEndCall(lang),
      data: { shouldEndCall: true },
    };
  }
}
