import { describe, expect, it } from "vitest";
import { getLocaleDefaultCurrency } from "@/lib/currencies";
import { SUPPORTED_LOCALES } from "@/i18n/config";

describe("getLocaleDefaultCurrency", () => {
  it.each([
    ["en-US", "USD"],
    ["zh-CN", "CNY"],
    ["zh-TW", "TWD"],
  ] as const)("maps %s to %s", (locale, expectedCurrency) => {
    expect(getLocaleDefaultCurrency(locale)).toBe(expectedCurrency);
  });

  it("covers every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getLocaleDefaultCurrency(locale)).toMatch(/^[A-Z]{3}$/);
    }
  });
});
