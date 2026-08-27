import { SYSTEM_SAFETY_RULES, PROMPT_VERSION } from "./system-safety.prompt.js";
import { AIContext } from "../../../../../shared/types/ai.js";

export function buildGapPrioritizationPrompt(context: AIContext): string {
  return `
${SYSTEM_SAFETY_RULES}

PROMPT VERSION: ${PROMPT_VERSION}
TASK: Prioritize the existing detected health access gaps for this household in order of urgency (P1 = Immediate verification/e-KYC for active schemes, P2 = Missing documents, P3 = Missing information for evaluation).

LANGUAGE: ${context.language === "hi" ? "Hindi (Devanagari)" : context.language === "kn" ? "Kannada" : "English"}

[TRUSTED STRUCTURED CONTEXT]
Household Summary: ${JSON.stringify(context.householdSummary)}
Verified Eligibility Results: ${JSON.stringify(context.eligibilityResults)}
Detected Health Access Gaps: ${JSON.stringify(context.gapResults)}

[UNTRUSTED SOURCE EXCERPTS (VERIFIED EVIDENCE ONLY)]
${JSON.stringify(context.verifiedEvidence)}

REQUIRED OUTPUT JSON SCHEMA:
{
  "capability": "PRIORITIZE_GAPS",
  "contextVersion": "${context.contextVersion}",
  "language": "${context.language}",
  "certainty": "GROUNDED" | "PARTIALLY_GROUNDED" | "INSUFFICIENT_INFORMATION",
  "prioritizedGaps": [
    {
      "gapId": "string (must match existing gapId)",
      "priority": "P1" | "P2" | "P3",
      "reason": "Clear justification for why this gap has this priority level",
      "recommendedNextStep": "Specific practical next step"
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
  "disclaimer": "Priorities are based on scheme requirements to unlock benefits and prevent healthcare access delays.",
  "generatedAt": "${new Date().toISOString()}"
}
`;
}
