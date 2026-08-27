import { EligibilityResult } from "../../../../shared/types/eligibility.js";
import { Household } from "../../../../shared/types/household.js";
import {
  DocumentReadinessItem,
  DocumentStatus,
  OverallDocumentReadiness,
} from "../../../../shared/types/guidance.js";

export class DocumentReadinessService {
  /**
   * Deterministically calculates document readiness from verified scheme evaluations
   */
  public evaluateReadiness(
    eligibilityResults: EligibilityResult[],
    household: Household | null = null,
    knownDocuments: Record<string, boolean> = {}
  ): OverallDocumentReadiness {
    const itemsMap = new Map<string, DocumentReadinessItem>();

    for (const result of eligibilityResults) {
      // Only process active verified schemes that are ELIGIBLE or NEEDS_INFORMATION
      if (!result.isVerifiedScheme || result.status === "NOT_ELIGIBLE") {
        continue;
      }

      for (const doc of result.requiredDocuments) {
        if (!itemsMap.has(doc.id)) {
          let status: DocumentStatus = "UNKNOWN";

          if (knownDocuments[doc.id] === true) {
            status = "READY";
          } else if (knownDocuments[doc.id] === false) {
            status = "NOT_READY";
          } else if (doc.id.toLowerCase().includes("ration") && household?.rationCardNumber) {
            status = "READY";
          } else {
            // Default safely to UNKNOWN (never assume missing without citizen confirmation)
            status = "UNKNOWN";
          }

          itemsMap.set(doc.id, {
            id: doc.id,
            name: doc.name,
            required: doc.required,
            description: doc.description,
            status,
            issuingAuthority: doc.issuingAuthority,
            relatedSchemeId: result.schemeId,
            relatedSchemeName: result.schemeShortName || result.schemeName,
          });
        }
      }
    }

    const items = Array.from(itemsMap.values());
    const requiredItems = items.filter((d) => d.required);

    let readyCount = 0;
    let unknownCount = 0;
    let missingCount = 0;

    for (const item of requiredItems) {
      if (item.status === "READY") readyCount++;
      else if (item.status === "UNKNOWN") unknownCount++;
      else if (item.status === "NOT_READY") missingCount++;
    }

    let overallStatus: DocumentStatus = "UNKNOWN";
    if (requiredItems.length === 0) {
      overallStatus = "READY";
    } else if (readyCount === requiredItems.length) {
      overallStatus = "READY";
    } else if (missingCount > 0 || (readyCount > 0 && unknownCount > 0)) {
      overallStatus = "PARTIALLY_READY";
    } else {
      overallStatus = "UNKNOWN";
    }

    return {
      status: overallStatus,
      totalRequired: requiredItems.length,
      readyCount,
      unknownCount,
      missingCount,
      items,
    };
  }
}
