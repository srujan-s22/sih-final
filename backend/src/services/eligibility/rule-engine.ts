import {
  RuleDefinition,
  RuleSet,
  RuleOperator,
  RuleEvaluationDetail,
  MissingRequirementDetail,
  EligibilityResult,
  Scheme,
  SchemeVersion,
  EligibilityStatus,
} from "../../../../shared/types/eligibility.js";
import { Household, Member } from "../../../../shared/types/household.js";

/**
 * Evaluates scalar or array comparisons deterministically
 */
export function evaluateScalarComparison(
  actual: unknown,
  operator: RuleOperator,
  expected: unknown
): boolean {
  if (actual === undefined || actual === null) {
    return false;
  }

  const normActualStr = String(actual).trim().toLowerCase();

  switch (operator) {
    case "FIELD_EQUALS":
    case "MEMBER_FIELD_EQUALS": {
      if (typeof actual === "boolean" && typeof expected === "boolean") {
        return actual === expected;
      }
      if (typeof actual === "number" && typeof expected === "number") {
        return actual === expected;
      }
      return normActualStr === String(expected).trim().toLowerCase();
    }

    case "FIELD_NOT_EQUALS": {
      return !evaluateScalarComparison(actual, "FIELD_EQUALS", expected);
    }

    case "FIELD_IN":
    case "MEMBER_FIELD_IN": {
      if (!Array.isArray(expected)) {
        return false;
      }
      const normExpectedList = expected.map((item) => String(item).trim().toLowerCase());
      return normExpectedList.includes(normActualStr);
    }

    case "FIELD_NOT_IN": {
      return !evaluateScalarComparison(actual, "FIELD_IN", expected);
    }

    case "NUMBER_GREATER_THAN": {
      const numActual = Number(actual);
      const numExpected = Number(expected);
      if (isNaN(numActual) || isNaN(numExpected)) return false;
      return numActual > numExpected;
    }

    case "NUMBER_GREATER_THAN_OR_EQUAL": {
      const numActual = Number(actual);
      const numExpected = Number(expected);
      if (isNaN(numActual) || isNaN(numExpected)) return false;
      return numActual >= numExpected;
    }

    case "NUMBER_LESS_THAN": {
      const numActual = Number(actual);
      const numExpected = Number(expected);
      if (isNaN(numActual) || isNaN(numExpected)) return false;
      return numActual < numExpected;
    }

    case "NUMBER_LESS_THAN_OR_EQUAL": {
      const numActual = Number(actual);
      const numExpected = Number(expected);
      if (isNaN(numActual) || isNaN(numExpected)) return false;
      return numActual <= numExpected;
    }

    default:
      return false;
  }
}

/**
 * Checks if a single household member matches a member sub-rule
 */
function memberMatchesRule(member: Member, rule: RuleDefinition): boolean {
  const memberField = (member as unknown as Record<string, unknown>)[rule.field];
  return evaluateScalarComparison(memberField, rule.operator, rule.value);
}

export interface RuleEvaluationResult {
  status: "MATCHED" | "FAILED" | "MISSING";
  detail: RuleEvaluationDetail;
  missing?: MissingRequirementDetail;
}

/**
 * Evaluates a single RuleDefinition against household and members
 */
