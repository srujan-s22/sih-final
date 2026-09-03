import * as admin from "firebase-admin";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SchemeRepository } from "../src/repositories/scheme.repository.js";
import { seedSchemeRegistry } from "../src/services/eligibility/scheme-seed.js";

async function runSeed() {
  console.log("Seeding verified healthcare schemes to Cloud Firestore...");

  const defaultCredPath = path.join(
    os.homedir(),
    ".config",
    "swasthyaSetu",
    "firebase-service-account.json"
  );
  const resolvedCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredPath;

  if (!fs.existsSync(resolvedCredPath)) {
    throw new Error(`Credentials not found at ${resolvedCredPath}`);
  }

  const rawJson = fs.readFileSync(resolvedCredPath, "utf-8");
  const serviceAccount = JSON.parse(rawJson);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "swasthyasetu-efd78",
    });
  }

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const repo = new SchemeRepository(db);
  const result = await seedSchemeRegistry(repo);

  console.log(`Successfully seeded ${result.count} verified healthcare schemes into Cloud Firestore.`);

  // Seed verified official evidence records
  const evidenceBatch = db.batch();
  const evidenceCollection = db.collection("evidence");

  const verifiedEvidenceRecords = [
    {
      id: "ev_pmmvy_guidelines_2026",
      schemeId: "pmmvy",
      schemeVersionId: "ver_pmmvy_2026_2",
      claim: "PMMVY 2.0 provides maternity benefit of ₹5,000 for 1st child (₹3,000 + ₹2,000) and ₹6,000 for 2nd girl child via DBT to Aadhaar-seeded accounts with no mandatory husband Aadhaar",
      query: "PMMVY 2.0 operational guidelines MWCD government of india",
      queryHash: "qhash_pmmvy_guidelines_2026",
      sourceDomain: "pmmvy.wcd.gov.in",
      officialTitle: "Pradhan Mantri Matru Vandana Yojana (PMMVY) 2.0 Operational Guidelines & FAQs",
      sourceOrganization: "Ministry of Women and Child Development (MWCD), Government of India",
      sourceUrl: "https://pmmvy.wcd.gov.in",
      sourceType: "OFFICIAL_GOVERNMENT",
      documentType: "GUIDELINE",
      relevantExcerpt: "Under PMMVY 2.0 (Mission Shakti), maternity benefit is ₹5,000 in two installments for the first living child, and ₹6,000 in a single installment for a second child if girl. Deposited directly to mother's Aadhaar-seeded bank/post-office account. Mandatory requirement of husband's Aadhaar has been removed. Odisha and Telangana operate separate state maternity schemes.",
      retrievedAt: "2026-08-01T00:00:00.000Z",
      verificationStatus: "VERIFIED",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      verifiedBy: "system-seed",
      contentHash: "chash_pmmvy_guidelines_2026",
      discoveredBy: "AUTHORITATIVE_SOURCE_AUDIT",
      authorityScore: 100,
      relevanceScore: 100,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "ev_jsy_guidelines_2026",
      schemeId: "jsy",
      schemeVersionId: "ver_jsy_2026_2",
      claim: "Janani Suraksha Yojana provides cash assistance for institutional delivery to promote safe motherhood",
      query: "Janani Suraksha Yojana guidelines NHM MoHFW",
      queryHash: "qhash_jsy_guidelines_2026",
      sourceDomain: "nhm.gov.in",
      officialTitle: "Janani Suraksha Yojana (JSY) Operational Guidelines",
      sourceOrganization: "Ministry of Health and Family Welfare (MoHFW), Government of India",
      sourceUrl: "https://nhm.gov.in",
      sourceType: "OFFICIAL_GOVERNMENT",
      documentType: "GUIDELINE",
      relevantExcerpt: "JSY provides direct cash assistance to poor pregnant women delivering in accredited government or private healthcare institutions.",
      retrievedAt: "2026-08-01T00:00:00.000Z",
      verificationStatus: "VERIFIED",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      verifiedBy: "system-seed",
      contentHash: "chash_jsy_guidelines_2026",
      discoveredBy: "AUTHORITATIVE_SOURCE_AUDIT",
      authorityScore: 100,
      relevanceScore: 100,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "ev_abpmjay_guidelines_2026",
      schemeId: "ab-pmjay",
      schemeVersionId: "ver_abpmjay_2026_2",
      claim: "AB-PMJAY provides ₹5 lakh cashless secondary and tertiary hospitalization cover including universal 70+ Senior Citizen pathway",
      query: "Ayushman Bharat PMJAY 70+ guidelines NHA",
      queryHash: "qhash_abpmjay_guidelines_2026",
      sourceDomain: "pmjay.gov.in",
      officialTitle: "NHA Operational Guidelines for Universal AB PM-JAY 70+ Coverage",
      sourceOrganization: "National Health Authority (NHA), Ministry of Health and Family Welfare",
      sourceUrl: "https://pmjay.gov.in",
      sourceType: "OFFICIAL_GOVERNMENT",
      documentType: "GUIDELINE",
      relevantExcerpt: "Universal health coverage up to ₹5 lakh per year for all senior citizens aged 70 and above irrespective of income under Ayushman Bharat PM-JAY.",
      retrievedAt: "2026-08-01T00:00:00.000Z",
      verificationStatus: "VERIFIED",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      verifiedBy: "system-seed",
      contentHash: "chash_abpmjay_guidelines_2026",
      discoveredBy: "AUTHORITATIVE_SOURCE_AUDIT",
      authorityScore: 100,
      relevanceScore: 100,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ];

  for (const ev of verifiedEvidenceRecords) {
    evidenceBatch.set(evidenceCollection.doc(ev.id), ev, { merge: true });
  }
  await evidenceBatch.commit();
  console.log(`Successfully seeded ${verifiedEvidenceRecords.length} verified evidence records into Cloud Firestore.`);
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
