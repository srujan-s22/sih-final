import crypto from "crypto";
import { AutomationDomainEvent, DomainEventType } from "../../../../shared/types/case.js";

/**
 * Automation Service (Phase 10 — n8n Automation & Domain Event Dispatcher)
 *
 * SwasthyaSetu remains the authoritative source of truth.
 * n8n is an OPTIONAL, non-blocking automation orchestrator.
 * If N8N_WEBHOOK_URL is unset, unreachable, or fails, the core system continues normally.
 */
export interface IAutomationService {
  emitDomainEvent(
    eventType: DomainEventType,
    data: {
      caseId: string;
      householdId: string;
      assignedAshaUid: string;
      schemeId?: string | null;
      beneficiaryMemberId?: string | null;
      beneficiaryName?: string | null;
      payload?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; dispatched: boolean; eventId: string; reason?: string }>;

  isEventProcessed(eventId: string): boolean;
  recordProcessedEvent(eventId: string): void;
  verifyInboundWebhook(providedSecret?: string, signature?: string, payloadBody?: string): boolean;
  getRecentEvents(): AutomationDomainEvent[];
  getHealthStatus(): {
    webhookConfigured: boolean;
    webhookUrl: string | null;
    status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED";
    recentEvents: AutomationDomainEvent[];
  };
}

export class AutomationService implements IAutomationService {
  private webhookUrl: string | null = null;
  private webhookSecret: string | null = null;
  private recentEventsList: AutomationDomainEvent[] = [];
  private processedEventIds = new Map<string, number>(); // eventId -> timestamp
  private consecutiveFailures = 0;

  constructor(
    webhookUrl: string | null = process.env.N8N_WEBHOOK_URL || null,
    webhookSecret: string | null = process.env.N8N_WEBHOOK_SECRET || null
  ) {
    this.webhookUrl = webhookUrl && webhookUrl.trim() ? webhookUrl.trim() : null;
    this.webhookSecret = webhookSecret && webhookSecret.trim() ? webhookSecret.trim() : null;
  }

  public setWebhookUrl(url: string | null): void {
    this.webhookUrl = url && url.trim() ? url.trim() : null;
  }

  public getWebhookUrl(): string | null {
    return this.webhookUrl;
  }

  public setWebhookSecret(secret: string | null): void {
    this.webhookSecret = secret && secret.trim() ? secret.trim() : null;
  }

  public getWebhookSecret(): string | null {
    return this.webhookSecret;
  }

  /**
   * Checks if an event ID has already been processed to ensure idempotency
   */
  public isEventProcessed(eventId: string): boolean {
    if (!eventId) return false;
    return this.processedEventIds.has(eventId);
  }

  /**
   * Records an event ID as processed
   */
  public recordProcessedEvent(eventId: string): void {
    if (!eventId) return;
    this.processedEventIds.set(eventId, Date.now());

    // Clean up event IDs older than 24 hours (86,400,000 ms) if map exceeds 5000 items
    if (this.processedEventIds.size > 5000) {
      const oneDayAgo = Date.now() - 86400000;
      for (const [id, ts] of this.processedEventIds.entries()) {
        if (ts < oneDayAgo) {
          this.processedEventIds.delete(id);
        }
      }
    }
  }

  /**
   * Verifies authenticity of inbound webhooks from n8n via secret header or HMAC-SHA256 signature
   */
  public verifyInboundWebhook(
    providedSecret?: string,
    signature?: string,
    payloadBody?: string
  ): boolean {
    // If no secret configured in environment, allow authenticated server calls
    if (!this.webhookSecret) {
      return true;
    }

    // Direct secret match
    if (providedSecret && providedSecret === this.webhookSecret) {
      return true;
    }

    // HMAC signature match if provided
    if (signature && payloadBody && this.webhookSecret) {
      try {
        const expectedSignature = crypto
          .createHmac("sha256", this.webhookSecret)
          .update(payloadBody)
          .digest("hex");
        return crypto.timingSafeEqual(
          Buffer.from(signature, "utf-8"),
          Buffer.from(expectedSignature, "utf-8")
        );
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Dispatches a domain event asynchronously to the n8n webhook if configured.
   * Never throws or blocks core domain logic.
   */
  public async emitDomainEvent(
    eventType: DomainEventType,
    data: {
      caseId: string;
      householdId: string;
      assignedAshaUid: string;
      schemeId?: string | null;
      beneficiaryMemberId?: string | null;
      beneficiaryName?: string | null;
      payload?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; dispatched: boolean; eventId: string; reason?: string }> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // Sanitize payload to guarantee no private tokens/credentials leak
    const sanitizedPayload = this.sanitizePayload(data.payload || {});

    const event: AutomationDomainEvent = {
      eventId,
      eventType,
      timestamp,
      caseId: data.caseId,
      householdId: data.householdId,
      assignedAshaUid: data.assignedAshaUid,
      schemeId: data.schemeId || null,
      beneficiaryMemberId: data.beneficiaryMemberId || null,
      beneficiaryName: data.beneficiaryName || null,
      payload: sanitizedPayload,
    };

    // Store in recent events buffer (max 50 events)
    this.recentEventsList.unshift(event);
    if (this.recentEventsList.length > 50) {
      this.recentEventsList.pop();
    }

    if (!this.webhookUrl) {
      return {
        success: true,
        dispatched: false,
        eventId,
        reason: "N8N_UNCONFIGURED",
      };
    }

    const payloadString = JSON.stringify(event);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-SwasthyaSetu-Event": eventType,
      "X-SwasthyaSetu-Event-ID": eventId,
    };

    if (this.webhookSecret) {
      headers["X-SwasthyaSetu-Secret"] = this.webhookSecret;
      const signature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payloadString)
        .digest("hex");
      headers["X-SwasthyaSetu-Signature"] = signature;
    }

    // Dispatch webhook asynchronously with a 3-second timeout
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        this.consecutiveFailures = 0;
        return {
          success: true,
          dispatched: true,
          eventId,
        };
      } else {
        this.consecutiveFailures++;
        return {
          success: true,
          dispatched: false,
          eventId,
          reason: `HTTP_${response.status}`,
        };
      }
    } catch (err: unknown) {
      this.consecutiveFailures++;
      const errMsg = err instanceof Error ? err.message : "Network error";
      return {
        success: true,
        dispatched: false,
        eventId,
        reason: errMsg,
      };
    }
  }

  public getRecentEvents(): AutomationDomainEvent[] {
    return [...this.recentEventsList];
  }

  public getHealthStatus(): {
    webhookConfigured: boolean;
    webhookUrl: string | null;
    status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED";
    recentEvents: AutomationDomainEvent[];
  } {
    let status: "OPERATIONAL" | "UNCONFIGURED" | "DEGRADED" = "OPERATIONAL";
    if (!this.webhookUrl) {
      status = "UNCONFIGURED";
    } else if (this.consecutiveFailures > 2) {
      status = "DEGRADED";
    }

    return {
      webhookConfigured: Boolean(this.webhookUrl),
      webhookUrl: this.webhookUrl,
      status,
      recentEvents: this.getRecentEvents(),
    };
  }

  /**
   * Sanitizes payload removing any sensitive keys (e.g. password, token, secret, auth)
   */
  private sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeyPatterns = [/pass/i, /token/i, /secret/i, /credential/i, /auth/i, /key/i];

    for (const [k, v] of Object.entries(payload)) {
      const isSensitive = sensitiveKeyPatterns.some((pattern) => pattern.test(k));
      if (isSensitive) {
        sanitized[k] = "[REDACTED]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        sanitized[k] = this.sanitizePayload(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }
}
