import { SYSTEM_SAFETY_RULES, PROMPT_VERSION } from "./system-safety.prompt.js";
import { AIContext } from "../../../../../shared/types/ai.js";

export function buildActionPlanPrompt(context: AIContext): string {
  return `
${SYSTEM_SAFETY_RULES}

PROMPT VERSION: ${PROMPT_VERSION}
TASK: Generate an ordered, mobile-first personalized action plan for the household based strictly on verified eligibility, detected gaps, and verified scheme procedures.

LANGUAGE: ${context.language === "hi" ? "Hindi (Devanagari)" : context.language === "kn" ? "Kannada" : "English"}

[TRUSTED STRUCTURED CONTEXT]
Household Summary: ${JSON.stringify(context.householdSummary)}
Family Members: ${JSON.stringify(context.memberSummaries)}
Verified Eligibility Results: ${JSON.stringify(context.eligibilityResults)}
Detected Gaps: ${JSON.stringify(context.gapResults)}
Existing Action Plan Steps: ${JSON.stringify(context.existingActions)}

[UNTRUSTED SOURCE EXCERPTS (VERIFIED EVIDENCE ONLY)]
${JSON.stringify(context.verifiedEvidence)}

REQUIRED OUTPUT JSON SCHEMA:
{
  "capability": "GENERATE_ACTION_PLAN",
  "contextVersion": "${context.contextVersion}",
  "language": "${context.language}",
  "certainty": "GROUNDED" | "PARTIALLY_GROUNDED" | "INSUFFICIENT_INFORMATION",
  "actionPlan": [
    {
      "stepNumber": 1,
      "title": "Short title",
      "description": "Clear mobile-friendly action description",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "actionType": "EKYC_VERIFICATION" | "DOCUMENT_COLLECTION" | "FACILITY_VISIT" | "ASHA_CONTACT" | "INFO_UPDATE",
      "sourceEvidenceReference": "Optional source citation"
    }
  ],
  "evidenceReferences": [
    {
      "evidenceId": "string",
      "sourceTitle": "string",
      "sourceOrganization": "string",
      "sourceUrl": "string"
    }
  ],
  "disclaimer": "Action steps are structured in accordance with official government enrollment pathways.",
  "generatedAt": "${new Date().toISOString()}"
}
`;
}
