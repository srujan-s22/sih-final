import { env } from "../../config/env.js";
import { CallOutcome } from "../../../../shared/types/voice.js";

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
    if (vn) {
      const isTollFree = vn.replace(/[^\d]/g, "").startsWith("1800");
      return {
        virtualNumber: vn,
        displayHelplineText: vn,
        isTollFree,
      };
    }
    return {
      virtualNumber: null,
      displayHelplineText: "Helpline number will be assigned upon provisioning",
      isTollFree: false,
    };
  }

  /**
   * Initiate Outbound Telephony Call via Exotel API
   * POST /v1/Accounts/{AccountSid}/Calls/connect.json
   */
  public async initiateOutboundCall(options: ExotelOutboundOptions): Promise<ExotelCallResult> {
    const isMockMode =
      process.env.NODE_ENV === "test" ||
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
      throw new Error("Exotel Telephony credentials are not configured on the server.");
    }

    const authHeader = "Basic " + Buffer.from(`${this.apiKey}:${this.apiToken}`).toString("base64");
    const customFieldStr = typeof options.customField === "object"
      ? JSON.stringify(options.customField)
      : options.customField || "";

    const formData = new URLSearchParams();
    formData.append("From", options.callerId || this.callerId);
    formData.append("To", options.toPhoneNumber);
    formData.append("CallerId", options.callerId || this.callerId);

    if (options.flowUrl) {
      formData.append("Url", options.flowUrl);
    }
    if (options.statusCallbackUrl) {
      formData.append("StatusCallback", options.statusCallbackUrl);
    }
    if (customFieldStr) {
      formData.append("CustomField", customFieldStr);
    }

    const url = `${this.baseUrl}/v1/Accounts/${this.accountSid}/Calls/connect.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Exotel outbound call failed with HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { Call?: Record<string, string> };
    const call = data.Call || {};

    return {
      callSid: call.Sid || `exo_${Date.now()}`,
      status: call.Status || "in-progress",
      accountSid: call.AccountSid || this.accountSid,
      to: call.To || options.toPhoneNumber,
      from: call.From || this.callerId,
      startTime: call.StartTime || new Date().toISOString(),
    };
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
    // Exotel Passthru applet format
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
