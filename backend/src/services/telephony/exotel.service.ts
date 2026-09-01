import { env } from "../../config/env.js";
import {
  CallOutcome,
  CANONICAL_HELPLINE_E164,
  CANONICAL_HELPLINE_DISPLAY,
  normalizeIndianPhoneNumber,
  toE164IndianPhoneNumber,
  toDisplayIndianPhoneNumber,
} from "../../../../shared/types/voice.js";

export interface ExotelCallResult {
  callSid: string;
  status: string;
  accountSid: string;
  to: string;
  from: string;
  startTime?: string;
}

export interface ExotelOutboundOptions {
  toPhoneNumber: string;
  callerId?: string;
  customField?: Record<string, unknown> | string;
  statusCallbackUrl?: string;
  flowUrl?: string;
}

export class ExotelTelephonyError extends Error {
  public code: string;
  public httpStatus: number;
  public providerCode?: number | string;

  constructor(message: string, code = "VOICE_PROVIDER_ERROR", httpStatus = 502, providerCode?: number | string) {
    super(message);
    this.name = "ExotelTelephonyError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
  }
}

export class ExotelService {
  private accountSid: string;
  private apiKey: string;
  private apiToken: string;
  private baseUrl: string;
  private callerId: string;
  private virtualNumber: string;

  constructor() {
    this.accountSid = env.EXOTEL_ACCOUNT_SID || "";
    this.apiKey = env.EXOTEL_API_KEY || "";
    this.apiToken = env.EXOTEL_API_TOKEN || "";
    this.baseUrl = env.EXOTEL_BASE_URL || "https://api.exotel.com";
    this.callerId = env.EXOTEL_CALLER_ID || env.EXOTEL_VIRTUAL_NUMBER || "";
    this.virtualNumber = env.EXOTEL_VIRTUAL_NUMBER || "";
  }

