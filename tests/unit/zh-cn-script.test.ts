import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG } from "@/lib/changelog";

/**
 * Characters that exist only in Traditional Chinese. Simplified copy should
 * never contain them; the zh-TW language label is the one intentional
 * exception because it names that variant in its own script.
 */
const TRADITIONAL_ONLY =
  /[這裡與這個們為說對時間開關變點選設資產負債帳戶幣匯報價歷據屬於應當後來麼樣進過還邊讓覺實際錯誤確認許計標籤記錄項類別總結餘儲稅費單買賣賺賠漲損續約數據網頁載覽訊軟體裝門業務員鍵碼顯圖簽會斷隨傳輸統級給從見觀證環節線準複製張貼刪壓檔夾連結視螢盤擊鈕]/;

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findTraditionalChars(value: JsonValue, path = "", violations: string[] = []): string[] {
  if (typeof value === "string") {
    const match = value.match(TRADITIONAL_ONLY);
    if (match) violations.push(`${path}: ${match[0]}`);
    return violations;
  }

  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      findTraditionalChars(child, path ? `${path}.${key}` : key, violations);
    }
  }

  return violations;
}

describe("Simplified Chinese copy", () => {
  it("uses no Traditional-only characters in messages/zh-CN.json", () => {
    const messages = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages/zh-CN.json"), "utf8"),
    ) as JsonObject;

    // The zh-TW language label intentionally renders in Traditional Chinese.
    const { languages, ...rest } = messages;
    expect(languages).toBeDefined();

    const violations = findTraditionalChars(rest);
    expect(violations).toEqual([]);
  });

  it("uses no Traditional-only characters in changelog zh-CN text", () => {
    const violations: string[] = [];

    const inspect = (text: unknown, label: string) => {
      if (!isObject(text) || typeof text["zh-CN"] !== "string") return;
      const match = text["zh-CN"].match(TRADITIONAL_ONLY);
      if (match) violations.push(`${label}: ${match[0]}`);
    };

    for (const release of CHANGELOG) {
      inspect(release.summary, `${release.version} summary`);
      release.changes.forEach((change, index) => {
        inspect(change.text, `${release.version} change ${index + 1}`);
      });
    }

    expect(violations).toEqual([]);
  });
});
