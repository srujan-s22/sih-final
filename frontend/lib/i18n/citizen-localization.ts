/**
 * Citizen Schemes & Guidance Localization Module
 * Provides localized names, benefit summaries, action plan items (titles, descriptions, reasons),
 * rule explanations, and assistance messages for Kannada (kn), Hindi (hi), and English (en).
 */

export interface LocalizedScheme {
  name: string;
  benefit: string;
}

export interface LocalizedActionPlan {
  title: string;
  description: string;
  reason?: string;
}

/**
 * Returns localized Scheme Name and Benefit Summary
 */
export function getLocalizedScheme(
  scheme: {
    schemeId?: string;
    id?: string;
    name?: string;
    schemeName?: string;
    benefit?: string;
    benefitSummary?: string;
  },
  language: string
): LocalizedScheme {
  const sId = (scheme.schemeId || scheme.id || "").toLowerCase().trim();
  const sName = (scheme.schemeName || scheme.name || "").toLowerCase().trim();

  // 1. AB-PMJAY (Senior Citizens 70+ Universal)
  if (
    sId === "ab-pmjay" ||
    sId.includes("pmjay") ||
    sName.includes("jan arogya") ||
    sName.includes("ayushman bharat")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ — ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಆರೋಗ್ಯ ಯೋಜನೆ (AB-PMJAY 70+)",
          benefit:
            "ನೋಂದಾಯಿತ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ 70 ವರ್ಷ ಮತ್ತು ಮೇಲ್ಪಟ್ಟ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಪ್ರತಿ ವರ್ಷ ₹5,00,000 ವರೆಗೆ ಉಚಿತ ದ್ವಿತೀಯ ಮತ್ತು ತೃತೀಯ ಹಂತದ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆ ರಕ್ಷಣೆ.",
        };
      case "hi":
        return {
          name: "आयुष्मान भारत — प्रधानमंत्री जन आरोग्य योजना (AB-PMJAY 70+)",
          benefit:
            "देशभर के सूचीबद्ध अस्पतालों में 70 वर्ष और उससे अधिक आयु के वरिष्ठ नागरिकों के लिए प्रति वर्ष ₹5,00,000 तक का माध्यमिक और तृतीयक अस्पताल उपचार कवर।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Up to ₹5,00,000 per year secondary and tertiary hospital cover for senior citizens aged 70+ across empaneled hospitals nationwide.",
        };
    }
  }

  // 2. JSY (Janani Suraksha Yojana)
  if (
    sId === "jsy" ||
    sId.includes("jsy") ||
    sName.includes("janani suraksha")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ — ಸುರಕ್ಷಿತ ಮಾತೃತ್ವ ಯೋಜನೆ (JSY)",
          benefit:
            "ಅಂಗೀಕೃತ ಸರ್ಕಾರಿ ಅಥವಾ ಖಾಸಗಿ ಆರೋಗ್ಯ ಕೇಂದ್ರಗಳಲ್ಲಿ ಸಂಸ್ಥಾಗತ ಹೆರಿಗೆ ಮಾಡಿಸುವ ಗರ್ಭಿಣಿಯರಿಗೆ ನೇರ ನಗದು ನೆರವು ಮತ್ತು ತಾಯಿ ಆರೈಕೆ ಸೌಲಭ್ಯ.",
        };
      case "hi":
        return {
          name: "जननी सुरक्षा योजना — सुरक्षित मातृत्व हस्तक्षेप (JSY)",
          benefit:
            "मान्यता प्राप्त सरकारी या निजी स्वास्थ्य केंद्रों में संस्थागत प्रसव कराने वाली गर्भवती महिलाओं के लिए प्रत्यक्ष नकद सहायता और मातृत्व देखभाल।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "Janani Suraksha Yojana — Safe Motherhood Intervention",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Direct cash assistance and maternal care for pregnant women delivering in accredited public or private health centers.",
        };
    }
  }

  // 3. PMMVY (Pradhan Mantri Matru Vandana Yojana)
  if (
    sId === "pmmvy" ||
    sId.includes("pmmvy") ||
    sName.includes("matru vandana") ||
    sName.includes("matrivandana")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ (PMMVY)",
          benefit:
            "ಮೊದಲ ಜೀವಂತ ಮಗುವಿಗೆ ಎರಡು ಕಂತುಗಳಲ್ಲಿ ₹5,000 ಮತ್ತು ಎರಡನೇ ಮಗು ಹೆಣ್ಣಾಗಿದ್ದಲ್ಲಿ ಒಂದೇ ಕಂತಿನಲ್ಲಿ ₹6,000 ನೇರ ನಗದು ವರ್ಗಾವಣೆ (DBT) ಆರ್ಥಿಕ ನೆರವು.",
        };
      case "hi":
        return {
          name: "प्रधानमंत्री मातृ वंदना योजना (PMMVY)",
          benefit:
            "पहले जीवित बच्चे के लिए दो किस्तों में ₹5,000 और दूसरी कन्या शिशु होने पर ₹6,000 की प्रत्यक्ष लाभ अंतरण (DBT) वित्तीय सहायता।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "Pradhan Mantri Matru Vandana Yojana",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Direct Benefit Transfer (DBT) of ₹5,00,000 in two installments for the first living child, and ₹6,000 in a single installment for a second child if the infant is a girl.",
        };
    }
  }

  // 4. JSSK (Janani Shishu Suraksha Karyakram)
  if (
    sId === "jssk" ||
    sId.includes("jssk") ||
    sName.includes("shishu suraksha")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ಜನನಿ ಶಿಶು ಸುರಕ್ಷಾ ಕಾರ್ಯಕ್ರಮ (JSSK)",
          benefit:
            "ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಕೇಂದ್ರಗಳಲ್ಲಿ ಗರ್ಭಿಣಿಯರಿಗೆ ಮತ್ತು ನವಜಾತ ಶಿಶುಗಳಿಗೆ ಸಂಪೂರ್ಣ ಉಚಿತ ಮತ್ತು ನಗದುರಹಿತ ಹೆರಿಗೆ ಹಾಗೂ ಶಿಶು ಆರೈಕೆ ಸೌಲಭ್ಯ.",
        };
      case "hi":
        return {
          name: "जननी शिशु सुरक्षा कार्यक्रम (JSSK)",
          benefit:
            "सरकारी स्वास्थ्य संस्थानों में गर्भवती महिलाओं और नवजात शिशुओं के लिए पूरी तरह से मुफ्त और कैशलेस प्रसव और उपचार।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "Janani Shishu Suraksha Karyakram",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Completely free and cashless delivery and newborn care in public health facilities.",
        };
    }
  }

  // 5. AB-ArK (Arogya Karnataka)
  if (
    sId === "ab-ark-karnataka" ||
    sId.includes("ark") ||
    sName.includes("arogya karnataka")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ – ಆರೋಗ್ಯ ಕರ್ನಾಟಕ (AB-ArK)",
          benefit:
            "ಕರ್ನಾಟಕದಲ್ಲಿ ಅರ್ಹ ಬಿಪಿಎಲ್/ಎಎವೈ ಕುಟುಂಬಗಳಿಗೆ ₹5,00,000 ವರೆಗೆ ಹಾಗೂ ಸಾಮಾನ್ಯ ವರ್ಗಕ್ಕೆ ₹1,50,000 ವರೆಗೆ ವಾರ್ಷಿಕ ತೃತೀಯ ಹಂತದ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸಾ ರಕ್ಷಣೆ.",
        };
      case "hi":
        return {
          name: "आयुष्मान भारत – आरोग्य कर्नाटक (AB-ArK)",
          benefit:
            "कर्नाटक में पात्र बीपीएल/एएवाई परिवारों के लिए ₹5,00,000 तक और सामान्य श्रेणी के लिए ₹1,50,000 तक का वार्षिक तृतीयक स्वास्थ्य सेवा कवर।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "Ayushman Bharat – Arogya Karnataka",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Up to ₹5,00,000 yearly tertiary healthcare cover for eligible BPL/AAY families and ₹1,50,000 for general category in Karnataka.",
        };
    }
  }

  // 6. State Health Assurance
  if (
    sId === "state-health-assurance" ||
    sName.includes("state health assurance") ||
    sName.includes("universal health assurance")
  ) {
    switch (language) {
      case "kn":
        return {
          name: "ರಾಜ್ಯ ಸಾರ್ವತ್ರಿಕ ಆರೋಗ್ಯ ಭರವಸೆ ಕಾರ್ಯಕ್ರಮ",
          benefit:
            "ರಾಜ್ಯದ ನೆಟ್‌ವರ್ಕ್ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ನಗದುರಹಿತ ತೃತೀಯ ಹಂತದ ಆರೈಕೆ, ಗಂಭೀರ ಅನಾರೋಗ್ಯ ಕವರೇಜ್ ಮತ್ತು ರೋಗನಿರ್ಣಯ ನೆರವು.",
        };
      case "hi":
        return {
          name: "राज्य सार्वभौमिक स्वास्थ्य आश्वासन कार्यक्रम",
          benefit:
            "राज्य नेटवर्क अस्पतालों में कैशलेस तृतीयक देखभाल, गंभीर बीमारी कवर और नैदानिक सहायता।",
        };
      default:
        return {
          name: scheme.schemeName || scheme.name || "State Universal Health Assurance Program",
          benefit:
            scheme.benefitSummary ||
            scheme.benefit ||
            "Cashless tertiary care, critical illness coverage, and diagnostic support across state network hospitals.",
        };
    }
  }

  return {
    name: scheme.schemeName || scheme.name || "Government Healthcare Scheme",
    benefit: scheme.benefitSummary || scheme.benefit || "Official government healthcare coverage and benefits.",
  };
}