export function evaluateRule(
  rule: RuleDefinition,
  household: Household,
  members: Member[] = []
): RuleEvaluationResult {
  // 1. Scope: HOUSEHOLD
  if (rule.scope === "HOUSEHOLD") {
    const rawVal = (household as unknown as Record<string, unknown>)[rule.field];
    const isFieldMissing =
      rawVal === undefined ||
      rawVal === null ||
      (typeof rawVal === "string" && rawVal.trim() === "");

    if (isFieldMissing) {
      if (rule.requiredField) {
        return {
          status: "MISSING",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "HOUSEHOLD",
            field: rule.field,
            operator: rule.operator,
            status: "MISSING",
            explanation: rule.explanations.missing,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
          missing: {
            field: rule.field,
            scope: "HOUSEHOLD",
            description: rule.description,
            actionPrompt: rule.explanations.missing,
          },
        };
      } else {
        return {
          status: "FAILED",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "HOUSEHOLD",
            field: rule.field,
            operator: rule.operator,
            status: "FAILED",
            explanation: rule.explanations.failed,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
        };
      }
    }

    const passed = evaluateScalarComparison(rawVal, rule.operator, rule.value);
    return {
      status: passed ? "MATCHED" : "FAILED",
      detail: {
        ruleId: rule.id,
        ruleName: rule.name,
        scope: "HOUSEHOLD",
        field: rule.field,
        operator: rule.operator,
        status: passed ? "MATCHED" : "FAILED",
        explanation: passed ? rule.explanations.matched : rule.explanations.failed,
        isVerifiedRule: rule.isVerifiedRule,
        sourceEvidence: rule.sourceEvidence,
        pathwayCode: rule.pathwayCode,
      },
    };
  }

  // 2. Scope: MEMBER
  if (rule.scope === "MEMBER") {
    // If checking for member existence/criteria and household has 0 members
    if (members.length === 0) {
      if (rule.requiredField) {
        return {
          status: "MISSING",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "MEMBER",
            field: rule.field,
            operator: rule.operator,
            status: "MISSING",
            explanation: rule.explanations.missing,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
          missing: {
            field: "members",
            scope: "MEMBER",
            description: "Family member details required to check individual entitlement criteria.",
            actionPrompt: rule.explanations.missing,
          },
        };
      } else {
        return {
          status: "FAILED",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "MEMBER",
            field: rule.field,
            operator: rule.operator,
            status: "FAILED",
            explanation: rule.explanations.failed,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
        };
      }
    }

    if (rule.operator === "MEMBER_EXISTS") {
      let matchedCount = 0;
      let hasMissingMemberField = false;

      for (const m of members) {
        if (rule.subRule) {
          const subFieldVal = (m as unknown as Record<string, unknown>)[rule.subRule.field];
          if (
            subFieldVal === undefined ||
            subFieldVal === null ||
            (typeof subFieldVal === "string" && subFieldVal.trim() === "")
          ) {
            if (rule.subRule.requiredField) {
              hasMissingMemberField = true;
            }
          } else if (memberMatchesRule(m, rule.subRule)) {
            matchedCount++;
          }
        } else {
          matchedCount++;
        }
      }

      if (matchedCount >= 1) {
        return {
          status: "MATCHED",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "MEMBER",
            field: rule.field,
            operator: rule.operator,
            status: "MATCHED",
            explanation: rule.explanations.matched,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
        };
      }

      if (hasMissingMemberField && rule.requiredField) {
        return {
          status: "MISSING",
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "MEMBER",
            field: rule.field,
            operator: rule.operator,
            status: "MISSING",
            explanation: rule.explanations.missing,
            isVerifiedRule: rule.isVerifiedRule,
            sourceEvidence: rule.sourceEvidence,
            pathwayCode: rule.pathwayCode,
          },
          missing: {
            field: rule.subRule ? rule.subRule.field : rule.field,
            scope: "MEMBER",
            description: rule.description,
            actionPrompt: rule.explanations.missing,
          },
        };
      }

      return {
        status: "FAILED",
        detail: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: "MEMBER",
          field: rule.field,
          operator: rule.operator,
          status: "FAILED",
          explanation: rule.explanations.failed,
          isVerifiedRule: rule.isVerifiedRule,
          sourceEvidence: rule.sourceEvidence,
          pathwayCode: rule.pathwayCode,
        },
      };
    }

    if (rule.operator === "MEMBER_COUNT") {
      let matchedCount = 0;
      for (const m of members) {
        if (rule.subRule ? memberMatchesRule(m, rule.subRule) : true) {
          matchedCount++;
        }
      }
      const targetCount = Number(rule.value) || 1;
      const passed = matchedCount >= targetCount;
      return {
        status: passed ? "MATCHED" : "FAILED",
        detail: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: "MEMBER",
          field: rule.field,
          operator: rule.operator,
          status: passed ? "MATCHED" : "FAILED",
          explanation: passed ? rule.explanations.matched : rule.explanations.failed,
          isVerifiedRule: rule.isVerifiedRule,
          sourceEvidence: rule.sourceEvidence,
          pathwayCode: rule.pathwayCode,
        },
      };
    }

    // Direct condition on any member
    let passed = false;
    let hasDirectMissing = false;
    for (const m of members) {
      const rawVal = (m as unknown as Record<string, unknown>)[rule.field];
      if (rawVal === undefined || rawVal === null || (typeof rawVal === "string" && rawVal.trim() === "")) {
        if (rule.requiredField) {
          hasDirectMissing = true;
        }
      } else if (evaluateScalarComparison(rawVal, rule.operator, rule.value)) {
        passed = true;
        break;
      }
    }

    if (passed) {
      return {
        status: "MATCHED",
        detail: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: "MEMBER",
          field: rule.field,
          operator: rule.operator,
          status: "MATCHED",
          explanation: rule.explanations.matched,
          isVerifiedRule: rule.isVerifiedRule,
          sourceEvidence: rule.sourceEvidence,
          pathwayCode: rule.pathwayCode,
        },
      };
    }

    if (hasDirectMissing && rule.requiredField) {
      return {
        status: "MISSING",
        detail: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: "MEMBER",
          field: rule.field,
          operator: rule.operator,
          status: "MISSING",
          explanation: rule.explanations.missing,
          isVerifiedRule: rule.isVerifiedRule,
          sourceEvidence: rule.sourceEvidence,
          pathwayCode: rule.pathwayCode,
        },
        missing: {
          field: rule.field,
          scope: "MEMBER",
          description: rule.description,
          actionPrompt: rule.explanations.missing,
        },
      };
    }

    return {
      status: "FAILED",
      detail: {
        ruleId: rule.id,
        ruleName: rule.name,
        scope: "MEMBER",
        field: rule.field,
        operator: rule.operator,
        status: "FAILED",
        explanation: rule.explanations.failed,
        isVerifiedRule: rule.isVerifiedRule,
        sourceEvidence: rule.sourceEvidence,
        pathwayCode: rule.pathwayCode,
      },
    };
  }

  return {
    status: "FAILED",
    detail: {
      ruleId: rule.id,
      ruleName: rule.name,
      scope: rule.scope,
      field: rule.field,
      operator: rule.operator,
      status: "FAILED",
      explanation: rule.explanations.failed,
      isVerifiedRule: rule.isVerifiedRule,
      sourceEvidence: rule.sourceEvidence,
      pathwayCode: rule.pathwayCode,
    },
  };
}

