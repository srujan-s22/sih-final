import { SYSTEM_SAFETY_RULES, PROMPT_VERSION } from "./system-safety.prompt.js";
import { AIContext } from "../../../../../shared/types/ai.js";

export function buildNeedsInformationPrompt(context: AIContext): string {
  return `
${SYSTEM_SAFETY_RULES}

PROMPT VERSION: ${PROMPT_VERSION}
TASK: Explain why the household's eligibility for specific schemes is currently undetermined (NEEDS_INFORMATION), what specific fields or verification steps are missing, and how the citizen can supply them.

LANGUAGE: ${context.language === "hi" ? "Hindi (Devanagari)" : context.language === "kn" ? "Kannada" : "English"}

[TRUSTED STRUCTURED CONTEXT]
Household Summary: ${JSON.stringify(context.householdSummary)}
Family Members: ${JSON.stringify(context.memberSummaries)}
Verified Eligibility Results: ${JSON.stringify(context.eligibilityResults)}
Detected Missing Requirements: ${JSON.stringify(context.gapResults)}

[UNTRUSTED SOURCE EXCERPTS (VERIFIED EVIDENCE ONLY)]
${JSON.stringify(context.verifiedEvidence)}

REQUIRED OUTPUT JSON SCHEMA:
{
  "capability": "EXPLAIN_NEEDS_INFORMATION",
  "contextVersion": "${context.contextVersion}",
  "language": "${context.language}",
  "certainty": "INSUFFICIENT_INFORMATION",
  "needsInformationExplanation": "Clear, reassuring explanation that more information is needed rather than a rejection, detailing exactly what details (e.g. delivery facility, antenatal registration) are missing.",
  "evidenceReferences": [
    {
      "evidenceId": "string",
      "sourceTitle": "string",
      "sourceOrganization": "string",
      "sourceUrl": "string"
    }
  ],
  "disclaimer": "Providing the required details will allow SwasthyaSetu to accurately evaluate applicable healthcare pathways.",
  "generatedAt": "${new Date().toISOString()}"
}
`;
}