/**
 * Localized Document names & details
 */
interface LocalizedDocInfo {
  name: string;
  desc: string;
}

const DOCUMENT_MAP: Record<string, Record<string, LocalizedDocInfo>> = {
  "aadhaar-card-senior": {
    kn: {
      name: "ಹಿರಿಯ ನಾಗರಿಕರ ಆಧಾರ್ ಕಾರ್ಡ್ (ವಯಸ್ಸು 70+)",
      desc: "ವಯಸ್ಸಿನ ದೃಢೀಕರಣ ಮತ್ತು ಪ್ರತ್ಯೇಕ ಆಯುಷ್ಮಾನ್ ವಯ ವಂದನಾ ಕಾರ್ಡ್ ಪಡೆಯಲು ಬಳಸಲಾಗುತ್ತದೆ.",
    },
    hi: {
      name: "वरिष्ठ नागरिक का आधार कार्ड (आयु 70+)",
      desc: "आयु सत्यापन और विशिष्ट आयुष्मान वय वंदना कार्ड निर्माण के लिए उपयोग किया जाता है।",
    },
    en: {
      name: "Aadhaar Card of Senior Citizen (Age 70+)",
      desc: "Used for age verification and distinct Ayushman Vay Vandana card generation.",
    },
  },
  "mcp-card": {
    kn: {
      name: "ತಾಯಿ ಮತ್ತು ಮಕ್ಕಳ ರಕ್ಷಣಾ (MCP) ಕಾರ್ಡ್",
      desc: "ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ ಅಥವಾ ಅಂಗನವಾಡಿಯಿಂದ ನೀಡಲಾದ ಪ್ರಸವಪೂರ್ವ ತಪಾಸಣೆ ಮತ್ತು ಲಸಿಕೆ ದಾಖಲೆ.",
    },
    hi: {
      name: "मातृ एवं बाल संरक्षण (MCP) कार्ड",
      desc: "प्राथमिक स्वास्थ्य केंद्र या आंगनवाड़ी द्वारा जारी प्रसवपूर्व जांच और टीकाकरण रिकॉर्ड।",
    },
    en: {
      name: "Mother and Child Protection (MCP) Card",
      desc: "Antenatal checkup and immunization record issued by primary health center/Anganwadi.",
    },
  },
  "bank-passbook": {
    kn: {
      name: "ತಾಯಿಯ ಬ್ಯಾಂಕ್ ಖಾತೆ ಪಾಸ್‌ಬುಕ್",
      desc: "ನೇರ ನಗದು ವರ್ಗಾವಣೆಗಾಗಿ (DBT) ಸಕ್ರಿಯ ಬ್ಯಾಂಕ್ ಖಾತೆ ದಾಖಲೆ.",
    },
    hi: {
      name: "माता की बैंक खाता पासबुक",
      desc: "प्रत्यक्ष लाभ अंतरण (DBT) के लिए सक्रिय बैंक खाता रिकॉर्ड।",
    },
    en: {
      name: "Mother's Bank Account Passbook",
      desc: "Active bank account for Direct Benefit Transfer (DBT).",
    },
  },
  "aadhaar-mother": {
    kn: {
      name: "ಫಲಾನುಭವಿಯ (ತಾಯಿಯ) ಆಧಾರ್ ಕಾರ್ಡ್",
      desc: "ತಾಯಿಯ ಪ್ರಾಥಮಿಕ ಗುರುತಿನ ದಾಖಲೆ. ಅಧಿಕೃತ PMMVY 2.0 ನಿಯಮಗಳ ಪ್ರಕಾರ ಪತಿಯ ಆಧಾರ್ ಕಡ್ಡಾಯವಲ್ಲ.",
    },
    hi: {
      name: "लाभार्थी (माता) का आधार कार्ड",
      desc: "माता का प्राथमिक पहचान दस्तावेज। आधिकारिक PMMVY 2.0 नियमों के अनुसार पति का आधार अनिवार्य नहीं है।",
    },
    en: {
      name: "Aadhaar Card of the Beneficiary (Mother)",
      desc: "Primary identity document of the mother. Husband's Aadhaar is explicitly not mandatory.",
    },
  },
  "mobile-number-mother": {
    kn: {
      name: "ಫಲಾನುಭವಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
      desc: "ನೋಂದಣಿ, ಒಟಿಪಿ ಪರಿಶೀಲನೆ ಮತ್ತು ಸ್ಥಿತಿ ನವೀಕರಣಗಳಿಗಾಗಿ ಆಧಾರ್‌ಗೆ ಲಿಂಕ್ ಮಾಡಲಾದ ಸಕ್ರಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ.",
    },
    hi: {
      name: "लाभार्थी का मोबाइल नंबर",
      desc: "पंजीकरण, ओटीपी सत्यापन और स्थिति अपडेट के लिए आधार से जुड़ा सक्रिय मोबाइल नंबर।",
    },
    en: {
      name: "Beneficiary Mobile Number",
      desc: "Active mobile number linked with Aadhaar for registration, OTP verification, and status updates.",
    },
  },
  "bank-account-dbt": {
    kn: {
      name: "ತಾಯಿಯ ಆಧಾರ್-ಸಂಯೋಜಿತ ಬ್ಯಾಂಕ್ / ಅಂಚೆ ಕಚೇರಿ ಖಾತೆ",
      desc: "ನೇರ ನಗದು ವರ್ಗಾವಣೆಗಾಗಿ (DBT) ಆಧಾರ್‌ಗೆ ಸಂಯೋಜಿಸಲಾದ ಸಕ್ರಿಯ ಬ್ಯಾಂಕ್ ಅಥವಾ ಅಂಚೆ ಕಚೇರಿ ಖಾತೆ.",
    },
    hi: {
      name: "माता का आधार-लिंक्ड बैंक / डाकघर खाता",
      desc: "प्रत्यक्ष लाभ अंतरण (DBT) के लिए आधार से जुड़ा सक्रिय एकल बैंक या डाकघर खाता।",
    },
    en: {
      name: "Mother's Aadhaar-Seeded Bank / Post Office Account",
      desc: "Active single bank or post office account seeded with Aadhaar for Direct Benefit Transfer.",
    },
  },
  "category-proof": {
    kn: {
      name: "ಅರ್ಹತಾ ವರ್ಗದ ದಾಖಲೆ (BPL / ಇ-ಶ್ರಮ್ / PM-JAY / MGNREGA / SC-ST / ವಿಕಲಚೇತನ)",
      desc: "PMMVY ಸೌಲಭ್ಯಕ್ಕಾಗಿ ಅರ್ಹತಾ ವರ್ಗವನ್ನು (BPL, ಇ-ಶ್ರಮ್, PM-JAY, MGNREGA, ಇತ್ಯಾದಿ) ದೃಢೀಕರಿಸುವ ದಾಖಲೆ.",
    },
    hi: {
      name: "पात्र श्रेणी दस्तावेज (BPL / ई-श्रम / PM-JAY / MGNREGA / SC-ST / दिव्यांगता)",
      desc: "PMMVY लाभ के लिए पात्र श्रेणी (BPL, ई-श्रम, PM-JAY, MGNREGA, आदि) को सत्यापित करने वाला आधिकारिक दस्तावेज।",
    },
    en: {
      name: "Supporting Category Document (BPL / e-Shram / PM-JAY / MGNREGA / SC-ST / Disability)",
      desc: "Official card or certificate verifying qualifying category for PMMVY.",
    },
  },
  "institutional-delivery-cert": {
    kn: {
      name: "ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆ ದೃಢೀಕರಣ ಪ್ರಮಾಣಪತ್ರ",
      desc: "ಅಂಗೀಕೃತ ಸರ್ಕಾರಿ ಅಥವಾ ಖಾಸಗಿ ಆರೋಗ್ಯ ಕೇಂದ್ರದಲ್ಲಿ ಹೆರಿಗೆಯಾಗಿದೆ ಎಂಬುದನ್ನು ದೃಢೀಕರಿಸುವ ಆಸ್ಪತ್ರೆ ದಾಖಲೆ.",
    },
    hi: {
      name: "संस्थागत प्रसव पुष्टि प्रमाण पत्र",
      desc: "मान्यता प्राप्त स्वास्थ्य केंद्र में प्रसव की पुष्टि करने वाला अस्पताल डिस्चार्ज रिकॉर्ड।",
    },
    en: {
      name: "Institutional Delivery Confirmation Certificate",
      desc: "Hospital delivery or discharge certificate from accredited healthcare facility.",
    },
  },
};

