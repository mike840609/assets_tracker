import { describe, expect, it } from "vitest";
import { detectLocaleFromAcceptLanguage } from "@/i18n/config";

describe("detectLocaleFromAcceptLanguage", () => {
  it.each([
    ["zh-TW,zh;q=0.9,en-US;q=0.8", "zh-TW"],
    ["en-US,en;q=0.9,zh-TW;q=0.8", "en-US"],
    ["en-US,zh-TW;q=0.9", "en-US"],
    ["en-US;q=0.7,zh-TW;q=0.9", "zh-TW"],
    ["zh-TW;q=0,en-US;q=0.5", "en-US"],
    ["fr-FR,ja;q=0.9", "en-US"],
    ["", "en-US"],
  ])("resolves %s to %s", (acceptLanguage, expectedLocale) => {
    expect(detectLocaleFromAcceptLanguage(acceptLanguage)).toBe(expectedLocale);
  });
});
