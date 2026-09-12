import { describe, it, expect } from "vitest";
import {
  getLocalizedScheme,
  getLocalizedActionPlanItem,
  getLocalizedRuleExplanation,
  getLocalizedAssistanceDefaultMessage,
} from "../../frontend/lib/i18n/citizen-localization";

describe("Citizen Healthcare Benefits & Recommended Next Steps Localization", () => {
  describe("1. Healthcare Benefits Scheme Localization", () => {
    it("localizes AB-PMJAY into Kannada and Hindi", () => {
      const scheme = {
        schemeId: "ab-pmjay",
        schemeName: "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana",
        benefitSummary: "Up to ₹5,00,000 per year secondary and tertiary hospital cover...",
      };

      const locKn = getLocalizedScheme(scheme, "kn");
      expect(locKn.name).toContain("ಆಯುಷ್ಮಾನ್ ಭಾರತ್ — ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಆರೋಗ್ಯ ಯೋಜನೆ");
      expect(locKn.benefit).toContain("₹5,00,000");
      expect(locKn.benefit).toContain("ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ");

      const locHi = getLocalizedScheme(scheme, "hi");
      expect(locHi.name).toContain("आयुष्मान भारत — प्रधानमंत्री जन आरोग्य योजना");
      expect(locHi.benefit).toContain("₹5,00,000");
      expect(locHi.benefit).toContain("वरिष्ठ नागरिकों");

      const locEn = getLocalizedScheme(scheme, "en");
      expect(locEn.name).toBe("Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana");
    });

    it("localizes JSY (Janani Suraksha Yojana) into Kannada and Hindi", () => {
      const scheme = {
        schemeId: "jsy",
        schemeName: "Janani Suraksha Yojana — Safe Motherhood Intervention",
        benefitSummary: "Direct cash assistance and maternal care for pregnant women...",
      };

      const locKn = getLocalizedScheme(scheme, "kn");
      expect(locKn.name).toContain("ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ");
      expect(locKn.benefit).toContain("ಸಂಸ್ಥಾಗತ ಹೆರಿಗೆ");

      const locHi = getLocalizedScheme(scheme, "hi");
      expect(locHi.name).toContain("जननी सुरक्षा योजना");
      expect(locHi.benefit).toContain("संस्थागत प्रसव");
    });

    it("localizes PMMVY (Pradhan Mantri Matru Vandana Yojana) into Kannada and Hindi", () => {
      const scheme = {
        schemeId: "pmmvy",
        schemeName: "Pradhan Mantri Matru Vandana Yojana",
        benefitSummary: "Direct Benefit Transfer (DBT) of ₹5,000 in two installments...",
      };

      const locKn = getLocalizedScheme(scheme, "kn");
      expect(locKn.name).toContain("ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ");
      expect(locKn.benefit).toContain("₹5,000");
      expect(locKn.benefit).toContain("₹6,000");

      const locHi = getLocalizedScheme(scheme, "hi");
      expect(locHi.name).toContain("प्रधानमंत्री मातृ वंदना योजना");
      expect(locHi.benefit).toContain("₹5,000");
      expect(locHi.benefit).toContain("₹6,000");
    });
  });

  describe("2. Recommended Next Steps (Action Plan) Localization", () => {
    it("fixes raw technical variable pmmvyCategoryVerified in Kannada and Hindi", () => {
      const rawAction = {
        id: "action_pmmvy_provide_pmmvyCategoryVerified",
        title: "Update Missing Information: pmmvyCategoryVerified",
        description:
          "To evaluate personal PMMVY eligibility, official verification of your qualifying category (e.g. BPL, e-Shram, PM-JAY, MGNREGA, or SC/ST) and whether this is for a first child or second girl child is required. SwasthyaSetu does not assume eligibility without category verification.",
        reason:
          "Scheme eligibility criteria require this information to determine whether healthcare support applies.",
      };

      const locKn = getLocalizedActionPlanItem(rawAction, "kn");
      // Never render raw variable pmmvyCategoryVerified in Kannada
      expect(locKn.title).not.toContain("pmmvyCategoryVerified");
      expect(locKn.title).toContain("ಅಗತ್ಯ ಮಾಹಿತಿ ನವೀಕರಿಸಿ");
      expect(locKn.title).toContain("PMMVY ಅರ್ಹತಾ ವರ್ಗ");
      expect(locKn.description).toContain("ವೈಯಕ್ತಿಕ PMMVY ಅರ್ಹತೆಯನ್ನು ನಿರ್ಣಯಿಸಲು");
      expect(locKn.description).toContain("ಸ್ವಾಸ್ಥ್ಯಸೇತು");
      expect(locKn.reason).toContain("ಆರೋಗ್ಯ ಸೌಲಭ್ಯವು ಅನ್ವಯಿಸುತ್ತದೆಯೇ");

      const locHi = getLocalizedActionPlanItem(rawAction, "hi");
      // Never render raw variable pmmvyCategoryVerified in Hindi
      expect(locHi.title).not.toContain("pmmvyCategoryVerified");
      expect(locHi.title).toContain("आवश्यक जानकारी अपडेट करें");
      expect(locHi.title).toContain("PMMVY पात्र श्रेणी");
      expect(locHi.description).toContain("व्यक्तिगत PMMVY पात्रता का मूल्यांकन करने के लिए");
      expect(locHi.description).toContain("स्वास्थ्यसेतु");
      expect(locHi.reason).toContain("स्वास्थ्य सहायता लागू होती है या नहीं");
    });

    it("localizes e-KYC senior citizen action plan item", () => {
      const rawAction = {
        id: "action_ab-pmjay_complete_ekyc",
        title: "Complete Official 70+ Senior Citizen e-KYC Enrolment",
        description:
          "Aadhaar-based e-KYC is required on the official Ayushman App (NHA) or at an Ayushman Mitra kiosk...",
        reason: "Meets the age-based 70+ eligibility criterion under AB PM-JAY.",
      };

      const locKn = getLocalizedActionPlanItem(rawAction, "kn");
      expect(locKn.title).toContain("70+ ಹಿರಿಯ ನಾಗರಿಕರ ಇ-ಕೆವೈಸಿ ನೋಂದಣಿ");
      expect(locKn.description).toContain("ಆಯುಷ್ಮಾನ್ ವಯ ವಂದನಾ ಕಾರ್ಡ್");

      const locHi = getLocalizedActionPlanItem(rawAction, "hi");
      expect(locHi.title).toContain("70+ वरिष्ठ नागरिक ई-केवाईसी");
      expect(locHi.description).toContain("आयुष्मान वय वंदना कार्ड");
    });

    it("localizes document readiness action plan items", () => {
      const rawAction = {
        id: "action_doc_pmmvy_aadhaar-mother",
        title: "Keep Aadhaar Card of the Beneficiary (Mother) Ready for Verification",
        description: "Primary identity document of the mother.",
        relatedSchemeName: "PMMVY",
      };

      const locKn = getLocalizedActionPlanItem(rawAction, "kn");
      expect(locKn.title).toContain("ಪರಿಶೀಲನೆಗಾಗಿ");
      expect(locKn.title).toContain("ಫಲಾನುಭವಿಯ (ತಾಯಿಯ) ಆಧಾರ್ ಕಾರ್ಡ್");
      expect(locKn.description).toContain("ತಾಯಿಯ ಪ್ರಾಥಮಿಕ ಗುರುತಿನ ದಾಖಲೆ");

      const locHi = getLocalizedActionPlanItem(rawAction, "hi");
      expect(locHi.title).toContain("सत्यापन के लिए");
      expect(locHi.title).toContain("लाभार्थी (माता) का आधार कार्ड");
      expect(locHi.description).toContain("माता का प्राथमिक पहचान दस्तावेज");
    });
  });

  describe("3. Rule Explanation & Assistance Modal Messages", () => {
    it("translates rule explanation in Kannada and Hindi", () => {
      const exp =
        "A family member meets the age-based 70+ eligibility criterion under the universal PM-JAY Senior Citizen pathway.";
      const expKn = getLocalizedRuleExplanation(exp, "kn");
      expect(expKn).toContain("70+ ವಯಸ್ಸಿನ ಅರ್ಹತಾ ಮಾನದಂಡ");

      const expHi = getLocalizedRuleExplanation(exp, "hi");
      expect(expHi).toContain("70+ पात्रता मानदंड");
    });

    it("generates natural Kannada and Hindi assistance messages for ASHA modal", () => {
      const msgKn = getLocalizedAssistanceDefaultMessage(
        "ab-pmjay",
        "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana",
        { fullName: "ರಾಮಪ್ಪ", age: 72, relationship: "ತಾತ" },
        "kn"
      );
      expect(msgKn).toContain("ರಾಮಪ್ಪ");
      expect(msgKn).toContain("ಆಯುಷ್ಮಾನ್ ಭಾರತ್");
      expect(msgKn).toContain("ಮನೆಬಾಗಿಲಿನ ಆಶಾ ಸಹಾಯ");

      const msgHi = getLocalizedAssistanceDefaultMessage(
        "ab-pmjay",
        "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana",
        { fullName: "रामेश्वर", age: 72, relationship: "दादा" },
        "hi"
      );
      expect(msgHi).toContain("रामेश्वर");
      expect(msgHi).toContain("आयुष्मान भारत");
      expect(msgHi).toContain("आशा सहायता");
    });
  });
});
