import { describe, it, expect } from "vitest";
import { en } from "../../frontend/i18n/translations/en";
import { kn } from "../../frontend/i18n/translations/kn";
import { hi } from "../../frontend/i18n/translations/hi";

function getKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

import * as fs from "fs";
import * as path from "path";

function resolveKey(dict: any, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: any = dict;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

function walk(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "dist") {
        walk(filePath, fileList);
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      if (!filePath.includes("frontend/i18n/translations")) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

describe("Phase E9 — Multilingual Key Parity & Completeness", () => {
  const enKeys = getKeys(en);
  const knKeys = getKeys(kn);
  const hiKeys = getKeys(hi);

  it("has comprehensive key coverage (>450 keys)", () => {
    expect(enKeys.length).toBeGreaterThan(450);
  });

  it("guarantees 100% key parity between English and Kannada", () => {
    const missingInKn = enKeys.filter((k) => !knKeys.includes(k));
    expect(missingInKn).toEqual([]);
  });

  it("guarantees 100% key parity between English and Hindi", () => {
    const missingInHi = enKeys.filter((k) => !hiKeys.includes(k));
    expect(missingInHi).toEqual([]);
  });

  it("contains non-empty translated strings in all languages", () => {
    for (const key of enKeys) {
      const parts = key.split(".");
      let valEn = en as any;
      let valKn = kn as any;
      let valHi = hi as any;
      for (const p of parts) {
        valEn = valEn[p];
        valKn = valKn[p];
        valHi = valHi[p];
      }
      expect(typeof valEn).toBe("string");
      expect(valEn.trim().length).toBeGreaterThan(0);
      expect(typeof valKn).toBe("string");
      expect(valKn.trim().length).toBeGreaterThan(0);
      expect(typeof valHi).toBe("string");
      expect(valHi.trim().length).toBeGreaterThan(0);
    }
  });

  it("ensures every t(...) key called across frontend components exists in all dictionaries and never renders raw keys", () => {
    const frontendDir = path.resolve(__dirname, "../../frontend");
    const frontendFiles = walk(frontendDir);
    expect(frontendFiles.length).toBeGreaterThan(10);

    const tRegex = /\bt\(\s*["\x27`]([a-zA-Z0-9_.-]+)["\x27`]/g;
    const missingInEn: { key: string; file: string }[] = [];
    const rawRenderedKeys: { key: string; lang: string }[] = [];

    for (const file of frontendFiles) {
      const content = fs.readFileSync(file, "utf-8");
      let match;
      while ((match = tRegex.exec(content)) !== null) {
        const key = match[1];
        const resEn = resolveKey(en, key);
        const resKn = resolveKey(kn, key);
        const resHi = resolveKey(hi, key);

        if (!resEn) {
          missingInEn.push({ key, file: path.basename(file) });
        }
        if (resEn === key) {
          rawRenderedKeys.push({ key, lang: "en" });
        }
        if (resKn === key) {
          rawRenderedKeys.push({ key, lang: "kn" });
        }
        if (resHi === key) {
          rawRenderedKeys.push({ key, lang: "hi" });
        }
      }
    }

    expect(missingInEn).toEqual([]);
    expect(rawRenderedKeys).toEqual([]);
  });

  it("verifies resolution of representative keys across every namespace in EN, KN, and HI", () => {
    const representativeKeys = [
      "common.save",
      "navigation.caseload",
      "home.trustEvidenceTitle",
      "auth.forgotPassword",
      "citizen.pregnantTag",
      "citizen.seniorCitizenTag",
      "asha.caseloadTitle",
      "asha.totalAssignedHouseholds",
      "admin.activeAshas",
      "forms.priorityHigh",
      "status.verified",
      "voice.helplineTitle",
      "assistant.badge",
      "errors.caseNotFound",
      "dialogs.removeMemberConfirm",
    ];

    for (const key of representativeKeys) {
      const valEn = resolveKey(en, key);
      const valKn = resolveKey(kn, key);
      const valHi = resolveKey(hi, key);

      expect(valEn).toBeDefined();
      expect(valKn).toBeDefined();
      expect(valHi).toBeDefined();

      // Ensure never equals raw key string
      expect(valEn).not.toBe(key);
      expect(valKn).not.toBe(key);
      expect(valHi).not.toBe(key);

      // Verify specific user-reported translations
      if (key === "citizen.pregnantTag") {
        expect(valEn).toBe("Pregnant");
        expect(valKn).toBe("ಗರ್ಭಿಣಿ");
        expect(valHi).toBe("गर्भवती");
      }
      if (key === "auth.forgotPassword") {
        expect(valEn).toBe("Forgot password?");
        expect(valKn).toBe("ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?");
        expect(valHi).toBe("पासवर्ड भूल गए?");
      }
      if (key === "asha.caseloadTitle") {
        expect(valEn).toBe("ASHA Caseload");
        expect(valKn).toBe("ಆಶಾ ಕೇಸ್‌ಲೋಡ್");
        expect(valHi).toBe("आशा केसलोड");
      }
      if (key === "asha.totalAssignedHouseholds") {
        expect(valEn).toBe("Total Assigned Households");
        expect(valKn).toBe("ಒಟ್ಟು ನಿಗದಿಪಡಿಸಿದ ಕುಟುಂಬಗಳು");
        expect(valHi).toBe("कुल आवंटित परिवार");
      }
    }
  });
});
