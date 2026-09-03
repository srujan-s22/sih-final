import { Scheme, SchemeVersion } from "../../../../shared/types/eligibility.js";
import { SchemeRepository } from "../../repositories/scheme.repository.js";

/**
 * ==============================================================================
 * AUTHORITATIVE VERIFIED SCHEMES (PHASE 4C REAL-WORLD VERIFIED PATHWAYS)
 * Each scheme and individual rule is backed by specific government citations.
 * ==============================================================================
 */
export const VERIFIED_PRODUCTION_SCHEMES: Array<{ scheme: Scheme; version: SchemeVersion }> = [
  // 1. Ayushman Bharat (AB-PMJAY) — Senior Citizen 70+ Universal Pathway
  {
    scheme: {
      id: "ab-pmjay",
      name: "Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana",
      shortName: "AB-PMJAY",
      description: "Centrally sponsored national health protection scheme providing up to ₹5 lakh yearly hospital coverage. Features a universal 70+ Senior Citizen pathway for all citizens aged 70 years and above irrespective of income.",
      category: "SENIOR_CITIZEN",
      level: "CENTRAL",
      status: "ACTIVE",
      authority: "National Health Authority (NHA), Ministry of Health and Family Welfare, Government of India",
      benefitSummary: "Up to ₹5,00,000 per year secondary and tertiary hospital cover for senior citizens aged 70+ across empaneled hospitals nationwide.",
      benefitDetails: [
        "Universal health coverage for all senior citizens aged 70 and above irrespective of income.",
        "Provides distinct Ayushman Vay Vandana Card.",
        "100% cashless hospitalization at empaneled public and private healthcare facilities.",
      ],
      eligibilitySummary: "All Indian senior citizens aged 70 years or older. Distinct Aadhaar-based e-KYC enrollment is required.",
      requiredDocuments: [
        {
          id: "aadhaar-card-senior",
          name: "Aadhaar Card of Senior Citizen (Age 70+)",
          required: true,
          description: "Used for age verification and distinct Ayushman Vay Vandana card generation.",
          issuingAuthority: "UIDAI",
        },
      ],
      actions: [
        {
          id: "action-abpmjay-70-ekyc",
          title: "Complete 70+ Senior Citizen e-KYC on Ayushman App",
          description: "Download the official Ayushman App (NHA) or visit nearest Ayushman Mitra kiosk to generate distinct 70+ card.",
          actionType: "DOCUMENT_VERIFICATION",
          priority: "HIGH",
        },
      ],
      currentVersion: "2026.2",
      sourceMetadata: {
        sourceOrganization: "National Health Authority (NHA), Ministry of Health & Family Welfare, Government of India",
        officialTitle: "Operational Guidelines for Universal AB PM-JAY Coverage to All Senior Citizens Aged 70 Years and Above",
        sourceUrl: "https://pmjay.gov.in",
        sourceCitation: "Union Cabinet Decision & NHA Guidelines (Sept 2024 / 2026): Expansion of AB-PMJAY health cover to all senior citizens aged 70+ irrespective of income.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Authoritative senior citizen pathway verified against official NHA portal. Evaluates age >= 70 condition.",
        sourceName: "National Health Authority (NHA) Official 70+ Senior Citizen Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
    version: {
      id: "ver_abpmjay_2026_2",
      schemeId: "ab-pmjay",
      version: "2026.2",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
      ruleSet: {
        id: "ruleset_abpmjay_70plus_2026_2",
        name: "AB-PMJAY Universal 70+ Senior Citizen Criteria 2026",
        combination: "ALL",
        rules: [
          {
            id: "rule_pmjay_senior_70plus",
            name: "Senior Citizen 70+ Criterion",
            description: "Household must include at least one senior citizen member aged 70 years or above",
            scope: "MEMBER",
            field: "age",
            operator: "NUMBER_GREATER_THAN_OR_EQUAL",
            value: 70,
            requiredField: true,
            isVerifiedRule: true,
            sourceEvidence: "NHA AB-PMJAY 70+ Guidelines Sec 2.1: Universal eligibility for all Indian residents aged 70+",
            pathwayCode: "PM-JAY-SENIOR-CITIZEN-70PLUS",
            explanations: {
              matched: "A family member meets the age-based 70+ eligibility criterion under the universal PM-JAY Senior Citizen pathway. Note: Official Aadhaar-based e-KYC enrollment on the Ayushman App/PM-JAY portal is required to receive benefits.",
              failed: "No household member aged 70 or older was found for the universal Senior Citizen PM-JAY pathway.",
              missing: "Family member age details are required to evaluate PM-JAY senior citizen 70+ support.",
            },
          },
        ],
      },
      requiredDocuments: [
        {
          id: "aadhaar-card-senior",
          name: "Aadhaar Card of Senior Citizen (Age 70+)",
          required: true,
          description: "Used for age verification and distinct Ayushman Vay Vandana card generation.",
          issuingAuthority: "UIDAI",
        },
      ],
      actions: [
        {
          id: "action-abpmjay-70-ekyc",
          title: "Complete 70+ Senior Citizen e-KYC on Ayushman App",
          description: "Download the official Ayushman App (NHA) or visit nearest Ayushman Mitra kiosk to generate distinct 70+ card.",
          actionType: "DOCUMENT_VERIFICATION",
          priority: "HIGH",
        },
      ],
      sourceMetadata: {
        sourceOrganization: "National Health Authority (NHA), Ministry of Health & Family Welfare, Government of India",
        officialTitle: "Operational Guidelines for Universal AB PM-JAY Coverage to All Senior Citizens Aged 70 Years and Above",
        sourceUrl: "https://pmjay.gov.in",
        sourceCitation: "Union Cabinet Decision & NHA Guidelines: Expansion of AB-PMJAY to all senior citizens aged 70+ irrespective of income.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Authoritative senior citizen pathway verified against official NHA portal. Evaluates age >= 70 condition.",
        sourceName: "National Health Authority (NHA) Official 70+ Senior Citizen Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
  },

  // 2. Janani Suraksha Yojana (JSY) — Safe Motherhood Intervention
  {
    scheme: {
      id: "jsy",
      name: "Janani Suraksha Yojana — Safe Motherhood Intervention",
      shortName: "JSY",
      description: "National Health Mission initiative promoting institutional delivery among poor pregnant women with cash assistance and medical care.",
      category: "MATERNAL",
      level: "CENTRAL",
      status: "ACTIVE",
      authority: "Ministry of Health and Family Welfare (MoHFW), Government of India",
      benefitSummary: "Direct cash assistance and maternal care for pregnant women delivering in accredited public or private health centers.",
      benefitDetails: [
        "Cash assistance upon delivery in accredited health institutions.",
        "Free antenatal checkups and postnatal home visits by ASHA workers.",
        "Free transport to and from healthcare facilities under JSSK integration.",
      ],
      eligibilitySummary: "Pregnant women delivering at accredited healthcare facilities. Requires ANC/MCP registration and institutional delivery verification.",
      requiredDocuments: [
        {
          id: "mcp-card",
          name: "Mother and Child Protection (MCP) Card",
          required: true,
          description: "Antenatal checkup and immunization record issued by primary health center.",
          issuingAuthority: "National Health Mission / PHC",
        },
        {
          id: "bank-passbook",
          name: "Mother's Bank Account Passbook",
          required: true,
          description: "Active bank account for Direct Benefit Transfer (DBT).",
          issuingAuthority: "Scheduled Bank / Post Office",
        },
      ],
      actions: [
        {
          id: "action-jsy-asha",
          title: "Contact Local ASHA Worker for ANC & Institutional Delivery Registration",
          description: "Connect with your community ASHA worker or visit nearest Sub-Center/PHC for MCP card and institutional delivery registration.",
          actionType: "CONTACT_ASHA",
          priority: "HIGH",
        },
      ],
      currentVersion: "2026.2",
      sourceMetadata: {
        sourceOrganization: "Ministry of Health and Family Welfare (MoHFW), Government of India / National Health Mission (NHM)",
        officialTitle: "Janani Suraksha Yojana (JSY) Operational Guidelines for Implementation",
        sourceUrl: "https://nhm.gov.in",
        sourceCitation: "NHM Maternal Health Guidelines Sec 4.1: Cash assistance for institutional delivery among pregnant women delivering in accredited health facilities.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Evaluates institutional delivery verification requirement. Missing delivery facility records return NEEDS_INFORMATION without manufacturing eligibility.",
        sourceName: "National Health Mission (NHM) Official JSY Scheme Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
    version: {
      id: "ver_jsy_2026_2",
      schemeId: "jsy",
      version: "2026.2",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
      ruleSet: {
        id: "ruleset_jsy_2026_2",
        name: "JSY Institutional Delivery Verification Criteria 2026",
        combination: "ALL",
        rules: [
          {
            id: "rule_jsy_institutional_delivery",
            name: "Institutional Delivery Facility Verification",
            description: "Delivery must be conducted at an accredited government or private healthcare facility",
            scope: "HOUSEHOLD",
            field: "institutionalDeliveryFacility",
            operator: "FIELD_EQUALS",
            value: "accredited_facility",
            requiredField: true,
            isVerifiedRule: true,
            sourceEvidence: "NHM JSY Guidelines Sec 4.1: Institutional delivery at accredited health center required",
            pathwayCode: "JSY-INSTITUTIONAL-DELIVERY",
            explanations: {
              matched: "Accredited institutional delivery facility registration verified for JSY financial assistance.",
              failed: "Janani Suraksha Yojana financial assistance applies to deliveries conducted at accredited government or private health institutions.",
              missing: "Additional maternal care details (institutional delivery facility record and ANC registration) are required to determine JSY eligibility. SwasthyaSetu does not assume eligibility without facility verification.",
            },
          },
        ],
      },
      requiredDocuments: [
        {
          id: "mcp-card",
          name: "Mother and Child Protection (MCP) Card",
          required: true,
          description: "Antenatal checkup and immunization record issued by primary health center.",
          issuingAuthority: "National Health Mission / PHC",
        },
        {
          id: "bank-passbook",
          name: "Mother's Bank Account Passbook",
          required: true,
          description: "Active bank account for Direct Benefit Transfer (DBT).",
          issuingAuthority: "Scheduled Bank / Post Office",
        },
      ],
      actions: [
        {
          id: "action-jsy-asha",
          title: "Contact Local ASHA Worker for ANC & Institutional Delivery Registration",
          description: "Connect with your community ASHA worker or visit nearest Sub-Center/PHC for MCP card and institutional delivery registration.",
          actionType: "CONTACT_ASHA",
          priority: "HIGH",
        },
      ],
      sourceMetadata: {
        sourceOrganization: "Ministry of Health and Family Welfare (MoHFW), Government of India / National Health Mission (NHM)",
        officialTitle: "Janani Suraksha Yojana (JSY) Operational Guidelines for Implementation",
        sourceUrl: "https://nhm.gov.in",
        sourceCitation: "NHM Maternal Health Guidelines Sec 4.1: Cash assistance for institutional delivery among pregnant women delivering in accredited health facilities.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Evaluates institutional delivery verification requirement. Missing delivery facility records return NEEDS_INFORMATION without manufacturing eligibility.",
        sourceName: "National Health Mission (NHM) Official JSY Scheme Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
  },
  // 3. Pradhan Mantri Matru Vandana Yojana (PMMVY) — Mission Shakti Maternal Health & Nutrition
  {
    scheme: {
      id: "pmmvy",
      name: "Pradhan Mantri Matru Vandana Yojana",
      shortName: "PMMVY",
      description: "Centrally sponsored conditional maternity benefit program under Mission Shakti providing financial assistance via Direct Benefit Transfer (DBT) to pregnant women and lactating mothers for improved health, nutrition, and partial wage compensation.",
      category: "MATERNAL",
      level: "CENTRAL",
      status: "ACTIVE",
      authority: "Ministry of Women and Child Development (MWCD), Government of India",
      benefitSummary: "Direct Benefit Transfer (DBT) of ₹5,000 in two installments for the first living child, and ₹6,000 in a single installment for a second child if the infant is a girl.",
      benefitDetails: [
        "First child: Total ₹5,000 in two installments (Installment 1: ₹3,000 on registration of pregnancy within 6 months of LMP and at least one antenatal checkup; Installment 2: ₹2,000 after child birth registration and completion of the first cycle of primary immunizations).",
        "Second child: Total ₹6,000 in a single installment after child birth registration and completion of all primary vaccinations, applicable exclusively when the second child is a girl.",
        "Conditional financial assistance transferred directly into the mother's individual Aadhaar-seeded bank or post office account.",
        "Exclusion: Regular employees of Central Government, State Governments, Public Sector Undertakings (PSUs), or those receiving similar paid maternity benefits under statutory law are not eligible.",
      ],
      eligibilitySummary: "Pregnant women and lactating mothers belonging to socially and economically disadvantaged categories (such as BPL/NFSA ration card holders, e-Shram cardholders, PM-JAY beneficiaries, MGNREGA job cardholders, PM-KISAN beneficiaries, SC/ST, persons with disabilities, or pregnant AWW/AWH/ASHA). State notes: Current official information indicates Odisha and Telangana do not implement PMMVY as they run their own state maternity programs.",
      requiredDocuments: [
        {
          id: "aadhaar-mother",
          name: "Aadhaar Card of the Beneficiary (Mother)",
          required: true,
          description: "Primary identity document of the mother. Note: Under official PMMVY 2.0 rules, husband's Aadhaar is explicitly not mandatory.",
          issuingAuthority: "UIDAI",
        },
        {
          id: "mobile-number-mother",
          name: "Beneficiary Mobile Number",
          required: true,
          description: "Active mobile number linked with Aadhaar for registration, OTP verification, and status updates.",
          issuingAuthority: "Telecom Service Provider",
        },
        {
          id: "mcp-card",
          name: "Mother and Child Protection (MCP) Card / RCHI Card",
          required: true,
          description: "Antenatal checkup record, LMP date, and child immunization history issued by health center/Anganwadi.",
          issuingAuthority: "National Health Mission / MoHFW",
        },
        {
          id: "bank-account-dbt",
          name: "Mother's Aadhaar-Seeded Bank / Post Office Account",
          required: true,
          description: "Active single bank or post office account seeded with Aadhaar for Direct Benefit Transfer.",
          issuingAuthority: "Scheduled Commercial Bank / India Post Payments Bank",
        },
        {
          id: "eligibility-proof-category",
          name: "Applicable Eligibility Category Proof (Any One)",
          required: true,
          description: "One qualifying document from: BPL Ration Card, NFSA Ration Card, e-Shram Card, PM-JAY Card, MGNREGA Job Card, PM-KISAN passbook, SC/ST Certificate, Disability Certificate, or self-declaration of family income below applicable ceiling.",
          issuingAuthority: "Competent Central / State Authority",
        },
        {
          id: "child-birth-immunization",
          name: "Child Birth Certificate and Immunization Record",
          required: false,
          description: "Required for claiming the second installment (first child) or the single installment for a second girl child.",
          issuingAuthority: "Registrar of Births & Deaths / Healthcare Facility",
        },
      ],
      actions: [
        {
          id: "action-pmmvy-awc",
          title: "Contact Local ASHA or Anganwadi Worker (AWC)",
          description: "Visit your local Anganwadi Centre (AWC) or connect with your community ASHA/AWW for registration assistance and enrollment on the PMMVYSoft portal.",
          actionType: "CONTACT_ASHA",
          priority: "HIGH",
        },
        {
          id: "action-pmmvy-portal",
          title: "Official PMMVY Portal (Government of India)",
          description: "Access the official Ministry of Women and Child Development portal for scheme guidelines and citizen services: https://pmmvy.wcd.gov.in.",
          actionType: "APPLY_ONLINE",
          priority: "MEDIUM",
        },
      ],
      currentVersion: "2026.2",
      sourceMetadata: {
        sourceOrganization: "Ministry of Women and Child Development (MWCD), Government of India",
        officialTitle: "Pradhan Mantri Matru Vandana Yojana (PMMVY) 2.0 Operational Guidelines & FAQs",
        sourceUrl: "https://pmmvy.wcd.gov.in",
        sourceCitation: "Mission Shakti Scheme Guidelines (MWCD, Govt of India) & Official PMMVY FAQs: Revised Maternity Benefit Program under Mission Shakti (SAMARTHYA).",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Authoritative PMMVY 2.0 parameters verified against official MWCD portal and FAQs. Husband Aadhaar requirement removed. ₹5,000 for 1st child (₹3,000 + ₹2,000) and ₹6,000 for 2nd girl child via DBT. Odisha and Telangana operate separate state schemes.",
        sourceName: "Ministry of Women and Child Development (MWCD) Official PMMVY Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
    version: {
      id: "ver_pmmvy_2026_2",
      schemeId: "pmmvy",
      version: "2026.2",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
      ruleSet: {
        id: "ruleset_pmmvy_2026_2",
        name: "PMMVY Maternity Benefit and Category Verification Criteria 2026",
        combination: "ALL",
        rules: [
          {
            id: "rule_pmmvy_maternal_status",
            name: "Maternal Status Criterion",
            description: "Household must include a member recorded as pregnant or lactating",
            scope: "MEMBER",
            field: "maternalStatus",
            operator: "MEMBER_FIELD_IN",
            value: ["pregnant", "lactating"],
            requiredField: true,
            isVerifiedRule: true,
            sourceEvidence: "PMMVY 2.0 Guidelines Sec 3.1: Maternity support for pregnant women and lactating mothers.",
            pathwayCode: "PMMVY-MATERNAL-STATUS",
            explanations: {
              matched: "A household member is recorded as pregnant or lactating, satisfying the primary maternal status condition for PMMVY.",
              failed: "No household member is currently recorded as pregnant or lactating for PMMVY maternity benefits.",
              missing: "Maternal status (pregnancy or lactation) is required to check PMMVY maternity benefits.",
            },
          },
          {
            id: "rule_pmmvy_category_verification",
            name: "PMMVY Beneficiary Category and Birth Order Verification",
            description: "Verification of qualifying disadvantaged category (BPL/NFSA ration card, e-Shram, PM-JAY, MGNREGA, SC/ST, disability, etc.) and birth order (1st child or 2nd girl child). Regular central/state/PSU employees receiving paid maternity benefits are excluded.",
            scope: "HOUSEHOLD",
            field: "pmmvyCategoryVerified",
            operator: "FIELD_EQUALS",
            value: true,
            requiredField: true,
            isVerifiedRule: true,
            sourceEvidence: "PMMVY 2.0 Guidelines Sec 3.2 & Official FAQ: Benefit is conditional on qualifying category and birth order.",
            pathwayCode: "PMMVY-CATEGORY-VERIFICATION",
            explanations: {
              matched: "Official PMMVY eligibility category and birth order verified.",
              failed: "Beneficiary does not belong to a qualifying category or is an employee receiving paid maternity leave.",
              missing: "To evaluate personal PMMVY eligibility, official verification of your qualifying category (e.g. BPL, e-Shram, PM-JAY, MGNREGA, or SC/ST) and whether this is for a first child or second girl child is required. SwasthyaSetu does not assume eligibility without category verification.",
            },
          },
        ],
      },
      requiredDocuments: [
        {
          id: "aadhaar-mother",
          name: "Aadhaar Card of the Beneficiary (Mother)",
          required: true,
          description: "Primary identity document of the mother. Note: Under official PMMVY 2.0 rules, husband's Aadhaar is explicitly not mandatory.",
          issuingAuthority: "UIDAI",
        },
        {
          id: "mobile-number-mother",
          name: "Beneficiary Mobile Number",
          required: true,
          description: "Active mobile number linked with Aadhaar for registration, OTP verification, and status updates.",
          issuingAuthority: "Telecom Service Provider",
        },
        {
          id: "mcp-card",
          name: "Mother and Child Protection (MCP) Card / RCHI Card",
          required: true,
          description: "Antenatal checkup record, LMP date, and child immunization history issued by health center/Anganwadi.",
          issuingAuthority: "National Health Mission / MoHFW",
        },
        {
          id: "bank-account-dbt",
          name: "Mother's Aadhaar-Seeded Bank / Post Office Account",
          required: true,
          description: "Active single bank or post office account seeded with Aadhaar for Direct Benefit Transfer.",
          issuingAuthority: "Scheduled Commercial Bank / India Post Payments Bank",
        },
        {
          id: "eligibility-proof-category",
          name: "Applicable Eligibility Category Proof (Any One)",
          required: true,
          description: "One qualifying document from: BPL Ration Card, NFSA Ration Card, e-Shram Card, PM-JAY Card, MGNREGA Job Card, PM-KISAN passbook, SC/ST Certificate, Disability Certificate, or self-declaration of family income below applicable ceiling.",
          issuingAuthority: "Competent Central / State Authority",
        },
        {
          id: "child-birth-immunization",
          name: "Child Birth Certificate and Immunization Record",
          required: false,
          description: "Required for claiming the second installment (first child) or the single installment for a second girl child.",
          issuingAuthority: "Registrar of Births & Deaths / Healthcare Facility",
        },
      ],
      actions: [
        {
          id: "action-pmmvy-awc",
          title: "Contact Local ASHA or Anganwadi Worker (AWC)",
          description: "Visit your local Anganwadi Centre (AWC) or connect with your community ASHA/AWW for registration assistance and enrollment on the PMMVYSoft portal.",
          actionType: "CONTACT_ASHA",
          priority: "HIGH",
        },
        {
          id: "action-pmmvy-portal",
          title: "Official PMMVY Portal (Government of India)",
          description: "Access the official Ministry of Women and Child Development portal for scheme guidelines and citizen services: https://pmmvy.wcd.gov.in.",
          actionType: "APPLY_ONLINE",
          priority: "MEDIUM",
        },
      ],
      sourceMetadata: {
        sourceOrganization: "Ministry of Women and Child Development (MWCD), Government of India",
        officialTitle: "Pradhan Mantri Matru Vandana Yojana (PMMVY) 2.0 Operational Guidelines & FAQs",
        sourceUrl: "https://pmmvy.wcd.gov.in",
        sourceCitation: "Mission Shakti Scheme Guidelines (MWCD, Govt of India) & Official PMMVY FAQs: Revised Maternity Benefit Program under Mission Shakti (SAMARTHYA).",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: true,
        verificationNotes: "Authoritative PMMVY 2.0 parameters verified against official MWCD portal and FAQs. Husband Aadhaar requirement removed. ₹5,000 for 1st child (₹3,000 + ₹2,000) and ₹6,000 for 2nd girl child via DBT. Odisha and Telangana operate separate state schemes.",
        sourceName: "Ministry of Women and Child Development (MWCD) Official PMMVY Guidelines",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
  },
];

/**
 * ==============================================================================
 * DEVELOPMENT FIXTURE SCHEMES (DRAFT / UNSUPPORTED PLACEHOLDERS)
 * Used strictly for developmental testing. Marked DRAFT and excluded from
 * citizen-facing active eligibility evaluations until verified state legislation exists.
 * ==============================================================================
 */
export const DEVELOPMENT_FIXTURE_SCHEMES: Array<{ scheme: Scheme; version: SchemeVersion }> = [
  // Generic State Health Assurance Template
  {
    scheme: {
      id: "state-health-assurance",
      name: "State Universal Health Assurance Program (Template)",
      shortName: "State Health Assurance",
      description: "State-sponsored health assurance model template pending specific state legislation integration.",
      category: "STATE",
      level: "STATE",
      status: "DRAFT", // Explicitly DRAFT — not active in citizen production
      authority: "State Department of Health and Family Welfare (Template)",
      benefitSummary: "Cashless tertiary care, critical illness coverage, and diagnostic support across state network hospitals.",
      eligibilitySummary: "Residents of participating states with valid state ration identification.",
      requiredDocuments: [],
      actions: [],
      currentVersion: "2026.1",
      sourceMetadata: {
        sourceOrganization: "State Department of Health (Generic Template)",
        officialTitle: "Generic State Universal Health Assurance Model (Development Fixture)",
        sourceUrl: "", // Empty source URL strictly marks this as unverified
        sourceCitation: "Unverified developmental placeholder — pending state-specific legislation integration",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false,
        verificationNotes: "Placeholder development fixture. Lacks authoritative government source URL. Marked as DRAFT and strictly excluded from active citizen eligibility results.",
        sourceName: "Generic State Health Agency Model",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    version: {
      id: "ver_statehealth_2026_1",
      schemeId: "state-health-assurance",
      version: "2026.1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "DRAFT",
      ruleSet: {
        id: "ruleset_statehealth_2026_1",
        name: "State Residency Criteria 2026 (Unverified Draft)",
        combination: "ALL",
        rules: [
          {
            id: "rule_state_residency",
            name: "Participating State Residence",
            description: "Household must be resident in a participating state",
            scope: "HOUSEHOLD",
            field: "state",
            operator: "FIELD_IN",
            value: ["Bihar", "Karnataka", "Maharashtra", "Tamil Nadu", "Rajasthan", "Delhi"],
            requiredField: true,
            isVerifiedRule: false,
            explanations: {
              matched: "Your state of residence is supported by universal health assurance.",
              failed: "State health assurance is available for residents of participating states.",
              missing: "Household state location is required to evaluate state health assurance.",
            },
          },
        ],
      },
      requiredDocuments: [],
      actions: [],
      sourceMetadata: {
        sourceOrganization: "State Department of Health (Generic Template)",
        officialTitle: "Generic State Universal Health Assurance Model (Development Fixture)",
        sourceUrl: "",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false,
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  },

  // Janani Shishu Suraksha Karyakram (JSSK) — DRAFT Placeholder
  {
    scheme: {
      id: "jssk",
      name: "Janani Shishu Suraksha Karyakram",
      shortName: "JSSK",
      description: "Entitles all pregnant women delivering in public health institutions to absolutely free and no-expense delivery, including Caesarean section.",
      category: "MATERNAL",
      level: "CENTRAL",
      status: "DRAFT", // DRAFT — pending clinical facility intake integration
      authority: "Ministry of Health and Family Welfare (MoHFW), Government of India",
      benefitSummary: "Completely free and cashless delivery and newborn care in public health facilities.",
      eligibilitySummary: "Pregnant women and sick infants accessing public health institutions.",
      requiredDocuments: [],
      actions: [],
      currentVersion: "2026.1",
      sourceMetadata: {
        sourceOrganization: "Ministry of Health and Family Welfare (MoHFW), Government of India",
        officialTitle: "Janani Shishu Suraksha Karyakram (JSSK) National Operational Guidelines",
        sourceUrl: "https://nhm.gov.in",
        sourceCitation: "JSSK Guidelines: Free entitlements for pregnant women delivering in public health institutions.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false, // DRAFT until institutional delivery facility intake is active
        verificationNotes: "Draft placeholder — requires clinical health facility delivery admission records.",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    version: {
      id: "ver_jssk_2026_1",
      schemeId: "jssk",
      version: "2026.1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "DRAFT",
      ruleSet: {
        id: "ruleset_jssk_2026_1",
        name: "JSSK Public Facility Delivery Criteria (Draft)",
        combination: "ALL",
        rules: [
          {
            id: "rule_jssk_public_facility",
            name: "Public Health Institution Delivery",
            description: "Delivery conducted at a public health institution (PHC/CHC/District Hospital)",
            scope: "HOUSEHOLD",
            field: "publicInstitutionDelivery",
            operator: "FIELD_EQUALS",
            value: true,
            requiredField: true,
            isVerifiedRule: false,
            explanations: {
              matched: "Public health institution delivery verified for JSSK zero-expense benefits.",
              failed: "JSSK applies to pregnant women and sick neonates utilizing government public health facilities.",
              missing: "Public health facility delivery confirmation is required for JSSK.",
            },
          },
        ],
      },
      requiredDocuments: [],
      actions: [],
      sourceMetadata: {
        sourceOrganization: "Ministry of Health and Family Welfare (MoHFW)",
        officialTitle: "JSSK Guidelines",
        sourceUrl: "https://nhm.gov.in",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false,
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  },

  // Ayushman Bharat – Arogya Karnataka (AB-ArK) — DRAFT Placeholder
  {
    scheme: {
      id: "ab-ark-karnataka",
      name: "Ayushman Bharat – Arogya Karnataka",
      shortName: "AB-ArK",
      description: "Integrated co-branded health assurance scheme implemented in Karnataka by Suvarna Arogya Suraksha Trust (SAST).",
      category: "STATE",
      level: "STATE",
      status: "DRAFT", // DRAFT — pending Karnataka state portal integration
      authority: "Suvarna Arogya Suraksha Trust (SAST), Government of Karnataka",
      state: "Karnataka",
      benefitSummary: "Up to ₹5,00,000 yearly tertiary healthcare cover for eligible BPL/AAY families and ₹1,50,000 for general category in Karnataka.",
      eligibilitySummary: "Karnataka residents holding valid state ration cards (Eligible / General categories).",
      requiredDocuments: [],
      actions: [],
      currentVersion: "2026.1",
      sourceMetadata: {
        sourceOrganization: "Suvarna Arogya Suraksha Trust (SAST), Government of Karnataka",
        officialTitle: "Ayushman Bharat – Arogya Karnataka Scheme Guidelines",
        sourceUrl: "https://arogya.karnataka.gov.in",
        sourceCitation: "SAST Operational Framework: Co-branded PM-JAY and State healthcare assurance.",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false, // DRAFT until Karnataka specific ration card category integration
        verificationNotes: "Draft placeholder — pending Karnataka state category rules integration.",
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    version: {
      id: "ver_abark_2026_1",
      schemeId: "ab-ark-karnataka",
      version: "2026.1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      status: "DRAFT",
      ruleSet: {
        id: "ruleset_abark_2026_1",
        name: "AB-ArK Karnataka Residency and Category Criteria (Draft)",
        combination: "ALL",
        rules: [
          {
            id: "rule_abark_state",
            name: "Karnataka Domicile",
            description: "Household must be resident in Karnataka",
            scope: "HOUSEHOLD",
            field: "state",
            operator: "FIELD_EQUALS",
            value: "Karnataka",
            requiredField: true,
            isVerifiedRule: false,
            explanations: {
              matched: "Karnataka state domicile verified.",
              failed: "AB-ArK is specifically for residents of Karnataka.",
              missing: "State location is required.",
            },
          },
        ],
      },
      requiredDocuments: [],
      actions: [],
      sourceMetadata: {
        sourceOrganization: "Suvarna Arogya Suraksha Trust (SAST)",
        officialTitle: "AB-ArK Guidelines",
        sourceUrl: "https://arogya.karnataka.gov.in",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        isVerified: false,
      },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  },
];

/**
 * All seedable schemes (combines verified production with development fixtures)
 */
export const ALL_SEED_SCHEMES_DATA = [
  ...VERIFIED_PRODUCTION_SCHEMES,
  ...DEVELOPMENT_FIXTURE_SCHEMES,
];

/**
 * Idempotently seeds the scheme registry into the repository
 * Only verified schemes will have status === "ACTIVE"
 */
export async function seedSchemeRegistry(
  repo: SchemeRepository,
  includeFixtures = true
): Promise<{ count: number; verifiedCount: number; draftCount: number }> {
  const dataset = includeFixtures ? ALL_SEED_SCHEMES_DATA : VERIFIED_PRODUCTION_SCHEMES;
  let verifiedCount = 0;
  let draftCount = 0;

  for (const item of dataset) {
    await repo.createScheme(item.scheme);
    await repo.createSchemeVersion(item.scheme.id, item.version);
    if (item.scheme.status === "ACTIVE" && item.version.sourceMetadata.isVerified) {
      verifiedCount++;
    } else {
      draftCount++;
    }
  }

  return { count: dataset.length, verifiedCount, draftCount };
}
