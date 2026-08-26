import { EligibilityResult } from "@shared/types/eligibility.js";
import { Household } from "@shared/types/household.js";

/**
 * Eligibility Service Boundary Interface (Phase 3 Foundation)
 */
export interface IEligibilityService {
  evaluateHousehold(household: Household): Promise<EligibilityResult[]>;
}

export class EligibilityService implements IEligibilityService {
  async evaluateHousehold(_household: Household): Promise<EligibilityResult[]> {
    // Stub for Phase 3 deterministic rule engine
    return [];
  }
}
