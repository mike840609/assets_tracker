import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldShowSafariPwaHint } from "@/lib/pwa-install-hint";

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const base = {
  userAgent: iphoneSafari,
  platform: "iPhone",
  maxTouchPoints: 5,
  isStandalone: false,
  hasBeenShown: false,
};

describe("shouldShowSafariPwaHint", () => {
  it("shows on iPhone Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(true);
  });

  it("shows on iPhone Firefox", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/142.0 Mobile/15E148 Safari/605.1.15",
      }),
    ).toBe(true);
  });

  it("shows on iPhone Brave", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1 Brave/1.90",
      }),
    ).toBe(true);
  });

  it("does not show on iPhone Safari", () => {
    expect(shouldShowSafariPwaHint(base)).toBe(false);
  });

  it("does not show on Android Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "Linux armv8l",
        userAgent:
          "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
      }),
    ).toBe(false);
  });

  it("does not show on desktop Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "MacIntel",
        maxTouchPoints: 0,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      }),
    ).toBe(false);
  });

  it("shows for iPadOS desktop-style user agent in a non-Safari browser", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "MacIntel",
        maxTouchPoints: 5,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 CriOS/140.0.0.0 Version/18.0 Safari/605.1.15",
      }),
    ).toBe(true);
  });

  it("does not show in standalone mode", () => {
    expect(shouldShowSafariPwaHint({ ...base, isStandalone: true })).toBe(false);
  });

  it("does not show after the hint has already been shown", () => {
    expect(shouldShowSafariPwaHint({ ...base, hasBeenShown: true })).toBe(false);
  });
});

describe("PwaInstallHint toast behavior", () => {
  it("stays visible until the user closes it", () => {
    const source = readFileSync("src/components/layout/pwa-install-hint.tsx", "utf8");

    expect(source).toContain("duration: Number.POSITIVE_INFINITY");
    expect(source).toContain("closeButton: true");
  });
});
