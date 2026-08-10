import { describe, expect, it } from "vitest";
import { isStandalonePwa, shouldOfferPwaInstall } from "@/lib/pwa-install-status";

describe("isStandalonePwa", () => {
  it("detects display-mode standalone", () => {
    expect(
      isStandalonePwa({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
  });

  it("detects legacy iOS standalone", () => {
    expect(
      isStandalonePwa({
        displayModeStandalone: false,
        navigatorStandalone: true,
      }),
    ).toBe(true);
  });

  it("returns false for a normal browser tab", () => {
    expect(
      isStandalonePwa({
        displayModeStandalone: false,
        navigatorStandalone: false,
      }),
    ).toBe(false);
  });
});

describe("shouldOfferPwaInstall", () => {
  const androidChrome =
    "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36";

  it("offers install on Android when an install prompt is available", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent: androidChrome,
        isStandalone: false,
        wasDismissed: false,
        hasInstallPrompt: true,
      }),
    ).toBe(true);
  });

  it("does not offer install when already standalone", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent: androidChrome,
        isStandalone: true,
        wasDismissed: false,
        hasInstallPrompt: true,
      }),
    ).toBe(false);
  });

  it("does not offer install on iOS Safari", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        isStandalone: false,
        wasDismissed: false,
        hasInstallPrompt: true,
      }),
    ).toBe(false);
  });

  it("does not offer install on desktop Chrome", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
        isStandalone: false,
        wasDismissed: false,
        hasInstallPrompt: true,
      }),
    ).toBe(false);
  });

  it("does not offer install after dismissal", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent: androidChrome,
        isStandalone: false,
        wasDismissed: true,
        hasInstallPrompt: true,
      }),
    ).toBe(false);
  });

  it("does not offer install without a browser install event", () => {
    expect(
      shouldOfferPwaInstall({
        userAgent: androidChrome,
        isStandalone: false,
        wasDismissed: false,
        hasInstallPrompt: false,
      }),
    ).toBe(false);
  });
});
