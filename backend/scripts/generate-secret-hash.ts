import { hashSecret } from "../src/utils/secret-hash.js";

const args = process.argv.slice(2);
const secret = args[0];

if (!secret) {
  console.log("Usage: npx tsx scripts/generate-secret-hash.ts <secret_code>");
  console.log("Example: npx tsx scripts/generate-secret-hash.ts MySecretCode123");
  process.exit(1);
}

const hash = hashSecret(secret);
console.log("==================================================");
console.log("SWASTHYASETU PRIVILEGED REGISTRATION SECRET HASH");
console.log("==================================================");
console.log("Secret Length:", secret.length, "characters");
console.log("SHA-256 Hash :", hash);
console.log("\nTo configure in backend/.env:");
console.log(`ASHA_REGISTRATION_SECRET_HASH=${hash}`);
console.log("or");
console.log(`ADMIN_REGISTRATION_SECRET_HASH=${hash}`);
console.log("==================================================");
