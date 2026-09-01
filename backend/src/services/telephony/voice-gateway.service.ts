import { createHash } from "crypto";
import {
  VoiceSession,
  VoiceTurnRequest,
  VoiceTurnResponse,
  VoiceHealthResponse,
  VoicePublicConfig,
  CitizenCallRequest,
  AshaCallRequest,
  CallHistoryItem,
  ExotelInboundWebhookPayload,
  ExotelStatusCallbackPayload,
  CallOutcome,
  VoiceIntentType,
  VoiceActionName,
  SupportedVoiceLanguage,
  VOICE_LANGUAGE_OPTIONS,
  normalizeIndianPhoneNumber,
  toE164IndianPhoneNumber,
  toVoiceLanguage,
} from "../../../../shared/types/voice.js";
import { VoiceSessionRepository } from "../../repositories/voice-session.repository.js";
import { SarvamService } from "./sarvam.service.js";
import { ExotelService, ExotelTelephonyError } from "./exotel.service.js";
import { VoiceActionService } from "./voice-action.service.js";
import { VoiceResponseFormatter } from "./voice-response-formatter.js";
import { voiceKnowledgeService } from "./voice-knowledge.service.js";
import { CaseRepository } from "../../repositories/case.repository.js";
import { HouseholdRepository } from "../../repositories/household.repository.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { AutomationService } from "../automation/automation.service.js";
import { env } from "../../config/env.js";

export class VoiceGatewayService {
  constructor(
    private sessionRepository: VoiceSessionRepository,
    private sarvamService: SarvamService,
    private exotelService: ExotelService,
    private voiceActionService: VoiceActionService,
    private caseRepository: CaseRepository,
    private householdRepository: HouseholdRepository,
    private userRepository: UserRepository,
    private automationService: AutomationService
  ) {}

