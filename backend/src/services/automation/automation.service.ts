/**
 * Automation Service Boundary Interface (Phase 7 Foundation - n8n Workflows)
 */
export interface IAutomationService {
  triggerFollowUpWorkflow(actionId: string, payload: Record<string, unknown>): Promise<boolean>;
}

export class AutomationService implements IAutomationService {
  async triggerFollowUpWorkflow(_actionId: string, _payload: Record<string, unknown>): Promise<boolean> {
    // Stub for Phase 7 n8n integration
    return false;
  }
}