  public isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
      this.apiKey &&
      this.apiToken &&
      this.accountSid.trim().length > 0 &&
      this.apiKey.trim().length > 0 &&
      this.apiToken.trim().length > 0
    );
  }

  public getVirtualNumber(): string | null {
    return this.virtualNumber && this.virtualNumber.trim().length > 0 ? this.virtualNumber.trim() : null;
  }

  public getDisplayHelplineInfo(): {
    virtualNumber: string | null;
    displayHelplineText: string;
    isTollFree: boolean;
  } {
    const vn = this.getVirtualNumber();
    const rawNumber = vn || CANONICAL_HELPLINE_E164;
    const isTollFree = rawNumber.replace(/[^\d]/g, "").startsWith("1800");
    return {
      virtualNumber: toE164IndianPhoneNumber(rawNumber) || CANONICAL_HELPLINE_E164,
      displayHelplineText: toDisplayIndianPhoneNumber(rawNumber) || CANONICAL_HELPLINE_DISPLAY,
      isTollFree,
    };
  }

  /**
   * Normalizes Indian phone numbers into canonical 10-digit format for validation
   */
  public normalizeIndianPhoneNumber(raw: string): string {
    return normalizeIndianPhoneNumber(raw);
  }

  /**
   * Normalizes Indian phone numbers into canonical E.164 format (+91XXXXXXXXXX)
   */
  public toE164IndianPhoneNumber(raw: string): string {
    return toE164IndianPhoneNumber(raw);
  }

  /**
   * Masks phone numbers for secure privacy logs
   */
  public maskPhoneNumber(phone: string): string {
    const clean = this.normalizeIndianPhoneNumber(phone);
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 2)}*** ***${clean.slice(-2)}`;
    }
    return "+91 *** *** **";
  }

  /**
   * Initiate Outbound Telephony Call via Exotel API
   * POST /v1/Accounts/{AccountSid}/Calls/connect.json
   */
  public async initiateOutboundCall(options: ExotelOutboundOptions): Promise<ExotelCallResult> {
    const normalizedTo = this.normalizeIndianPhoneNumber(options.toPhoneNumber);
    const maskedTo = this.maskPhoneNumber(options.toPhoneNumber);

    if (!/^[6-9]\d{9}$/.test(normalizedTo)) {
      throw new ExotelTelephonyError(
        "Please enter a valid 10-digit Indian mobile number.",
        "VOICE_VALIDATION_ERROR",
        400
      );
    }

    const isMockMode =
      (process.env.NODE_ENV === "test" && !this.accountSid.startsWith("real_")) ||
      env.VOICE_PROVIDER_MODE === "test" ||
      env.VOICE_PROVIDER_MODE === "mock" ||
      !this.isConfigured() ||
      this.accountSid.startsWith("test_");

    if (isMockMode) {
      const testCallSid = `test_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        callSid: testCallSid,
        status: "in-progress",
        accountSid: this.accountSid || "test_exotel_account",
        to: options.toPhoneNumber,
        from: options.callerId || this.callerId || "080-TEST-EXOTEL",
        startTime: new Date().toISOString(),
      };
    }

    if (!this.isConfigured()) {
      throw new ExotelTelephonyError(
        "Voice calling is temporarily unavailable. Telephony provider is not configured.",
        "VOICE_CONFIGURATION_ERROR",
        503
      );
    }

    const authHeader = "Basic " + Buffer.from(`${this.apiKey}:${this.apiToken}`).toString("base64");
    const customFieldStr = typeof options.customField === "object"
      ? JSON.stringify(options.customField)
      : options.customField || "";

    const activeCallerId = options.callerId || this.callerId;
    if (!activeCallerId) {
      throw new ExotelTelephonyError(
        "Telephony Caller ID is not configured.",
        "VOICE_CONFIGURATION_ERROR",
        503
      );
    }

    const formData = new URLSearchParams();
    // Exotel connect.json API Contract:
    // From: First leg to dial (the citizen/recipient's mobile number, formatted as 0... or 10-digits)
    // CallerId: The ExoPhone virtual number displayed to callee
    // CallType: "trans" for transactional assistance
    formData.append("From", `0${normalizedTo}`);
    formData.append("CallerId", activeCallerId);
    formData.append("CallType", "trans");
    formData.append("TimeLimit", String(env.VOICE_MAX_CALL_DURATION_SEC || 300));

    if (options.flowUrl) {
      formData.append("Url", options.flowUrl);
    } else {
      formData.append("To", activeCallerId);
    }

    // Only attach status callback if it is a public HTTPS URL (avoid localhost connection errors on Exotel)
    if (options.statusCallbackUrl && options.statusCallbackUrl.startsWith("https://")) {
      formData.append("StatusCallback", options.statusCallbackUrl);
    }

    if (customFieldStr) {
      formData.append("CustomField", customFieldStr);
    }

    const url = `${this.baseUrl}/v1/Accounts/${this.accountSid}/Calls/connect.json`;

    try {
      let response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      // If provider returns 401, attempt inverted key:token once as a fallback recovery
      if (response.status === 401 && this.apiKey !== this.apiToken) {
        const altAuthHeader = "Basic " + Buffer.from(`${this.apiToken}:${this.apiKey}`).toString("base64");
        try {
          const altResponse = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: altAuthHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
          });
          if (altResponse.status !== 401) {
            response = altResponse;
          }
        } catch {
          // Fall through to normal error handling
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let exotelCode: number | string | undefined;
        let exotelMsg: string | undefined;

        try {
          const parsed = JSON.parse(errorText);
          const restException = parsed.RestException || (Array.isArray(parsed.RestException) ? parsed.RestException[0] : null);
          if (restException) {
            exotelCode = restException.Code || restException.StatusCode;
            exotelMsg = restException.Message || restException.Description;
          }
        } catch {
          // ignore JSON parse error
        }

        // Server-side structured log for diagnostics
        console.error("❌ [Exotel Telephony] Outbound call rejected by provider:", {
          status: response.status,
          code: exotelCode,
          message: exotelMsg || errorText,
          destination: maskedTo,
          timestamp: new Date().toISOString(),
        });

        // Translate to user-safe, classified error
        if (response.status === 401 || exotelCode === 34010) {
          throw new ExotelTelephonyError(
            "Telephony provider authentication failed. Please verify provider credentials or use the direct helpline.",
            "VOICE_AUTHENTICATION_ERROR",
            502,
            exotelCode
          );
        } else if (response.status === 400 || exotelCode === 34004) {
          throw new ExotelTelephonyError(
            "The provided phone number could not be dialed. Please verify your 10-digit mobile number.",
            "VOICE_VALIDATION_ERROR",
            400,
            exotelCode
          );
        } else if (response.status === 403 || exotelCode === 34003) {
          throw new ExotelTelephonyError(
            "Outbound voice calling is restricted on the current telephony account. Please call our direct helpline.",
            "VOICE_PROVIDER_ERROR",
            502,
            exotelCode
          );
        } else if (response.status === 429 || exotelCode === 34005) {
          throw new ExotelTelephonyError(
            "Voice calling capacity reached. Please try again in a few minutes.",
            "VOICE_RATE_LIMITED",
            429,
            exotelCode
          );
        }

        throw new ExotelTelephonyError(
          "We couldn't connect the call right now through the telephony provider. Please try again shortly or call our direct helpline.",
          "VOICE_PROVIDER_ERROR",
          502,
          exotelCode
        );
      }

      const data = await response.json() as { Call?: Record<string, string> };
      const call = data.Call || {};

      return {
        callSid: call.Sid || `exo_${Date.now()}`,
        status: call.Status || "in-progress",
        accountSid: call.AccountSid || this.accountSid,
        to: call.To || `+91${normalizedTo}`,
        from: call.From || activeCallerId,
        startTime: call.StartTime || new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof ExotelTelephonyError) {
        throw err;
      }
      console.error("❌ [Exotel Telephony] Network/Fetch error during outbound call:", {
        error: err.message,
        destination: maskedTo,
      });
      throw new ExotelTelephonyError(
        "Unable to reach telephony gateway. Please check server network connection.",
        "VOICE_NETWORK_ERROR",
        503
      );
    }
  }

  /**
   * Validates structure of inbound Exotel webhook
   */
  public validateWebhookPayload(payload: Record<string, unknown>): boolean {
    if (!payload) return false;
    const callSid = payload.CallSid || payload.callSid;
    const from = payload.From || payload.from || payload.CallerNumber;
    return Boolean(callSid && from);
  }

  /**
   * Build Passthru IVR response
   */
  public buildPassthruResponse(spokenMessage: string): string {
    return spokenMessage;
  }

  /**
   * Map Exotel status string to CallOutcome
   */
  public mapTelephonyStatus(statusStr: string): CallOutcome {
    const s = (statusStr || "").toLowerCase();
    if (s === "completed") return "CALL_COMPLETED";
    if (s === "no-answer" || s === "noanswer") return "CALL_NO_ANSWER";
    if (s === "busy") return "CALL_BUSY";
    if (s === "failed") return "CALL_FAILED";
    if (s === "canceled" || s === "cancelled") return "CALL_DECLINED";
    if (s === "in-progress" || s === "ringing") return "CALL_ANSWERED";
    return "CALL_COMPLETED";
  }
}