  /**
   * SHA-256 phone number hashing for privacy
   */
  private hashPhoneNumber(phone: string): string {
    const normalized = phone.replace(/[^\d+]/g, "");
    return createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Mask phone number for display
   */
  private maskPhoneNumber(phone: string): string {
    const clean = phone.replace(/[^\d+]/g, "");
    if (clean.length < 6) return clean;
    const start = clean.slice(0, 3);
    const end = clean.slice(-3);
    return `${start}***${end}`;
  }

  /**
   * Resolves the authoritative language for a direct inbound PSTN call.
   *
   * Precedence Hierarchy (Section 9):
   * Priority 1: Known caller phone number → registered user profile language preference (preferredLanguage)
   * Priority 2: Existing active/recent voice session associated with the caller (last 24h) → session.language
   * Priority 3: Caller-provided language parameter (from customParams / IVR if provided)
   * Priority 4: Safe default → en-IN
   */
  public async resolveInboundVoiceLanguage(
    callerPhone: string,
    explicitParamLang?: string | null
  ): Promise<SupportedVoiceLanguage> {
    const clean10 = normalizeIndianPhoneNumber(callerPhone);

    // Priority 1: Known caller phone number → registered user profile / household language preference
    if (clean10 && clean10.length === 10) {
      try {
        let matchedOwnerUid: string | null = null;
        const memoryHouseholds = (this.householdRepository as any).memoryHouseholds;
        if (memoryHouseholds) {
          for (const h of memoryHouseholds.values()) {
            if (h.contactPhone && normalizeIndianPhoneNumber(h.contactPhone) === clean10) {
              matchedOwnerUid = h.ownerUid;
              break;
            }
          }
        }

        if (matchedOwnerUid) {
          const user = await this.userRepository.getUserById(matchedOwnerUid);
          if (user?.preferredLanguage) {
            return toVoiceLanguage(user.preferredLanguage);
          }
        }

        const memoryUsers = (this.userRepository as any).memoryStore || (this.userRepository as any).memoryUsers;
        if (memoryUsers) {
          for (const u of memoryUsers.values()) {
            if (u.phoneNumber && normalizeIndianPhoneNumber(u.phoneNumber) === clean10) {
              if (u.preferredLanguage) {
                return toVoiceLanguage(u.preferredLanguage);
              }
              break;
            }
          }
        }
      } catch {
        // Safe non-blocking fallback
      }
    }

    // Priority 2: Existing active/recent voice session associated with the caller (within 24h)
    if (clean10 && clean10.length === 10 && !explicitParamLang) {
      try {
        const hash = this.hashPhoneNumber(callerPhone);
        const recentSession = await this.sessionRepository.getRecentSessionByCallerHash(hash);
        if (
          recentSession?.language &&
          (recentSession.language === "en-IN" || recentSession.language === "kn-IN" || recentSession.language === "hi-IN")
        ) {
          return toVoiceLanguage(recentSession.language);
        }
      } catch {
        // Safe non-blocking fallback
      }
    }

    // Priority 3: Caller-provided language selection parameter (if provided)
    if (explicitParamLang) {
      const mapped = toVoiceLanguage(explicitParamLang);
      if (mapped) return mapped;
    }

    // Priority 4: Safe default → en-IN
    return "en-IN";
  }

  /**
   * 1. Create Inbound Voice Session
   */
  public async createInboundSession(
    callerPhone: string,
    callSid?: string,
    language?: string
  ): Promise<VoiceSession> {
    const id = `vses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sid = callSid || `exo_in_${Date.now()}`;
    const hash = this.hashPhoneNumber(callerPhone);
    const masked = this.maskPhoneNumber(callerPhone);
    const cleanPhone = normalizeIndianPhoneNumber(callerPhone);

    // Attempt to lookup citizen/household by phone WITHOUT verifying yet
    let matchedCitizenId: string | null = null;
    let matchedHouseholdId: string | null = null;
    let matchedUserLanguage: SupportedVoiceLanguage | null = null;

    try {
      const memoryHouseholds = (this.householdRepository as any).memoryHouseholds;
      if (memoryHouseholds) {
        for (const h of memoryHouseholds.values()) {
          if (h.contactPhone && normalizeIndianPhoneNumber(h.contactPhone) === cleanPhone) {
            matchedHouseholdId = h.id;
            matchedCitizenId = h.ownerUid;
            break;
          }
        }
      }
      if (matchedCitizenId) {
        const user = await this.userRepository.getUserById(matchedCitizenId);
        if (user?.preferredLanguage) {
          matchedUserLanguage = toVoiceLanguage(user.preferredLanguage);
        }
      }
    } catch {
      // Non-blocking lookup
    }

    const resolvedLanguage = language
      ? toVoiceLanguage(language)
      : matchedUserLanguage || (await this.resolveInboundVoiceLanguage(callerPhone));

    const session: VoiceSession = {
      id,
      callSid: sid,
      direction: "INBOUND",
      provider: this.exotelService?.isConfigured?.() ? "EXOTEL" : "TEST_MOCK",
      callerNumberHash: hash,
      maskedCallerNumber: masked,
      status: "ACTIVE",
      verificationStatus: "UNVERIFIED", // Must start unverified for privacy!
      citizenId: matchedCitizenId,
      householdId: matchedHouseholdId,
      language: resolvedLanguage,
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.createSession(session);

    // Emit domain audit event
    await this.automationService.emitDomainEvent("VOICE_CALL_STARTED", {
      caseId: "unbound",
      householdId: matchedHouseholdId || "unknown",
      assignedAshaUid: "system",
      payload: { sessionId: id, callSid: sid, direction: "INBOUND" },
    });

    return session;
  }

  /**
   * 2. Handle Inbound Exotel Webhook
   */
  public async handleExotelInboundWebhook(
    payload: ExotelInboundWebhookPayload
  ): Promise<{ responseXmlOrText: string; session: VoiceSession }> {
    const callerPhone = payload.From || payload.CallerNumber || "+919876543210";
    const callSid = payload.CallSid || `exo_${Date.now()}`;

    let session = await this.sessionRepository.getSessionByCallSid(callSid);
    if (!session) {
      session = await this.createInboundSession(callerPhone, callSid);
    }

    const greetingMessage = VoiceResponseFormatter.getGreeting(session.language);

    const passthruResponse = this.exotelService.buildPassthruResponse(greetingMessage);
    return { responseXmlOrText: passthruResponse, session };
  }

  /**
   * 3. Process Conversational Voice Turn
   */
  public async processTurn(
    sessionId: string,
    request: VoiceTurnRequest
  ): Promise<VoiceTurnResponse> {
    const session = await this.sessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Voice session "${sessionId}" not found.`);
    }

    if (session.status === "COMPLETED" || session.status === "ENDED") {
      return {
        sessionId,
        status: session.status,
        verificationStatus: session.verificationStatus,
        textResponse: VoiceResponseFormatter.getEndCall(session.language),
        detectedIntent: "END_CALL",
        shouldEndCall: true,
        language: session.language,
      };
    }

