import { UserRole } from "./auth.js";

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  timestamp?: string;
}

export interface AssistantCitedEvidence {
  id: string;
  schemeId: string;
  officialTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
  relevantExcerpt?: string;
}

export interface AssistantGroundingSummary {
  evaluatedSchemesCount: number;
  eligibleSchemesCount: number;
  detectedGapsCount: number;
  citedEvidence: AssistantCitedEvidence[];
  targetSchemeName?: string;
}

export interface AssistantChatRequest {
  message: string;
  conversationHistory?: AssistantMessage[];
  language?: "en" | "hi" | "kn";
  schemeId?: string | null;
  conversationId?: string | null;
}

export interface AssistantChatResponse {
  reply: string;
  conversationId: string;
  groundingData: AssistantGroundingSummary;
  suggestedActions: string[];
  disclaimer: string;
  timestamp: string;
  certainty?: "VERIFIED" | "INDICATIVE" | "INSUFFICIENT_INFORMATION";
}

export interface AssistantStatusResponse {
  isConfigured: boolean;
  model: string;
  supportedLanguages: Array<"en" | "hi" | "kn">;
  role: UserRole;
}