export interface RuleSetEvaluationResult {
  status: EligibilityStatus;
  matchedRules: RuleEvaluationDetail[];
  failedRules: RuleEvaluationDetail[];
  missingRequirements: MissingRequirementDetail[];
  pathwayCode?: string;
}

/**
 * Evaluates a composite RuleSet with ALL or ANY boolean logic
 */
export function evaluateRuleSet(
  ruleSet: RuleSet,
  household: Household,
  members: Member[] = []
): RuleSetEvaluationResult {
  const matchedRules: RuleEvaluationDetail[] = [];
  const failedRules: RuleEvaluationDetail[] = [];
  const missingRequirements: MissingRequirementDetail[] = [];

  for (const rule of ruleSet.rules) {
    const res = evaluateRule(rule, household, members);
    if (res.status === "MATCHED") {
      matchedRules.push(res.detail);
    } else if (res.status === "MISSING") {
      failedRules.push(res.detail);
      if (res.missing) {
        missingRequirements.push(res.missing);
      }
    } else {
      failedRules.push(res.detail);
    }
  }

  let finalStatus: EligibilityStatus = "NOT_ELIGIBLE";

  if (ruleSet.combination === "ALL") {
    const hasMissing = missingRequirements.length > 0;
    const hasExplicitFail = failedRules.some((r) => r.status === "FAILED");

    if (hasExplicitFail) {
      finalStatus = "NOT_ELIGIBLE";
    } else if (hasMissing) {
      finalStatus = "NEEDS_INFORMATION";
    } else if (matchedRules.length === ruleSet.rules.length) {
      finalStatus = "ELIGIBLE";
    } else {
      finalStatus = "NOT_ELIGIBLE";
    }
  } else if (ruleSet.combination === "ANY") {
    if (matchedRules.length > 0) {
      finalStatus = "ELIGIBLE";
    } else if (missingRequirements.length > 0) {
      finalStatus = "NEEDS_INFORMATION";
    } else {
      finalStatus = "NOT_ELIGIBLE";
    }
  }

  const primaryPathway = matchedRules.find((r) => r.pathwayCode)?.pathwayCode;

  return {
    status: finalStatus,
    matchedRules,
    failedRules,
    missingRequirements,
    pathwayCode: primaryPathway,
  };
}

/**
 * Top-level deterministic Scheme Evaluator
 */
export function evaluateScheme(
  scheme: Scheme,
  version: SchemeVersion,
  household: Household,
  members: Member[] = []
): EligibilityResult {
  const evalResult = evaluateRuleSet(version.ruleSet, household, members);

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    schemeShortName: scheme.shortName,
    schemeVersion: version.version,
    category: scheme.category,
    level: scheme.level,
    benefitSummary: scheme.benefitSummary,
    status: evalResult.status,
    pathwayCode: evalResult.pathwayCode,
    isVerifiedScheme: Boolean(version.sourceMetadata?.isVerified),
    matchedRules: evalResult.matchedRules,
    failedRules: evalResult.failedRules,
    missingRequirements: evalResult.missingRequirements,
    requiredDocuments: version.requiredDocuments || scheme.requiredDocuments || [],
    nextActions: version.actions || scheme.actions || [],
    evaluatedAt: new Date().toISOString(),
  };
}