    // Increment turn count
    session.turnCount += 1;

    // Cost Control check
    if (session.turnCount > session.maxTurns) {
      session.status = "COMPLETED";
      session.endedAt = new Date().toISOString();
      await this.sessionRepository.updateSession(sessionId, session);

      return {
        sessionId,
        status: "COMPLETED",
        verificationStatus: session.verificationStatus,
        textResponse: VoiceResponseFormatter.getMaxTurnsPrompt(session.language),
        detectedIntent: "END_CALL",
        shouldEndCall: true,
        language: session.language,
      };
    }

    // Step 1: Speech-to-Text if audio is provided
    let transcript = request.transcript || "";
    if (request.audioBase64 && (!transcript || transcript.trim().length === 0)) {
      try {
        const sttResult = await this.sarvamService.speechToText(
          request.audioBase64,
          session.language,
          request.audioFormat || "wav"
        );
        transcript = sttResult.transcript || "";
      } catch {
        transcript = "";
      }
    }

    // Step 2: Extract Intent & Entities with multi-turn context
    const nluResult = this.sarvamService.understandIntent(
      transcript,
      session.language,
      session.conversationContext
    );
    session.currentIntent = nluResult.intent;

    // Persist extracted entities to conversation context for subsequent turns
    if (!session.conversationContext) {
      session.conversationContext = {};
    }
    if (nluResult.entities) {
      if (nluResult.entities.age !== undefined) {
        session.conversationContext.lastMemberAge = nluResult.entities.age;
      }
      if (nluResult.entities.relation) {
        session.conversationContext.lastMemberRelation = nluResult.entities.relation;
      }
      if (nluResult.entities.gender) {
        session.conversationContext.lastMemberGender = nluResult.entities.gender;
      }
      if (nluResult.entities.schemeId) {
        session.conversationContext.lastSchemeId = nluResult.entities.schemeId;
      }
    }

    // If explicit verificationCode is passed in request, override
    if (request.verificationCode) {
      nluResult.intent = "VERIFY_IDENTITY";
      nluResult.verificationCode = request.verificationCode;
    }

    let textResponse = "";
    let executedAction: VoiceActionName | undefined;
    let actionResultData: Record<string, unknown> | undefined;
    let shouldEndCall = false;

