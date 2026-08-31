/**
 * Voice & Telephony Types for SwasthyaSetu (Phase 11)
 * Sarvam AI + Exotel Voice / Call Assist
 */

export type VoiceSessionStatus =
  | "INITIATED"
  | "IDENTIFYING"
  | "VERIFYING"
  | "ACTIVE"
  | "PROCESSING"
  | "RESPONDING"
  | "COMPLETED"
  | "FAILED"
  | "ENDED";

export type CallDirection = "INBOUND" | "OUTBOUND";

export type CallerVerificationStatus = "UNVERIFIED" | "VERIFIED" | "FAILED";

export type CallOutcome =
  | "CALL_ANSWERED"
  | "CALL_NO_ANSWER"
  | "CALL_BUSY"
  | "CALL_FAILED"
  | "CALL_DECLINED"
  | "CALL_COMPLETED";

export type VoiceIntentType =
  | "GREETING"
  | "CHECK_SCHEMES"
  | "CHECK_ELIGIBILITY"
  | "REQUEST_ASSISTANCE"
  | "CHECK_ASSISTANCE_STATUS"
  | "CHECK_FOLLOW_UP"
  | "CONTACT_ASHA"
  | "VERIFY_IDENTITY"
  | "GENERAL_SCHEME_INFO"
  | "END_CALL"
  | "UNKNOWN";

export type VoiceActionName =
  | "getPublicSchemeInfo"
  | "verifyCallerIdentity"
  | "getEligibleSchemes"
  | "getEligibilityForMember"
  | "getAssistanceStatus"
  | "getFollowUpStatus"
  | "getConnectedAsha"
  | "requestAssistance"
  | "endCall";

export type SupportedVoiceLanguage =
  | "hi-IN"
  | "en-IN"
  | "kn-IN"
  | "ta-IN"
  | "te-IN"
  | "bn-IN"
  | "gu-IN"
  | "mr-IN"
  | "ml-IN"
  | "pa-IN"
  | "or-IN";

/**
 * Authoritative Voice Session Entity stored in Firestore (/voice_sessions/{sessionId})
 */
export interface VoiceSession {
  id: string;                               // Unique session ID: vses_<timestamp>_<rand>
  callSid: string;                          // Exotel Call SID
  direction: CallDirection;                 // Inbound citizen call or outbound reminder
  provider: "EXOTEL" | "TEST_MOCK";
  callerNumberHash: string;                 // SHA-256 hash of phone number (for lookup/privacy)
  maskedCallerNumber: string;               // Masked for display, e.g. "+91 98*** **210"
  rawPhoneNumber?: string;                  // Only in secure server-side context if necessary
  status: VoiceSessionStatus;
  verificationStatus: CallerVerificationStatus;
  citizenId?: string | null;                // Bound citizen user ID if verified
  householdId?: string | null;              // Bound household ID if verified
  assignedAshaUid?: string | null;          // Linked ASHA worker UID
  language: SupportedVoiceLanguage | string;
  currentIntent?: VoiceIntentType;
  turnCount: number;                        // Enforced turn limit for cost controls
  maxTurns: number;
  callOutcome?: CallOutcome;
  durationSeconds?: number;
  relatedCaseId?: string | null;            // Linked case for outbound calls
  relatedFollowUpId?: string | null;        // Linked follow-up for outbound reminder calls
  outboundReason?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversational Turn Request (Input from Citizen via voice/text)
 */
export interface VoiceTurnRequest {
  transcript?: string;                      // Recognized text (or typed input)
  audioBase64?: string;                     // Raw audio payload for STT
  audioFormat?: string;                     // e.g. "wav", "mp3", "m4a"
  languageCode?: string;
  verificationCode?: string;                // Ration card digits or PIN if verifying
}

/**
 * Conversational Turn Response (Output to Citizen)
 */
export interface VoiceTurnResponse {
  sessionId: string;
  status: VoiceSessionStatus;
  verificationStatus: CallerVerificationStatus;
  textResponse: string;                     // Plain text spoken output
  audioBase64?: string | null;              // Synthesized TTS audio if requested
  detectedIntent: VoiceIntentType;
  executedAction?: VoiceActionName;
  actionResult?: Record<string, unknown>;
  shouldEndCall: boolean;
  language: string;
}

/**
 * Exotel Inbound Webhook Payload
 */
export interface ExotelInboundWebhookPayload {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  CallerNumber?: string;
  Digits?: string;
  RecordingUrl?: string;
  CustomField?: string;
}

/**
 * Exotel Status Callback Payload
 */
export interface ExotelStatusCallbackPayload {
  CallSid: string;
  Status: "completed" | "busy" | "no-answer" | "failed" | "canceled" | string;
  Duration?: string | number;
  RecordingUrl?: string;
  StartTime?: string;
  EndTime?: string;
  CustomField?: string;
}

/**
 * Outbound Call Request Payload (Authorized ASHA / Admin or n8n internal dispatch)
 */
export interface OutboundCallRequest {
  followUpId: string;                       // Required: target follow-up reference
  caseId?: string;                          // Optional: related case reference
  reason?: string;                          // Telephony dispatch reason
}

/**
 * Voice Telemetry & Health Response for Admin Dashboard
 */
export interface VoiceHealthResponse {
  status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED";
  providerMode: "real" | "test";
  sarvamConfigured: boolean;
  exotelConfigured: boolean;
  virtualNumber?: string | null;
  totalCallsToday: number;
  activeSessions: number;
  completedCallsToday: number;
  failedCallsToday: number;
  noAnswerCallsToday: number;
  averageDurationSeconds: number;
  recentSessions: Array<{
    id: string;
    callSid: string;
    direction: CallDirection;
    maskedNumber: string;
    status: VoiceSessionStatus;
    outcome?: CallOutcome;
    intent?: VoiceIntentType;
    durationSeconds?: number;
    startedAt: string;
  }>;
}
