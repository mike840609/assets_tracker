import { describe, expect, it } from "vitest";
import { getAppAssetUrl, getAppUrl } from "@/lib/app-url";

describe("app URL helpers", () => {
  it("uses the production URL when no override is provided", () => {
    expect(getAppUrl("").toString()).toBe("https://astt.app/");
  });

  it("uses a self-hoster's configured URL", () => {
    expect(getAppUrl("https://tracker.example.com").toString()).toBe(
      "https://tracker.example.com/",
    );
  });

  it("uses the current Vercel deployment for preview-only assets", () => {
    expect(
      getAppAssetUrl("/landing/social-preview.png", {
        vercelEnv: "preview",
        vercelUrl: "asset-tracker-preview.vercel.app",
        appUrl: "https://astt.app",
      }).toString(),
    ).toBe("https://asset-tracker-preview.vercel.app/landing/social-preview.png");
  });

  it("keeps production assets on the canonical app URL", () => {
    expect(
      getAppAssetUrl("/landing/social-preview.png", {
        vercelEnv: "production",
        vercelUrl: "asset-tracker-production.vercel.app",
        appUrl: "https://astt.app",
      }).toString(),
    ).toBe("https://astt.app/landing/social-preview.png");
  });
});
