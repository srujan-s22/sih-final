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
  | "HELP"
  | "ABOUT_SWASTHYASETU"
  | "CHECK_SCHEMES"
  | "SCHEME_INFORMATION"
  | "SPECIFIC_SCHEME_INFORMATION"
  | "CHECK_ELIGIBILITY"
  | "HOW_TO_USE_WEBSITE"
  | "CITIZEN_PORTAL_INFO"
  | "ASHA_PORTAL_INFO"
  | "ADMIN_PORTAL_INFO"
  | "HOUSEHOLD_INFORMATION"
  | "FAMILY_INFORMATION"
  | "DOCUMENT_HELP"
  | "NEXT_STEPS"
  | "ASHA_HELP"
  | "ASHA_CONNECTION"
  | "REQUEST_ASSISTANCE"
  | "CHECK_ASSISTANCE_STATUS"
  | "CHECK_FOLLOW_UP"
  | "CONTACT_ASHA"
  | "VERIFY_IDENTITY"
  | "GENERAL_SCHEME_INFO"
  | "VOICE_ASSISTANT_HELP"
  | "END_CALL"
  | "EMERGENCY"
  | "UNKNOWN";

export interface ExtractedVoiceEntities {
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  pregnancyStatus?: boolean;
  nursingStatus?: boolean;
  disabilityStatus?: boolean;
  householdCategory?: "BPL" | "AAY" | "APL" | "OTHER";
  schemeId?: string;
  serviceCode?: string;
  verificationCode?: string;
  topic?: string;
}

export type VoiceActionName =
  | "handleEmergencyRedirection"
  | "getPublicSchemeInfo"
  | "verifyCallerIdentity"
  | "getEligibleSchemes"
  | "getEligibilityForMember"
  | "getAssistanceStatus"
  | "getFollowUpStatus"
  | "getConnectedAsha"
  | "requestAssistance"
  | "getGroundedKnowledge"
  | "endCall";

export type SupportedVoiceLanguage = "en-IN" | "kn-IN" | "hi-IN";

export const SUPPORTED_VOICE_LANGUAGES: readonly SupportedVoiceLanguage[] = [
  "en-IN",
  "kn-IN",
  "hi-IN",
] as const;

/**
 * Authoritative supported voice languages for UI presentation and validation
 */
export const VOICE_LANGUAGE_OPTIONS = [
  { code: "en-IN" as const, name: "English", nativeName: "English" },
  { code: "kn-IN" as const, name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "hi-IN" as const, name: "Hindi", nativeName: "हिन्दी" },
] as const;

/**
 * Canonical SwasthyaSetu automated helpline phone numbers
 */
export const CANONICAL_HELPLINE_E164 = "+918047283240";
export const CANONICAL_HELPLINE_DISPLAY = "08047283240";

/**
 * Normalizes Indian phone numbers into canonical 10-digit format (e.g. 8047283240 or 9876543210)
 */
export function normalizeIndianPhoneNumber(raw?: string | null): string {
  if (!raw) return "";
  let clean = raw.trim().replace(/[^\d]/g, "");
  if (clean.length === 12 && clean.startsWith("91")) {
    clean = clean.slice(2);
  } else if (clean.length === 11 && clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  return clean;
}

/**
 * Normalizes Indian phone numbers into canonical E.164 format (+91XXXXXXXXXX)
 * Examples:
 *   "08047283240"    -> "+918047283240"
 *   "8047283240"     -> "+918047283240"
 *   "+918047283240"  -> "+918047283240"
 *   "+91 8047283240" -> "+918047283240"
 */
export function toE164IndianPhoneNumber(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+91")) {
    return `+${trimmed.replace(/[^\d]/g, "")}`;
  }
  const clean10 = normalizeIndianPhoneNumber(raw);
  if (clean10.length === 10) {
    return `+91${clean10}`;
  }
  if (clean10.length > 0) {
    return `+91${clean10}`;
  }
  return "";
}

/**
 * Formats Indian phone numbers for local display (e.g. 08047283240)
 */
export function toDisplayIndianPhoneNumber(raw?: string | null): string {
  if (!raw) return "";
  const clean10 = normalizeIndianPhoneNumber(raw);
  if (clean10.length === 10) {
    return `0${clean10}`;
  }
  return raw.trim();
}

/**
 * Maps arbitrary UI locales or telephony language codes into authoritative SupportedVoiceLanguage
 * Defaults safely to "en-IN" if unspecified or unsupported.
 */
export function toVoiceLanguage(lang?: string | null): SupportedVoiceLanguage {
  if (!lang) return "en-IN";
  const clean = lang.trim().toLowerCase().replace(/_/g, "-");
  if (clean === "kn" || clean === "kn-in" || clean === "kannada") return "kn-IN";
  if (clean === "hi" || clean === "hi-in" || clean === "hindi") return "hi-IN";
  if (clean === "en" || clean === "en-in" || clean === "english") return "en-IN";
  return "en-IN";
}

