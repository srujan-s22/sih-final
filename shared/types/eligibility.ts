export interface SchemeRule {
  id: string;
  schemeId: string;
  ruleType: "income_tier" | "social_category" | "age_bracket" | "condition";
  criteria: Record<string, unknown>;
  createdAt: string;
}

export interface Scheme {
  id: string;
  schemeName: string;
  level: "central" | "state";
  coverageAmount: number;
  description: string;
  isActive: boolean;
  rules?: SchemeRule[];
  createdAt: string;
}

export interface EligibilityResult {
  schemeId: string;
  schemeName: string;
  isEligible: boolean;
  reasons: string[];
  missingEvidence: string[];
}
