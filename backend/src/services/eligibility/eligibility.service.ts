import { EligibilityResult } from "../../../../shared/types/eligibility.js";
import { Household, Member } from "../../../../shared/types/household.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";
import { HouseholdRepository } from "../../repositories/household.repository.js";
import { SchemeService } from "../scheme.service.js";
import { evaluateScheme } from "./rule-engine.js";

/**
 * Deterministic Eligibility Service
 */
export interface IEligibilityService {
  evaluateHouseholdForSchemes(
    household: Household,
    members: Member[]
  ): Promise<EligibilityResult[]>;

  evaluateHouseholdForScheme(
    schemeId: string,
    household: Household,
    members: Member[]
  ): Promise<EligibilityResult | null>;

  evaluateCitizenHousehold(
    ownerUid: string
  ): Promise<{ household: Household | null; members: Member[]; results: EligibilityResult[] }>;
}

export class EligibilityService implements IEligibilityService {
  private schemeService: SchemeService;

  constructor(
    private schemeRepository: SchemeRepository,
    private householdRepository: HouseholdRepository
  ) {
    this.schemeService = new SchemeService(schemeRepository);
  }

  /**
   * Evaluates citizen household against all verified ACTIVE schemes
   */
  public async evaluateHouseholdForSchemes(
    household: Household,
    members: Member[] = []
  ): Promise<EligibilityResult[]> {
    // Only verified, active schemes are retrieved for citizen evaluation
    const verifiedActiveSchemes = await this.schemeService.getActiveSchemes();
    const results: EligibilityResult[] = [];

    for (const scheme of verifiedActiveSchemes) {
      const activeVersion = await this.schemeRepository.getActiveVersion(scheme.id);
      if (
        activeVersion &&
        activeVersion.status === "ACTIVE" &&
        activeVersion.sourceMetadata?.isVerified
      ) {
        const result = evaluateScheme(scheme, activeVersion, household, members);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Evaluates citizen household against a single scheme, strictly requiring ACTIVE and verified status
   */
  public async evaluateHouseholdForScheme(
    schemeId: string,
    household: Household,
    members: Member[] = []
  ): Promise<EligibilityResult | null> {
    const scheme = await this.schemeService.getSchemeById(schemeId);

    if (!scheme || scheme.status !== "ACTIVE") {
      return null;
    }

    const activeVersion = await this.schemeRepository.getActiveVersion(schemeId);
    if (
      !activeVersion ||
      activeVersion.status !== "ACTIVE" ||
      !activeVersion.sourceMetadata?.isVerified
    ) {
      return null;
    }

    return evaluateScheme(scheme, activeVersion, household, members);
  }

  public async evaluateCitizenHousehold(
    ownerUid: string
  ): Promise<{ household: Household | null; members: Member[]; results: EligibilityResult[] }> {
    const household = await this.householdRepository.getHouseholdByOwnerUid(ownerUid);

    if (!household) {
      return { household: null, members: [], results: [] };
    }

    const members = await this.householdRepository.getMembers(household.id);
    const results = await this.evaluateHouseholdForSchemes(household, members);

    return {
      household,
      members,
      results,
    };
  }
}
