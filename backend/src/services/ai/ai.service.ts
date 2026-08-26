/**
 * AI Orchestration Service Boundary Interface (Phase 5 Foundation - Lyzr & Gemini)
 */
export interface IAiService {
  explainGap(gapTitle: string, context: Record<string, unknown>): Promise<string>;
}

export class AiService implements IAiService {
  async explainGap(_gapTitle: string, _context: Record<string, unknown>): Promise<string> {
    // Stub for Phase 5 AI layer
    return "";
  }
}