/**
 * Maps a telephony voice language back to website UI locale ("en" | "kn" | "hi")
 */
export function toUiLanguage(voiceLang?: string | null): "en" | "kn" | "hi" {
  if (!voiceLang) return "en";
  const clean = voiceLang.trim().toLowerCase();
  if (clean.startsWith("kn")) return "kn";
  if (clean.startsWith("hi")) return "hi";
  return "en";
}

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
  conversationContext?: Record<string, any>;
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
 * Citizen Request for Inbound/Assistant Call
 */
export interface CitizenCallRequest {
  phoneNumber?: string;                     // Optional: confirmation of phone number (E.164)
  language?: SupportedVoiceLanguage | string;
  reason?: string;                          // e.g. "Healthcare Assistant Call"
}

/**
 * ASHA Direct Call Citizen Request
 */
export interface AshaCallRequest {
  caseId: string;
  followUpId?: string;
  reason?: string;
  language?: SupportedVoiceLanguage | string;
}

/**
 * Public Configuration for Client Presentation
 */
export interface VoicePublicConfig {
  voiceEnabled: boolean;
  providerMode: "real" | "test";
  virtualNumber: string | null;             // Real configured number or null
  displayHelplineText: string;              // Clean formatted text
  isTollFree: boolean;                      // true only if proven toll-free (e.g. 1800)
  supportedLanguages: Array<{
    code: SupportedVoiceLanguage;
    name: string;
    nativeName: string;
  }>;
  maxCallDurationSec: number;
  sarvamConfigured: boolean;
  exotelConfigured: boolean;
}

/**
 * Item in Call History list
 */
export interface CallHistoryItem {
  id: string;
  callSid: string;
  direction: CallDirection;
  maskedNumber: string;
  status: VoiceSessionStatus;
  outcome?: CallOutcome;
  intent?: VoiceIntentType;
  durationSeconds?: number;
  outboundReason?: string | null;
  relatedCaseId?: string | null;
  relatedFollowUpId?: string | null;
  startedAt: string;
  endedAt?: string | null;
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

/**
 * Exotel WebSocket Stream Inbound & Outbound Event Types
 */
export type ExotelStreamEventType =
  | "connected"
  | "start"
  | "media"
  | "stop"
  | "mark"
  | "clear";

export interface ExotelStreamMediaFormat {
  encoding: string; // e.g. "audio/x-mulaw" or "audio/x-l16"
  sampleRate: number; // e.g. 8000
  channels: number; // e.g. 1
}

export interface ExotelStreamStartData {
  streamSid: string;
  accountSid?: string;
  callSid: string;
  tracks?: string[];
  mediaFormat?: ExotelStreamMediaFormat;
  customParameters?: Record<string, string>;
}

export interface ExotelStreamConnectedEvent {
  event: "connected";
  protocol?: string;
  version?: string;
}

export interface ExotelStreamStartEvent {
  event: "start";
  sequenceNumber?: string;
  streamSid?: string;
  start: ExotelStreamStartData;
}

export interface ExotelStreamMediaData {
  track?: string;
  chunk?: string;
  timestamp?: string;
  payload: string; // Base64 audio chunk
}

export interface ExotelStreamMediaEvent {
  event: "media";
  sequenceNumber?: string;
  streamSid?: string;
  media: ExotelStreamMediaData;
}

export interface ExotelStreamStopEvent {
  event: "stop";
  sequenceNumber?: string;
  streamSid?: string;
  stop?: {
    accountSid?: string;
    callSid?: string;
  };
}

export interface ExotelStreamMarkEvent {
  event: "mark";
  sequenceNumber?: string;
  streamSid?: string;
  mark?: {
    name?: string;
  };
}

export type ExotelStreamInboundMessage =
  | ExotelStreamConnectedEvent
  | ExotelStreamStartEvent
  | ExotelStreamMediaEvent
  | ExotelStreamStopEvent
  | ExotelStreamMarkEvent;

export interface ExotelStreamOutboundMediaMessage {
  event: "media";
  streamSid: string;
  media: {
    payload: string; // Base64 audio frame
  };
}

export interface ExotelStreamOutboundMarkMessage {
  event: "mark";
  streamSid: string;
  mark: {
    name: string;
  };
}

export interface ExotelStreamOutboundClearMessage {
  event: "clear";
  streamSid: string;
}

export type ExotelStreamOutboundMessage =
  | ExotelStreamOutboundMediaMessage
  | ExotelStreamOutboundMarkMessage
  | ExotelStreamOutboundClearMessage;

