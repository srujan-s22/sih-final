import { HealthcareGap } from "@shared/types/gaps.js";
import { Household } from "@shared/types/household.js";

/**
 * Gap Detection Service Boundary Interface (Phase 4 Foundation)
 */
export interface IGapService {
  detectGaps(household: Household): Promise<HealthcareGap[]>;
}

export class GapService implements IGapService {
  async detectGaps(_household: Household): Promise<HealthcareGap[]> {
    // Stub for Phase 4 gap detection engine
    return [];
  }
}