/**
 * Localizes an Action Plan Item
 */
export function getLocalizedActionPlanItem(
  action: {
    id?: string;
    title?: string;
    description?: string;
    reason?: string;
    actionType?: string;
    relatedSchemeId?: string;
    relatedSchemeName?: string;
  },
  language: string
): LocalizedActionPlan {
  const actId = (action.id || "").toLowerCase();
  const title = action.title || "";
  const desc = action.description || "";
  const reason = action.reason || "";
  const schemeName = action.relatedSchemeName || "Government Scheme";

  // Case 1: Missing PMMVY Category Verification (Seen in user's screenshot)
  if (
    actId.includes("pmmvycategoryverified") ||
    title.includes("pmmvyCategoryVerified") ||
    desc.includes("pmmvyCategoryVerified") ||
    (desc.includes("PMMVY") && desc.includes("qualifying category"))
  ) {
    switch (language) {
      case "kn":
        return {
          title: "ಅಗತ್ಯ ಮಾಹಿತಿ ನವೀಕರಿಸಿ: PMMVY ಅರ್ಹತಾ ವರ್ಗ ಮತ್ತು ಜನನ ಕ್ರಮ",
          description:
            "ವೈಯಕ್ತಿಕ PMMVY ಅರ್ಹತೆಯನ್ನು ನಿರ್ಣಯಿಸಲು, ನಿಮ್ಮ ಅರ್ಹತಾ ವರ್ಗ (ಉದಾ. BPL, ಇ-ಶ್ರಮ್, PM-JAY, MGNREGA, ಅಥವಾ SC/ST) ಮತ್ತು ಇದು ಮೊದಲ ಮಗುವೋ ಅಥವಾ ಎರಡನೇ ಹೆಣ್ಣು ಮಗುವೋ ಎಂಬುದರ ಅಧಿಕೃತ ದೃಢೀಕರಣದ ಅಗತ್ಯವಿದೆ. ವರ್ಗ ದೃಢೀಕರಣವಿಲ್ಲದೆ ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸ್ವಯಂ ಅರ್ಹತೆಯನ್ನು ಪರಿಗಣಿಸುವುದಿಲ್ಲ.",
          reason:
            "ಆರೋಗ್ಯ ಸೌಲಭ್ಯವು ಅನ್ವಯಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸಲು ಯೋಜನೆಯ ಅರ್ಹತಾ ಮಾನದಂಡಗಳಿಗೆ ಈ ಮಾಹಿತಿಯ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "आवश्यक जानकारी अपडेट करें: PMMVY पात्र श्रेणी और जन्म क्रम",
          description:
            "व्यक्तिगत PMMVY पात्रता का मूल्यांकन करने के लिए, आपकी पात्र श्रेणी (उदा. BPL, ई-श्रम, PM-JAY, MGNREGA, या SC/ST) और क्या यह पहले बच्चे या दूसरी कन्या शिशु के लिए है, इसका आधिकारिक सत्यापन आवश्यक है। स्वास्थ्यसेतु श्रेणी सत्यापन के बिना पात्रता नहीं मानता है।",
          reason:
            "स्वास्थ्य सहायता लागू होती है या नहीं, यह निर्धारित करने के लिए योजना पात्रता मानदंडों को इस जानकारी की आवश्यकता होती है।",
        };
      default:
        return {
          title: "Update Missing Information: PMMVY Qualifying Category & Birth Order",
          description: desc,
          reason: reason || "Scheme eligibility criteria require this information to determine whether healthcare support applies.",
        };
    }
  }

  // Case 2: Missing Maternal Status
  if (
    actId.includes("maternalstatus") ||
    title.includes("maternalStatus") ||
    desc.includes("maternalStatus") ||
    desc.includes("pregnancy or lactation")
  ) {
    switch (language) {
      case "kn":
        return {
          title: "ಅಗತ್ಯ ಮಾಹಿತಿ ನವೀಕರಿಸಿ: ಗರ್ಭಾವಸ್ಥೆ ಅಥವಾ ತಾಯ್ತನದ ಸ್ಥಿತಿ",
          description:
            "PMMVY ಮಾತೃತ್ವ ಸೌಲಭ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಮಾತೃತ್ವ ಸ್ಥಿತಿ (ಗರ್ಭಾವಸ್ಥೆ ಅಥವಾ ಹಾಲುಣಿಸುವಿಕೆ) ವಿವರಗಳು ಅಗತ್ಯವಿದೆ.",
          reason:
            "ಆರೋಗ್ಯ ಸೌಲಭ್ಯವು ಅನ್ವಯಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸಲು ಯೋಜನೆಯ ಅರ್ಹತಾ ಮಾನದಂಡಗಳಿಗೆ ಈ ಮಾಹಿತಿಯ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "आवश्यक जानकारी अपडेट करें: गर्भावस्था या मातृत्व स्थिति",
          description:
            "PMMVY मातृत्व लाभों की जांच के लिए मातृत्व स्थिति (गर्भावस्था या स्तनपान) आवश्यक है।",
          reason:
            "स्वास्थ्य सहायता लागू होती है या नहीं, यह निर्धारित करने के लिए योजना पात्रता मानदंडों को इस जानकारी की आवश्यकता होती है।",
        };
      default:
        return {
          title: "Update Missing Information: Maternal Status",
          description: desc,
          reason: reason || "Scheme eligibility criteria require this information to determine whether healthcare support applies.",
        };
    }
  }

  // Case 3: Missing Institutional Delivery Facility (JSY)
  if (
    actId.includes("institutionaldeliveryfacility") ||
    title.includes("institutionalDeliveryFacility") ||
    title.includes("Institutional Delivery") ||
    desc.includes("institutional delivery")
  ) {
    switch (language) {
      case "kn":
        return {
          title: "ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆ ನೋಂದಣಿಗಾಗಿ ಸ್ಥಳೀಯ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯನ್ನು ಸಂಪರ್ಕಿಸಿ",
          description:
            "JSY ಸೌಲಭ್ಯಗಳಿಗಾಗಿ ಅಂಗೀಕೃತ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಕೇಂದ್ರ (PHC/CHC/ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ) ಅಥವಾ ಅಂಗೀಕೃತ ಖಾಸಗಿ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆಯ ದೃಢೀಕರಣ ಅಗತ್ಯವಿದೆ.",
          reason:
            "ಆರೋಗ್ಯ ಸೌಲಭ್ಯವು ಅನ್ವಯಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸಲು ಯೋಜನೆಯ ಅರ್ಹತಾ ಮಾನದಂಡಗಳಿಗೆ ಈ ಮಾಹಿತಿಯ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "संस्थागत प्रसव पंजीकरण के लिए स्थानीय आशा कार्यकर्ता से संपर्क करें",
          description:
            "JSY लाभों के लिए मान्यता प्राप्त सरकारी स्वास्थ्य केंद्र (PHC/CHC/जिला अस्पताल) या मान्यता प्राप्त निजी सुविधा में संस्थागत प्रसव का सत्यापन आवश्यक है।",
          reason:
            "स्वास्थ्य सहायता लागू होती है या नहीं, यह निर्धारित करने के लिए योजना पात्रता मानदंडों को इस जानकारी की आवश्यकता होती है।",
        };
      default:
        return {
          title: "Connect with Local ASHA for Institutional Delivery Registration",
          description: desc,
          reason: reason || "Scheme eligibility criteria require this information to determine whether healthcare support applies.",
        };
    }
  }

  // Case 4: Missing Family Age Details
  if (actId.includes("provide_age") || title.includes(": age") || desc.includes("age details are required")) {
    switch (language) {
      case "kn":
        return {
          title: "ಕುಟುಂಬದ ಸದಸ್ಯರ ವಯಸ್ಸಿನ ವಿವರಗಳನ್ನು ನವೀಕರಿಸಿ",
          description: "PM-JAY ಹಿರಿಯ ನಾಗರಿಕರ 70+ ಸೌಲಭ್ಯವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ಕುಟುಂಬದ ಸದಸ್ಯರ ವಯಸ್ಸಿನ ವಿವರಗಳು ಅಗತ್ಯವಿದೆ.",
          reason: "ಆರೋಗ್ಯ ಸೌಲಭ್ಯವು ಅನ್ವಯಿಸುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸಲು ಈ ಮಾಹಿತಿಯ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "परिवार के सदस्यों की आयु का विवरण अपडेट करें",
          description: "PM-JAY वरिष्ठ नागरिक 70+ सहायता का मूल्यांकन करने के लिए परिवार के सदस्य की आयु का विवरण आवश्यक है।",
          reason: "स्वास्थ्य सहायता लागू होती है या नहीं, यह निर्धारित करने के लिए इस जानकारी की आवश्यकता होती है।",
        };
      default:
        return {
          title: "Update Family Member Age Details",
          description: desc,
          reason: reason,
        };
    }
  }

  // Case 5: 70+ Senior Citizen e-KYC Action / Gap
  if (
    actId.includes("complete_ekyc") ||
    actId.includes("action-abpmjay-70-ekyc") ||
    title.includes("70+ Senior Citizen")
  ) {
    switch (language) {
      case "kn":
        return {
          title: "ಅಧಿಕೃತ 70+ ಹಿರಿಯ ನಾಗರಿಕರ ಇ-ಕೆವೈಸಿ ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಿ",
          description:
            "ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸಾ ಸೌಲಭ್ಯಗಳನ್ನು ಪಡೆಯುವ ಮುನ್ನ ವಿಶೇಷ ಆಯುಷ್ಮಾನ್ ವಯ ವಂದನಾ ಕಾರ್ಡ್ ಪಡೆಯಲು ಅಧಿಕೃತ ಆಯುಷ್ಮಾನ್ ಆ್ಯಪ್‌ನಲ್ಲಿ (NHA) ಅಥವಾ ಆಯುಷ್ಮಾನ್ ಮಿತ್ರ ಕೇಂದ್ರದಲ್ಲಿ ಆಧಾರ್ ಆಧಾರಿತ ಇ-ಕೆವೈಸಿ ಕಡ್ಡಾಯವಾಗಿದೆ.",
          reason:
            "AB PM-JAY ಅಡಿಯಲ್ಲಿ 70+ ವಯಸ್ಸಿನ ಅರ್ಹತಾ ಮಾನದಂಡವನ್ನು ಪೂರೈಸುತ್ತದೆ. ಆಸ್ಪತ್ರೆಗೆ ದಾಖಲಾಗುವ ಮೊದಲು ಅಧಿಕೃತ ನೋಂದಣಿ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "आधिकारिक 70+ वरिष्ठ नागरिक ई-केवाईसी नामांकन पूरा करें",
          description:
            "अस्पताल में भर्ती लाभों का दावा करने से पहले विशिष्ट आयुष्मान वय वंदना कार्ड प्राप्त करने के लिए आधिकारिक आयुष्मान ऐप (NHA) पर या आयुष्मान मित्र केंद्र पर आधार-आधारित ई-केवाईसी आवश्यक है।",
          reason:
            "AB PM-JAY के तहत 70+ आयु पात्रता मानदंड को पूरा करता है। अस्पताल में प्रवेश से पहले आधिकारिक नामांकन आवश्यक है।",
        };
      default:
        return {
          title: "Complete Official 70+ Senior Citizen e-KYC Enrolment",
          description: desc,
          reason: reason || "Meets the age-based 70+ eligibility criterion under AB PM-JAY. Official enrolment is still required before hospital admission.",
        };
    }
  }

  // Case 6: JSY ASHA Contact Action
  if (actId.includes("action-jsy-asha") || title.includes("ANC & Institutional Delivery")) {
    switch (language) {
      case "kn":
        return {
          title: "ಎಎನ್‌ಸಿ ಮತ್ತು ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆ ನೋಂದಣಿಗಾಗಿ ಸ್ಥಳೀಯ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯನ್ನು ಸಂಪರ್ಕಿಸಿ",
          description:
            "MCP ಕಾರ್ಡ್ ಮತ್ತು ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆ ನೋಂದಣಿಗಾಗಿ ನಿಮ್ಮ ಸಮುದಾಯದ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯನ್ನು ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಹತ್ತಿರದ ಉಪ-ಕೇಂದ್ರ/PHC ಗೆ ಭೇಟಿ ನೀಡಿ.",
          reason: "ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ (JSY) ಅಧಿಕೃತ ಮಾರ್ಗಸೂಚಿಗಳ ಅಡಿಯಲ್ಲಿ ಈ ಕ್ರಮ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "एएनसी और संस्थागत प्रसव पंजीकरण के लिए स्थानीय आशा कार्यकर्ता से संपर्क करें",
          description:
            "MCP कार्ड और संस्थागत प्रसव पंजीकरण के लिए अपनी सामुदायिक आशा कार्यकर्ता से संपर्क करें या नजदीकी उप-केंद्र/पीएचसी पर जाएं।",
          reason: "जननी सुरक्षा योजना (JSY) के आधिकारिक दिशानिर्देशों के तहत यह कार्रवाई आवश्यक है।",
        };
      default:
        return {
          title: "Contact Local ASHA Worker for ANC & Institutional Delivery Registration",
          description: desc,
          reason: reason,
        };
    }
  }

  // Case 7: PMMVY Anganwadi Worker Contact
  if (actId.includes("action-pmmvy-awc") || title.includes("Anganwadi Worker")) {
    switch (language) {
      case "kn":
        return {
          title: "ಸ್ಥಳೀಯ ಆಶಾ ಅಥವಾ ಅಂಗನವಾಡಿ ಕಾರ್ಯಕರ್ತೆಯನ್ನು ಸಂಪರ್ಕಿಸಿ",
          description:
            "ನೋಂದಣಿ ನೆರವು ಮತ್ತು PMMVYSoft ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನೋಂದಣಿಗಾಗಿ ನಿಮ್ಮ ಸ್ಥಳೀಯ ಅಂಗನವಾಡಿ ಕೇಂದ್ರಕ್ಕೆ (AWC) ಭೇಟಿ ನೀಡಿ ಅಥವಾ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯ ನೆರವು ಪಡೆಯಿರಿ.",
          reason: "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ (PMMVY) ಅಧಿಕೃತ ಮಾರ್ಗಸೂಚಿಗಳ ಅಡಿಯಲ್ಲಿ ಈ ಕ್ರಮ ಅಗತ್ಯವಿದೆ.",
        };
      case "hi":
        return {
          title: "स्थानीय आशा या आंगनवाड़ी कार्यकर्ता से संपर्क करें",
          description:
            "पंजीकरण सहायता और PMMVYSoft पोर्टल पर नामांकन के लिए अपने स्थानीय आंगनवाड़ी केंद्र (AWC) पर जाएं या अपनी सामुदायिक आशा कार्यकर्ता से संपर्क करें।",
          reason: "प्रधानमंत्री मातृ वंदना योजना (PMMVY) के आधिकारिक दिशानिर्देशों के तहत यह कार्रवाई आवश्यक है।",
        };
      default:
        return {
          title: "Contact Local ASHA or Anganwadi Worker (AWC)",
          description: desc,
          reason: reason,
        };
    }
  }

  // Case 8: PMMVY Portal Link Action
  if (actId.includes("action-pmmvy-portal") || title.includes("Official PMMVY Portal")) {
    switch (language) {
      case "kn":
        return {
          title: "ಅಧಿಕೃತ PMMVY ಪೋರ್ಟಲ್ (ಭಾರತ ಸರ್ಕಾರ)",
          description:
            "ಯೋಜನಾ ಮಾರ್ಗಸೂಚಿಗಳು ಮತ್ತು ನಾಗರಿಕ ಸೇವೆಗಳಿಗಾಗಿ ಮಹಿಳಾ ಮತ್ತು ಮಕ್ಕಳ ಅಭಿವೃದ್ಧಿ ಸಚಿವಾಲಯದ ಅಧಿಕೃತ ಪೋರ್ಟಲ್ ಪ್ರವೇಶಿಸಿ: https://pmmvy.wcd.gov.in.",
          reason: "ಯೋಜನೆಯ ನಿಯಮಗಳು ಮತ್ತು ಸೌಲಭ್ಯಗಳ ಪರಿಶೀಲನೆಗಾಗಿ ಅಧಿಕೃತ ಪೋರ್ಟಲ್.",
        };
      case "hi":
        return {
          title: "आधिकारिक PMMVY पोर्टल (भारत सरकार)",
          description:
            "योजना दिशानिर्देशों और नागरिक सेवाओं के लिए महिला एवं बाल विकास मंत्रालय के आधिकारिक पोर्टल पर जाएं: https://pmmvy.wcd.gov.in.",
          reason: "योजना नियमों और लाभों के सत्यापन के लिए आधिकारिक पोर्टल।",
        };
      default:
        return {
          title: "Official PMMVY Portal (Government of India)",
          description: desc,
          reason: reason,
        };
    }
  }

  // Case 9: Document Readiness Actions ("action_doc_..." or "Keep ... Ready")
  for (const [docKey, translations] of Object.entries(DOCUMENT_MAP)) {
    if (actId.includes(docKey) || title.toLowerCase().includes(docKey.replace(/-/g, " "))) {
      const doc = translations[language] || translations.en;
      switch (language) {
        case "kn":
          return {
            title: `ಪರಿಶೀಲನೆಗಾಗಿ ${doc.name} ಸಿದ್ಧವಾಗಿಟ್ಟುಕೊಳ್ಳಿ`,
            description: doc.desc,
            reason: `${schemeName} ಸೌಲಭ್ಯ ಪಡೆಯಲು ಫಲಾನುಭವಿ ನೋಂದಣಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಇದು ಅಗತ್ಯವಿದೆ.`,
          };
        case "hi":
          return {
            title: `सत्यापन के लिए ${doc.name} तैयार रखें`,
            description: doc.desc,
            reason: `${schemeName} का लाभ प्राप्त करने के लिए लाभार्थी नामांकन पूरा करने हेतु यह आवश्यक है।`,
          };
        default:
          return {
            title: `Keep ${doc.name} Ready for Verification`,
            description: doc.desc,
            reason: reason || `Required to complete beneficiary enrollment for ${schemeName}.`,
          };
      }
    }
  }

  // Fallback for generic actions
  if (language === "kn") {
    let cleanTitle = title.replace(/^Update Missing Information:\s*/i, "ಅಗತ್ಯ ಮಾಹಿತಿ ನವೀಕರಿಸಿ: ");
    cleanTitle = cleanTitle.replace(/^Keep\s+(.+)\s+Ready for Verification/i, "ಪರಿಶೀಲನೆಗಾಗಿ $1 ಸಿದ್ಧವಾಗಿಟ್ಟುಕೊಳ್ಳಿ");
    return {
      title: cleanTitle,
      description: desc,
      reason: reason ? "ಯೋಜನೆಯ ಅರ್ಹತಾ ಮಾನದಂಡಗಳಿಗೆ ಈ ಕ್ರಮ ಅಗತ್ಯವಿದೆ." : undefined,
    };
  }

  if (language === "hi") {
    let cleanTitle = title.replace(/^Update Missing Information:\s*/i, "आवश्यक जानकारी अपडेट करें: ");
    cleanTitle = cleanTitle.replace(/^Keep\s+(.+)\s+Ready for Verification/i, "सत्यापन के लिए $1 तैयार रखें");
    return {
      title: cleanTitle,
      description: desc,
      reason: reason ? "योजना पात्रता मानदंडों के तहत यह कार्रवाई आवश्यक है।" : undefined,
    };
  }

  return {
    title,
    description: desc,
    reason,
  };
}

