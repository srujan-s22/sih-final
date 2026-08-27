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
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
