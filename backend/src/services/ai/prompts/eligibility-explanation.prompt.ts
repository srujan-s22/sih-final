import { SYSTEM_SAFETY_RULES, PROMPT_VERSION } from "./system-safety.prompt.js";
import { AIContext } from "../../../../../shared/types/ai.js";

export function buildEligibilityExplanationPrompt(context: AIContext): string {
  return `
${SYSTEM_SAFETY_RULES}

PROMPT VERSION: ${PROMPT_VERSION}
TASK: Generate a clear, citizen-friendly eligibility explanation for the provided household context.

LANGUAGE: ${context.language === "hi" ? "Hindi (Devanagari)" : context.language === "kn" ? "Kannada" : "English"}

[TRUSTED STRUCTURED CONTEXT]
Household Summary: ${JSON.stringify(context.householdSummary)}
Family Members: ${JSON.stringify(context.memberSummaries)}
Verified Eligibility Results: ${JSON.stringify(context.eligibilityResults)}
Verified Schemes: ${JSON.stringify(context.schemeSummaries)}

[UNTRUSTED SOURCE EXCERPTS (VERIFIED EVIDENCE ONLY)]
${JSON.stringify(context.verifiedEvidence)}

REQUIRED OUTPUT JSON SCHEMA:
{
  "capability": "EXPLAIN_ELIGIBILITY",
  "contextVersion": "${context.contextVersion}",
  "language": "${context.language}",
  "certainty": "GROUNDED" | "PARTIALLY_GROUNDED" | "INSUFFICIENT_INFORMATION",
  "explanation": "Clear explanation of which schemes apply/do not apply and why, based strictly on the verified results.",
  "evidenceReferences": [
    {
      "evidenceId": "string",
      "sourceTitle": "string",
      "sourceOrganization": "string",
      "sourceUrl": "string"
    }
  ],
  "disclaimer": "This explanation is generated based on official government criteria. Official enrollment and verification are required to receive benefits.",
  "generatedAt": "${new Date().toISOString()}"
}
`;
}