/**
 * Localizes rule evaluation explanations ("Why this applies" in Support tab)
 */
export function getLocalizedRuleExplanation(explanation: string, language: string): string {
  if (!explanation) return "";
  const expLower = explanation.toLowerCase();

  if (language === "kn") {
    if (expLower.includes("meets the age-based 70+") || expLower.includes("universal pm-jay senior")) {
      return "ಕುಟುಂಬದ ಸದಸ್ಯರು ಸಾರ್ವತ್ರಿಕ PM-JAY ಹಿರಿಯ ನಾಗರಿಕ ಯೋಜನೆಯಡಿಯಲ್ಲಿ 70+ ವಯಸ್ಸಿನ ಅರ್ಹತಾ ಮಾನದಂಡವನ್ನು ಪೂರೈಸುತ್ತಾರೆ. ಗಮನಿಸಿ: ಸೌಲಭ್ಯಗಳನ್ನು ಪಡೆಯಲು ಆಯುಷ್ಮಾನ್ ಆ್ಯಪ್ ಅಥವಾ PM-JAY ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಅಧಿಕೃತ ಆಧಾರ್ ಆಧಾರಿತ ಇ-ಕೆವೈಸಿ ನೋಂದಣಿ ಅಗತ್ಯವಿದೆ.";
    }
    if (expLower.includes("no household member aged 70")) {
      return "ಸಾರ್ವತ್ರಿಕ ಹಿರಿಯ ನಾಗರಿಕ PM-JAY ಯೋಜನೆಗಾಗಿ 70 ಅಥವಾ ಅದಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ವಯಸ್ಸಿನ ಯಾವುದೇ ಕುಟುಂಬದ ಸದಸ್ಯರು ಕಂಡುಬಂದಿಲ್ಲ.";
    }
    if (expLower.includes("age details are required to evaluate pm-jay")) {
      return "PM-JAY ಹಿರಿಯ ನಾಗರಿಕರ 70+ ಸೌಲಭ್ಯವನ್ನು ಪರಿಶೀಲಿಸಲು ಕುಟುಂಬದ ಸದಸ್ಯರ ವಯಸ್ಸಿನ ವಿವರಗಳು ಅಗತ್ಯವಿದೆ.";
    }
    if (expLower.includes("official pmmvy eligibility category and birth order verified")) {
      return "ಅಧಿಕೃತ PMMVY ಅರ್ಹತಾ ವರ್ಗ ಮತ್ತು ಜನನ ಕ್ರಮವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ.";
    }
    if (expLower.includes("qualifying category (e.g. bpl, e-shram, pm-jay") || expLower.includes("without category verification")) {
      return "ವೈಯಕ್ತಿಕ PMMVY ಅರ್ಹತೆಯನ್ನು ನಿರ್ಣಯಿಸಲು, ನಿಮ್ಮ ಅರ್ಹತಾ ವರ್ಗ (ಉದಾ. BPL, ಇ-ಶ್ರಮ್, PM-JAY, MGNREGA, ಅಥವಾ SC/ST) ಮತ್ತು ಇದು ಮೊದಲ ಮಗುವೋ ಅಥವಾ ಎರಡನೇ ಹೆಣ್ಣು ಮಗುವೋ ಎಂಬುದರ ಅಧಿಕೃತ ದೃಢೀಕರಣದ ಅಗತ್ಯವಿದೆ. ವರ್ಗ ದೃಢೀಕರಣವಿಲ್ಲದೆ ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸ್ವಯಂ ಅರ್ಹತೆಯನ್ನು ಪರಿಗಣಿಸುವುದಿಲ್ಲ.";
    }
    if (expLower.includes("pregnant or lactating, satisfying the primary maternal")) {
      return "ಕುಟುಂಬದ ಸದಸ್ಯರು ಗರ್ಭಿಣಿ ಅಥವಾ ಹಾಲುಣಿಸುವ ಬಾಣಂತಿ ಎಂದು ದಾಖಲಾಗಿದ್ದು, PMMVY ಯ ಪ್ರಾಥಮಿಕ ಮಾತೃತ್ವ ಸ್ಥಿತಿಯ ಮಾನದಂಡವನ್ನು ಪೂರೈಸುತ್ತಾರೆ.";
    }
    if (expLower.includes("no household member is currently recorded as pregnant")) {
      return "PMMVY ಮಾತೃತ್ವ ಸೌಲಭ್ಯಗಳಿಗಾಗಿ ಪ್ರಸ್ತುತ ಕುಟುಂಬದ ಯಾವುದೇ ಸದಸ್ಯರು ಗರ್ಭಿಣಿ ಅಥವಾ ಹಾಲುಣಿಸುವವರು ಎಂದು ದಾಖಲಾಗಿಲ್ಲ.";
    }
    if (expLower.includes("maternal status (pregnancy or lactation) is required")) {
      return "PMMVY ಮಾತೃತ್ವ ಸೌಲಭ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಮಾತೃತ್ವ ಸ್ಥಿತಿ (ಗರ್ಭಾವಸ್ಥೆ ಅಥವಾ ಹಾಲುಣಿಸುವಿಕೆ) ವಿವರಗಳು ಅಗತ್ಯವಿದೆ.";
    }
    if (expLower.includes("verified institutional delivery at an accredited")) {
      return "JSY ಸೌಲಭ್ಯಗಳಿಗಾಗಿ ಅಂಗೀಕೃತ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಕೇಂದ್ರ (PHC/CHC/ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ) ಅಥವಾ ಅಂಗೀಕೃತ ಖಾಸಗಿ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಸಾಂಸ್ಥಿಕ ಹೆರಿಗೆಯ ದೃಢೀಕರಣ ಅಗತ್ಯವಿದೆ.";
    }
  }

  if (language === "hi") {
    if (expLower.includes("meets the age-based 70+") || expLower.includes("universal pm-jay senior")) {
      return "परिवार का एक सदस्य सार्वभौमिक PM-JAY वरिष्ठ नागरिक योजना के तहत आयु-आधारित 70+ पात्रता मानदंड को पूरा करता है। नोट: लाभ प्राप्त करने के लिए आयुष्मान ऐप/PM-JAY पोर्टल पर आधिकारिक आधार-आधारित ई-केवाईसी नामांकन आवश्यक है।";
    }
    if (expLower.includes("no household member aged 70")) {
      return "सार्वभौमिक वरिष्ठ नागरिक PM-JAY योजना के लिए 70 वर्ष या उससे अधिक आयु का कोई परिवार का सदस्य नहीं मिला।";
    }
    if (expLower.includes("age details are required to evaluate pm-jay")) {
      return "PM-JAY वरिष्ठ नागरिक 70+ सहायता का मूल्यांकन करने के लिए परिवार के सदस्य की आयु का विवरण आवश्यक है।";
    }
    if (expLower.includes("official pmmvy eligibility category and birth order verified")) {
      return "आधिकारिक PMMVY पात्रता श्रेणी और जन्म क्रम का सफलतापूर्वक सत्यापन किया गया।";
    }
    if (expLower.includes("qualifying category (e.g. bpl, e-shram, pm-jay") || expLower.includes("without category verification")) {
      return "व्यक्तिगत PMMVY पात्रता का मूल्यांकन करने के लिए, आपकी पात्र श्रेणी (उदा. BPL, ई-श्रम, PM-JAY, MGNREGA, या SC/ST) और क्या यह पहले बच्चे या दूसरी कन्या शिशु के लिए है, इसका आधिकारिक सत्यापन आवश्यक है। स्वास्थ्यसेतु श्रेणी सत्यापन के बिना पात्रता नहीं मानता है।";
    }
    if (expLower.includes("pregnant or lactating, satisfying the primary maternal")) {
      return "परिवार की एक सदस्य गर्भवती या स्तनपान कराने वाली के रूप में दर्ज हैं, जो PMMVY की प्राथमिक मातृत्व स्थिति शर्त को पूरा करती हैं।";
    }
    if (expLower.includes("no household member is currently recorded as pregnant")) {
      return "PMMVY मातृत्व लाभों के लिए वर्तमान में परिवार का कोई सदस्य गर्भवती या स्तनपान कराने वाला दर्ज नहीं है।";
    }
    if (expLower.includes("maternal status (pregnancy or lactation) is required")) {
      return "PMMVY मातृत्व लाभों की जांच के लिए मातृत्व स्थिति (गर्भावस्था या स्तनपान) आवश्यक है।";
    }
    if (expLower.includes("verified institutional delivery at an accredited")) {
      return "JSY लाभों के लिए मान्यता प्राप्त सरकारी स्वास्थ्य केंद्र (PHC/CHC/जिला अस्पताल) या मान्यता प्राप्त निजी अस्पताल में सत्यापित संस्थागत प्रसव आवश्यक है।";
    }
  }

  return explanation;
}

