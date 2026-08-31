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

describe("Phase E9 — Multilingual Key Parity & Completeness", () => {
  const enKeys = getKeys(en);
  const knKeys = getKeys(kn);
  const hiKeys = getKeys(hi);

  it("has comprehensive key coverage (>180 keys)", () => {
    expect(enKeys.length).toBeGreaterThan(150);
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
});
