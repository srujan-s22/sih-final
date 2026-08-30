import { AutomationDomainEvent, DomainEventType } from "../../../../shared/types/case.js";

/**
 * Automation Service (Phase 10 — n8n Automation & Domain Event Dispatcher)
 *
 * SwasthyaSetu remains the authoritative source of truth.
 * n8n is an OPTIONAL, non-blocking automation layer.
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
}

export class AutomationService implements IAutomationService {
  private webhookUrl: string | null = null;

  constructor(webhookUrl: string | null = process.env.N8N_WEBHOOK_URL || null) {
    this.webhookUrl = webhookUrl && webhookUrl.trim() ? webhookUrl.trim() : null;
  }

  public setWebhookUrl(url: string | null): void {
    this.webhookUrl = url && url.trim() ? url.trim() : null;
  }

  public getWebhookUrl(): string | null {
    return this.webhookUrl;
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

    if (!this.webhookUrl) {
      return {
        success: true,
        dispatched: false,
        eventId,
        reason: "N8N_UNCONFIGURED",
      };
    }

    // Dispatch webhook asynchronously with a 3-second timeout
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SwasthyaSetu-Event": eventType,
          "X-SwasthyaSetu-Event-ID": eventId,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        return {
          success: true,
          dispatched: true,
          eventId,
        };
      } else {
        return {
          success: true,
          dispatched: false,
          eventId,
          reason: `HTTP_${response.status}`,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      return {
        success: true,
        dispatched: false,
        eventId,
        reason: errMsg,
      };
    }
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