    // Step 3: Dispatch to Strict Allowlisted VoiceActionService or Grounded Knowledge Layer
    switch (nluResult.intent) {
      case "EMERGENCY": {
        executedAction = "handleEmergencyRedirection";
        const res = this.voiceActionService.handleEmergencyRedirection(session);
        textResponse = res.message;
        actionResultData = res.data;
        break;
      }

      case "GREETING": {
        textResponse = VoiceResponseFormatter.getGreeting(session.language);
        break;
      }

      case "ABOUT_SWASTHYASETU":
      case "HOW_TO_USE_WEBSITE":
      case "CITIZEN_PORTAL_INFO":
      case "ASHA_PORTAL_INFO":
      case "ADMIN_PORTAL_INFO":
      case "SPECIFIC_SCHEME_INFORMATION":
      case "SCHEME_INFORMATION":
      case "VOICE_ASSISTANT_HELP":
      case "HELP": {
        executedAction = "getGroundedKnowledge";
        const knowRes = voiceKnowledgeService.queryKnowledge({
          transcript,
          language: session.language,
          intent: nluResult.intent,
          topic: nluResult.topic,
          schemeId: nluResult.schemeId,
        });
        if (knowRes.found) {
          textResponse = knowRes.text;
          actionResultData = { topic: knowRes.topic, category: knowRes.category };
        } else {
          textResponse = VoiceResponseFormatter.getGeneralSchemeInfo(session.language);
        }
        break;
      }

      case "VERIFY_IDENTITY": {
        executedAction = "verifyCallerIdentity";
        const res = await this.voiceActionService.verifyCallerIdentity(
          session,
          nluResult.verificationCode
        );
        textResponse = res.message;
        actionResultData = res.data;

        if (res.success && res.data?.householdId) {
          session.verificationStatus = "VERIFIED";
          session.householdId = res.data.householdId as string;
          await this.automationService.emitDomainEvent("VOICE_CALL_VERIFIED", {
            caseId: "unbound",
            householdId: session.householdId,
            assignedAshaUid: session.assignedAshaUid || "system",
            payload: { sessionId, status: "VERIFIED" },
          });
        }
        break;
      }

      case "CHECK_SCHEMES": {
        executedAction = "getPublicSchemeInfo";
        const knowRes = voiceKnowledgeService.queryKnowledge({
          transcript,
          language: session.language,
          intent: nluResult.intent,
          topic: nluResult.topic,
          schemeId: nluResult.schemeId,
        });
        if (knowRes.found) {
          textResponse = knowRes.text;
          actionResultData = { schemeId: nluResult.schemeId, topic: knowRes.topic, category: knowRes.category };
        } else {
          const res = await this.voiceActionService.getPublicSchemeInfo(nluResult.schemeId, session);
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "CHECK_ELIGIBILITY": {
        if (nluResult.clarificationPrompt) {
          textResponse = nluResult.clarificationPrompt;
        } else if (session.verificationStatus !== "VERIFIED") {
          // If caller provided general attributes (e.g. 70+ senior citizen or pregnancy),
          // explain the general scheme matching based on official criteria before asking for ration card verification
          if (nluResult.entities?.age !== undefined && nluResult.entities.age >= 70) {
            const lang = toVoiceLanguage(session.language);
            if (lang === "kn-IN") {
              textResponse = "70 ವರ್ಷ ಮತ್ತು ಮೇಲ್ಪಟ್ಟ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಸಾರ್ವತ್ರಿಕ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY ಅಡಿಯಲ್ಲಿ 5 ಲಕ್ಷ ರೂಪಾಯಿಗಳ ಉಚಿತ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆ ಲಭ್ಯವಿದೆ. ನಿಮ್ಮ ಕುಟುಂಬದ ನಿಖರ ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ದಯವಿಟ್ಟು ಪಡಿತರ ಚೀಟಿ ಸಂಖ್ಯೆಯನ್ನು ತಿಳಿಸಿ.";
            } else if (lang === "hi-IN") {
              textResponse = "70 वर्ष और उससे अधिक उम्र के बुजुर्गों के लिए आयुष्मान भारत PM-JAY के तहत 5 लाख रुपये का कैशलेस इलाज उपलब्ध है। अपने पारिवारिक रिकॉर्ड के सत्यापन के लिए कृपया राशन कार्ड नंबर बताएं।";
            } else {
              textResponse = "Senior citizens aged 70 and above qualify for up to ₹5 lakh cashless hospital cover under universal Ayushman Bharat PM-JAY. To verify your family's official record, please provide your ration card number.";
            }
          } else if (nluResult.entities?.pregnancyStatus) {
            const lang = toVoiceLanguage(session.language);
            if (lang === "kn-IN") {
              textResponse = "ಗರ್ಭಿಣಿಯರಿಗೆ ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ ಮತ್ತು ಮಾತೃ ವಂದನಾ ಯೋಜನೆ ಅಡಿಯಲ್ಲಿ ಆಸ್ಪತ್ರೆ ಹೆರಿಗೆ ಧನಸಹಾಯ ಮತ್ತು ಉಚಿತ ತಪಾಸಣೆ ಲಭ್ಯವಿದೆ. ನಿಮ್ಮ ಕುಟುಂಬದ ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ದಯವಿಟ್ಟು ಪಡಿತರ ಚೀಟಿ ಸಂಖ್ಯೆಯನ್ನು ತಿಳಿಸಿ.";
            } else if (lang === "hi-IN") {
              textResponse = "गर्भवती महिलाओं को जननी सुरक्षा योजना और मातृ वंदना योजना के तहत संस्थागत प्रसव सहायता और नकद लाभ मिलता है। पारिवारिक रिकॉर्ड सत्यापन के लिए कृपया राशन कार्ड नंबर बताएं।";
            } else {
              textResponse = "Pregnant women qualify for institutional delivery cash assistance and free checkups under JSY and PMMVY. To verify your family's official record, please provide your ration card number.";
            }
          } else {
            // Privacy protection: prompt for verification in session language
            textResponse = VoiceResponseFormatter.getVerificationPrompt(session.language);
          }
        } else {
          executedAction = "getEligibilityForMember";
          const res = await this.voiceActionService.getEligibilityForMember(
            session,
            nluResult.memberIdentifier,
            nluResult.schemeId || "ab-pmjay"
          );
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "CHECK_ASSISTANCE_STATUS": {
        if (session.verificationStatus !== "VERIFIED") {
          textResponse = VoiceResponseFormatter.getVerificationPrompt(session.language);
        } else {
          executedAction = "getAssistanceStatus";
          const res = await this.voiceActionService.getAssistanceStatus(session, nluResult.schemeId);
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "CHECK_FOLLOW_UP": {
        if (session.verificationStatus !== "VERIFIED") {
          textResponse = VoiceResponseFormatter.getVerificationPrompt(session.language);
        } else {
          executedAction = "getFollowUpStatus";
          const res = await this.voiceActionService.getFollowUpStatus(session);
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "CONTACT_ASHA": {
        if (session.verificationStatus !== "VERIFIED") {
          textResponse = VoiceResponseFormatter.getVerificationPrompt(session.language);
        } else {
          executedAction = "getConnectedAsha";
          const res = await this.voiceActionService.getConnectedAsha(session);
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "REQUEST_ASSISTANCE": {
        if (session.verificationStatus !== "VERIFIED") {
          textResponse = VoiceResponseFormatter.getVerificationPrompt(session.language);
        } else {
          executedAction = "requestAssistance";
          const res = await this.voiceActionService.requestAssistance(
            session,
            nluResult.schemeId || "ab-pmjay",
            nluResult.memberIdentifier,
            nluResult.notes
          );
          textResponse = res.message;
          actionResultData = res.data;
        }
        break;
      }

      case "END_CALL": {
        executedAction = "endCall";
        const res = await this.voiceActionService.endCall(session);
        textResponse = res.message;
        shouldEndCall = true;
        session.status = "COMPLETED";
        session.endedAt = new Date().toISOString();
        break;
      }

      default: {
        textResponse = VoiceResponseFormatter.getDefaultFallbackPrompt(session.language);
        break;
      }
    }

    // Step 4: Optional Text-to-Speech synthesis
    let audioBase64: string | null = null;
    if (this.sarvamService.isConfigured() && textResponse) {
      try {
        const tts = await this.sarvamService.textToSpeech(textResponse, session.language);
        if (tts.audios && tts.audios.length > 0) {
          audioBase64 = tts.audios[0];
        }
      } catch {
        audioBase64 = null;
      }
    }

    // Step 5: Persist updated session
    session.updatedAt = new Date().toISOString();
    await this.sessionRepository.updateSession(sessionId, session);

    return {
      sessionId,
      status: session.status,
      verificationStatus: session.verificationStatus,
      textResponse,
      audioBase64,
      detectedIntent: nluResult.intent,
      executedAction,
      actionResult: actionResultData,
      shouldEndCall,
      language: session.language,
    };
  }

  /**
   * 4. Explicit Caller Identity Verification
   */
  public async verifyCaller(
    sessionId: string,
    verificationCode: string
  ): Promise<VoiceTurnResponse> {
    return this.processTurn(sessionId, {
      verificationCode,
      transcript: `My verification code is ${verificationCode}`,
    });
  }

  /**
   * 5. Initiate Server-Authorized Outbound Follow-Up Call
   * Security rule: Client only supplies followUpId; phone number is resolved server-side!
   */
  public async initiateOutboundFollowUpCall(
    followUpId: string,
    caseId?: string,
    reason?: string
  ): Promise<{ session: VoiceSession; callResult: any }> {
    // 1. Fetch Follow-up and Case
    const allCases = await this.caseRepository.listAllCases();
    let targetCase: any = null;
    let targetFollowUp: any = null;

    if (caseId) {
      targetCase = await this.caseRepository.getCaseById(caseId);
      if (targetCase) {
        const followUps = await this.caseRepository.getFollowUps(caseId);
        targetFollowUp = followUps.find((f: any) => f.id === followUpId);
      }
    } else {
      for (const c of allCases) {
        const followUps = await this.caseRepository.getFollowUps(c.id);
        const found = followUps.find((f: any) => f.id === followUpId);
        if (found) {
          targetFollowUp = found;
          targetCase = c;
          break;
        }
      }
    }

    if (!targetFollowUp || !targetCase) {
      throw new Error(`Target follow-up "${followUpId}" not found on platform caseload.`);
    }

    // 2. Resolve destination phone number from household server-side
    const household = await this.householdRepository.getHouseholdById(targetCase.householdId);
    if (!household || !household.contactPhone) {
      throw new Error(`Household contact phone number not found for household "${targetCase.householdId}".`);
    }

    const destinationPhone = household.contactPhone;

    // 3. Initiate Exotel outbound call
    const callResult = await this.exotelService.initiateOutboundCall({
      toPhoneNumber: destinationPhone,
      customField: {
        followUpId,
        caseId: targetCase.id,
        householdId: targetCase.householdId,
      },
      statusCallbackUrl: `${env.HOST}:${env.PORT}/api/v1/voice/callbacks/exotel/status`,
    });

    // 4. Create persistent voice session for outbound call
    const sessionId = `vses_out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: VoiceSession = {
      id: sessionId,
      callSid: callResult.callSid,
      direction: "OUTBOUND",
      provider: this.exotelService.isConfigured() ? "EXOTEL" : "TEST_MOCK",
      callerNumberHash: this.hashPhoneNumber(destinationPhone),
      maskedCallerNumber: this.maskPhoneNumber(destinationPhone),
      status: "ACTIVE",
      verificationStatus: "VERIFIED", // Outbound calls to registered household numbers are pre-linked
      citizenId: household.ownerUid,
      householdId: household.id,
      assignedAshaUid: targetCase.assignedAshaUid,
      language: toVoiceLanguage((targetCase as any).preferredLanguage || (household as any).preferredLanguage || "en-IN"),
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      relatedCaseId: targetCase.id,
      relatedFollowUpId: followUpId,
      outboundReason: reason || targetFollowUp.title || targetFollowUp.reason,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.createSession(session);

    // Emit domain event
    await this.automationService.emitDomainEvent("OUTBOUND_CALL_INITIATED", {
      caseId: targetCase.id,
      householdId: targetCase.householdId,
      assignedAshaUid: targetCase.assignedAshaUid,
      payload: {
        sessionId,
        callSid: callResult.callSid,
        followUpId,
        destinationMasked: this.maskPhoneNumber(destinationPhone),
      },
    });

    return { session, callResult };
  }

  /**
   * 6. Handle Exotel Status Callback
   */
  public async handleStatusCallback(
    payload: ExotelStatusCallbackPayload
  ): Promise<VoiceSession | null> {
    const callSid = payload.CallSid;
    const session = await this.sessionRepository.getSessionByCallSid(callSid);
    if (!session) return null;

    const outcome: CallOutcome = this.exotelService.mapTelephonyStatus(payload.Status);
    const duration = typeof payload.Duration === "number"
      ? payload.Duration
      : parseInt(payload.Duration || "0", 10);

    const updated = await this.sessionRepository.updateSession(session.id, {
      callOutcome: outcome,
      durationSeconds: duration,
      status: outcome === "CALL_FAILED" ? "FAILED" : "COMPLETED",
      endedAt: payload.EndTime || new Date().toISOString(),
    });

    // Telephony outcome != Business milestone completion!
    // Telephony outcome is logged as domain audit telemetry.
    await this.automationService.emitDomainEvent(
      outcome === "CALL_COMPLETED" ? "VOICE_CALL_COMPLETED" : "OUTBOUND_CALL_COMPLETED",
      {
        caseId: session.relatedCaseId || "unbound",
        householdId: session.householdId || "unknown",
        assignedAshaUid: session.assignedAshaUid || "system",
        payload: {
          sessionId: session.id,
          callSid,
          outcome,
          durationSeconds: duration,
        },
      }
    );

    return updated;
  }

  /**
   * 7. Admin Telemetry & Health
   */
  public async getHealthAndTelemetry(): Promise<VoiceHealthResponse> {
    const counts = await this.sessionRepository.countSessionsToday();
    const recent = await this.sessionRepository.listRecentSessionsForAdmin(10);

    const sarvamOk = this.sarvamService.isConfigured();
    const exotelOk = this.exotelService.isConfigured();

    let status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED" = "UNCONFIGURED";
    if (sarvamOk && exotelOk) {
      status = "OPERATIONAL";
    } else if (sarvamOk || exotelOk || env.VOICE_PROVIDER_MODE === "test" || env.VOICE_PROVIDER_MODE === "mock") {
      status = "DEGRADED";
    }

    return {
      status,
      providerMode: (env.VOICE_PROVIDER_MODE as "real" | "test") || "real",
      sarvamConfigured: sarvamOk,
      exotelConfigured: exotelOk,
      virtualNumber: this.exotelService.getVirtualNumber(),
      totalCallsToday: counts.total,
      activeSessions: counts.active,
      completedCallsToday: counts.completed,
      failedCallsToday: counts.failed,
      noAnswerCallsToday: counts.noAnswer,
      averageDurationSeconds: counts.averageDuration,
      recentSessions: recent.map((s) => ({
        id: s.id,
        callSid: s.callSid,
        direction: s.direction,
        maskedNumber: s.maskedCallerNumber,
        status: s.status,
        outcome: s.callOutcome,
        intent: s.currentIntent,
        durationSeconds: s.durationSeconds,
        startedAt: s.startedAt,
      })),
    };
  }

  /**
   * 8. Public Voice Configuration for Client Presentation
   */
  public getPublicConfig(): VoicePublicConfig {
    const helplineInfo = this.exotelService.getDisplayHelplineInfo();
    return {
      voiceEnabled: env.VOICE_ENABLED !== false,
      providerMode: (env.VOICE_PROVIDER_MODE as "real" | "test") || "real",
      virtualNumber: helplineInfo.virtualNumber,
      displayHelplineText: helplineInfo.displayHelplineText,
      isTollFree: helplineInfo.isTollFree,
      supportedLanguages: [...VOICE_LANGUAGE_OPTIONS],
      maxCallDurationSec: env.VOICE_MAX_CALL_DURATION_SEC || 300,
      sarvamConfigured: this.sarvamService.isConfigured(),
      exotelConfigured: this.exotelService.isConfigured(),
    };
  }

  /**
   * 9. Citizen Web-Initiated Outbound Call
   */
  public async requestCitizenCall(
    citizenUid: string,
    input: CitizenCallRequest
  ): Promise<{ session: VoiceSession; callResult: any }> {
    if (env.VOICE_ENABLED === false) {
      throw new Error("Voice assistance is currently unavailable.");
    }

    const citizenProfile = await this.userRepository.getUserById(citizenUid);
    const household = await this.householdRepository.getHouseholdByOwnerUid(citizenUid);

    // Resolve destination phone
    let destinationPhone: string | undefined = input.phoneNumber;
    if (!destinationPhone || destinationPhone.trim().length === 0) {
      destinationPhone = household?.contactPhone || citizenProfile?.phoneNumber || undefined;
    }

    const rawTarget = destinationPhone || "";
    const normalizedDigits = this.exotelService.normalizeIndianPhoneNumber(rawTarget);
    if (!/^[6-9]\d{9}$/.test(normalizedDigits)) {
      throw new ExotelTelephonyError(
        "Please enter a valid 10-digit Indian mobile number.",
        "VOICE_VALIDATION_ERROR",
        400
      );
    }

    const cleanPhone = `+91${normalizedDigits}`;

    const callResult = await this.exotelService.initiateOutboundCall({
      toPhoneNumber: cleanPhone,
      customField: {
        citizenUid,
        householdId: household?.id || null,
        type: "CITIZEN_REQUEST",
      },
      statusCallbackUrl: `${env.HOST}:${env.PORT}/api/v1/voice/callbacks/exotel/status`,
    });

    const sessionId = `vses_cit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: VoiceSession = {
      id: sessionId,
      callSid: callResult.callSid,
      direction: "OUTBOUND",
      provider: this.exotelService.isConfigured() ? "EXOTEL" : "TEST_MOCK",
      callerNumberHash: this.hashPhoneNumber(cleanPhone),
      maskedCallerNumber: this.maskPhoneNumber(cleanPhone),
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      citizenId: citizenUid,
      householdId: household?.id || null,
      language: toVoiceLanguage(input.language),
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      outboundReason: input.reason || "Citizen Web Assistant Request",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.createSession(session);

    await this.automationService.emitDomainEvent("OUTBOUND_CALL_INITIATED", {
      caseId: "unbound",
      householdId: household?.id || "unknown",
      assignedAshaUid: "system",
      payload: {
        sessionId,
        callSid: callResult.callSid,
        citizenUid,
        destinationMasked: this.maskPhoneNumber(cleanPhone),
      },
    });

    return { session, callResult };
  }

  /**
   * 10. ASHA Direct Beneficiary Call
   */
  public async initiateAshaCall(
    ashaUid: string,
    input: AshaCallRequest
  ): Promise<{ session: VoiceSession; callResult: any }> {
    if (env.VOICE_ENABLED === false) {
      throw new Error("Voice assistance is currently unavailable.");
    }

    const targetCase = await this.caseRepository.getCaseById(input.caseId);
    if (!targetCase) {
      throw new Error(`Target case "${input.caseId}" not found.`);
    }

    const household = await this.householdRepository.getHouseholdById(targetCase.householdId);
    if (!household || !household.contactPhone) {
      throw new Error(`Household contact phone not found for case "${input.caseId}".`);
    }

    const destinationPhone = household.contactPhone;

    const callResult = await this.exotelService.initiateOutboundCall({
      toPhoneNumber: destinationPhone,
      customField: {
        caseId: targetCase.id,
        followUpId: input.followUpId || null,
        ashaUid,
        householdId: household.id,
        type: "ASHA_ASSISTANCE_CALL",
      },
      statusCallbackUrl: `${env.HOST}:${env.PORT}/api/v1/voice/callbacks/exotel/status`,
    });

    const sessionId = `vses_asha_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: VoiceSession = {
      id: sessionId,
      callSid: callResult.callSid,
      direction: "OUTBOUND",
      provider: this.exotelService.isConfigured() ? "EXOTEL" : "TEST_MOCK",
      callerNumberHash: this.hashPhoneNumber(destinationPhone),
      maskedCallerNumber: this.maskPhoneNumber(destinationPhone),
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      citizenId: household.ownerUid,
      householdId: household.id,
      assignedAshaUid: ashaUid,
      relatedCaseId: targetCase.id,
      relatedFollowUpId: input.followUpId || null,
      language: toVoiceLanguage(input.language),
      turnCount: 0,
      maxTurns: env.VOICE_MAX_TURNS || 10,
      outboundReason: input.reason || `ASHA Outreach: ${targetCase.schemeName || "Healthcare Case"}`,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.createSession(session);

    await this.automationService.emitDomainEvent("OUTBOUND_CALL_INITIATED", {
      caseId: targetCase.id,
      householdId: household.id,
      assignedAshaUid: ashaUid,
      payload: {
        sessionId,
        callSid: callResult.callSid,
        caseId: targetCase.id,
        followUpId: input.followUpId,
        destinationMasked: this.maskPhoneNumber(destinationPhone),
      },
    });

    return { session, callResult };
  }

  /**
   * 11. Call History Queries
   */
  public async listCitizenCalls(citizenUid: string): Promise<CallHistoryItem[]> {
    const sessions = await this.sessionRepository.listSessionsByCitizenId(citizenUid);
    return sessions.map((s) => ({
      id: s.id,
      callSid: s.callSid,
      direction: s.direction,
      maskedNumber: s.maskedCallerNumber,
      status: s.status,
      outcome: s.callOutcome,
      intent: s.currentIntent,
      durationSeconds: s.durationSeconds,
      outboundReason: s.outboundReason,
      relatedCaseId: s.relatedCaseId,
      relatedFollowUpId: s.relatedFollowUpId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
  }

  public async listAshaCalls(ashaUid: string): Promise<CallHistoryItem[]> {
    const sessions = await this.sessionRepository.listSessionsByAshaUid(ashaUid);
    return sessions.map((s) => ({
      id: s.id,
      callSid: s.callSid,
      direction: s.direction,
      maskedNumber: s.maskedCallerNumber,
      status: s.status,
      outcome: s.callOutcome,
      intent: s.currentIntent,
      durationSeconds: s.durationSeconds,
      outboundReason: s.outboundReason,
      relatedCaseId: s.relatedCaseId,
      relatedFollowUpId: s.relatedFollowUpId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
  }

  public async listCaseCalls(caseId: string): Promise<CallHistoryItem[]> {
    const sessions = await this.sessionRepository.listSessionsByCaseId(caseId);
    return sessions.map((s) => ({
      id: s.id,
      callSid: s.callSid,
      direction: s.direction,
      maskedNumber: s.maskedCallerNumber,
      status: s.status,
      outcome: s.callOutcome,
      intent: s.currentIntent,
      durationSeconds: s.durationSeconds,
      outboundReason: s.outboundReason,
      relatedCaseId: s.relatedCaseId,
      relatedFollowUpId: s.relatedFollowUpId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));
  }
}
