import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{[a-zA-Z0-9_]+(?=[,}])/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1)))).sort();
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function isObject(val: unknown): val is JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

describe("i18n translation parity", () => {
  const enPath = resolve(process.cwd(), "messages/en-US.json");
  const twPath = resolve(process.cwd(), "messages/zh-TW.json");

  const en = JSON.parse(readFileSync(enPath, "utf8")) as JsonObject;
  const tw = JSON.parse(readFileSync(twPath, "utf8")) as JsonObject;

  function compareKeys(
    objA: JsonObject,
    objB: JsonObject,
    prefix = "",
    nameA = "en-US",
    nameB = "zh-TW",
  ) {
    for (const key of Object.keys(objA)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      expect(objB, `Missing key "${fullPath}" in ${nameB}`).toHaveProperty(key);

      const valA = objA[key];
      const valB = objB[key];

      if (isObject(valA) && isObject(valB)) {
        compareKeys(valA, valB, fullPath, nameA, nameB);
      } else if (typeof valA === "string" && typeof valB === "string") {
        const placeholdersA = extractPlaceholders(valA);
        const placeholdersB = extractPlaceholders(valB);
        expect(
          placeholdersB,
          `Mismatched placeholders for "${fullPath}": ${nameA} has [${placeholdersA.join(", ")}], but ${nameB} has [${placeholdersB.join(", ")}]`,
        ).toEqual(placeholdersA);
      }
    }
  }

  it("ensures all en-US keys and placeholders exist in zh-TW", () => {
    compareKeys(en, tw, "", "en-US", "zh-TW");
  });

  it("ensures all zh-TW keys exist in en-US (no orphan keys)", () => {
    compareKeys(tw, en, "", "zh-TW", "en-US");
  });
});
