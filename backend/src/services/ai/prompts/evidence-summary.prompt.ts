import { SYSTEM_SAFETY_RULES, PROMPT_VERSION } from "./system-safety.prompt.js";
import { AIContext } from "../../../../../shared/types/ai.js";

export function buildEvidenceSummaryPrompt(context: AIContext): string {
  return `
${SYSTEM_SAFETY_RULES}

PROMPT VERSION: ${PROMPT_VERSION}
TASK: Summarize the official verified government evidence records for the specified healthcare scheme in clear, accessible terms for citizens.

LANGUAGE: ${context.language === "hi" ? "Hindi (Devanagari)" : context.language === "kn" ? "Kannada" : "English"}

[TRUSTED STRUCTURED CONTEXT]
Verified Schemes: ${JSON.stringify(context.schemeSummaries)}

[UNTRUSTED SOURCE EXCERPTS (VERIFIED EVIDENCE ONLY)]
${JSON.stringify(context.verifiedEvidence)}

REQUIRED OUTPUT JSON SCHEMA:
{
  "capability": "SUMMARIZE_EVIDENCE",
  "contextVersion": "${context.contextVersion}",
  "language": "${context.language}",
  "certainty": "GROUNDED" | "PARTIALLY_GROUNDED" | "INSUFFICIENT_INFORMATION",
  "explanation": "Summary of official government notifications, gazettes, and operational guidelines.",
  "evidenceReferences": [
    {
      "evidenceId": "string",
      "sourceTitle": "string",
      "sourceOrganization": "string",
      "sourceUrl": "string"
    }
  ],
  "disclaimer": "Summaries are derived exclusively from verified official government notices and portal documentation.",
  "generatedAt": "${new Date().toISOString()}"
}
`;
}