/**
 * Generates localized default message for ASHA assistance request modal
 */
export function getLocalizedAssistanceDefaultMessage(
  schemeId?: string,
  schemeName?: string,
  selectedMember?: { fullName: string; age: number; relationship?: string },
  language: string = "en"
): string {
  const localizedScheme = schemeName ? getLocalizedScheme({ schemeId, schemeName }, language).name : schemeId;

  if (language === "kn") {
    if (schemeId && selectedMember) {
      return `${selectedMember.fullName} (ವಯಸ್ಸು ${selectedMember.age}, ${selectedMember.relationship || "ಕುಟುಂಬದ ಸದಸ್ಯರು"}) ಅವರಿಗಾಗಿ ${localizedScheme || schemeId} ಯೋಜನೆ ನೋಂದಣಿ ಮತ್ತು ದಾಖಲೆ ಪರಿಶೀಲನೆಗೆ ಮನೆಬಾಗಿಲಿನ ಆಶಾ ಸಹಾಯ ಕೋರುತ್ತಿದ್ದೇವೆ.`;
    }
    if (schemeId) {
      return `ನಮ್ಮ ಕುಟುಂಬಕ್ಕಾಗಿ ${localizedScheme || schemeId} ಯೋಜನೆ ನೋಂದಣಿಗೆ ಮನೆಬಾಗಿಲಿನ ಆಶಾ ಸಹಾಯ ಕೋರುತ್ತಿದ್ದೇವೆ.`;
    }
    return "ನಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಅಗತ್ಯವಿರುವ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಮಾರ್ಗದರ್ಶನಕ್ಕಾಗಿ ಆಶಾ ಸಹಾಯ ಕೋರುತ್ತಿದ್ದೇವೆ.";
  }

  if (language === "hi") {
    if (schemeId && selectedMember) {
      return `${selectedMember.fullName} (आयु ${selectedMember.age}, ${selectedMember.relationship || "परिवार का सदस्य"}) के लिए ${localizedScheme || schemeId} योजना नामांकन और दस्तावेज सत्यापन के लिए घर-द्वार पर आशा सहायता का अनुरोध।`;
    }
    if (schemeId) {
      return `हमारे परिवार के लिए ${localizedScheme || schemeId} योजना नामांकन के लिए घर-द्वार पर आशा सहायता का अनुरोध।`;
    }
    return "हमारे परिवार के लिए सरकारी स्वास्थ्य योजनाओं के मार्गदर्शन हेतु आशा सहायता का अनुरोध।";
  }

  // English default
  if (schemeId && selectedMember) {
    return `Requesting doorstep assistance for ${schemeName || schemeId} enrollment and document verification for ${selectedMember.fullName} (Age ${selectedMember.age}, ${selectedMember.relationship || "Member"}).`;
  }
  if (schemeId) {
    return `Requesting doorstep assistance for ${schemeName || schemeId} enrollment for our household.`;
  }
  return "Requesting doorstep ASHA assistance for our household healthcare schemes.";
}
