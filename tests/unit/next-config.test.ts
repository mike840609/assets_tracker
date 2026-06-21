import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Sentry tunnel configuration", () => {
  it("adds a randomized same-origin regional envelope rewrite", async () => {
    expect(nextConfig.rewrites).toBeTypeOf("function");

    const rewrites = await nextConfig.rewrites?.();
    expect(Array.isArray(rewrites)).toBe(true);
    if (!Array.isArray(rewrites)) {
      throw new Error("Sentry tunnel rewrites are not configured as an array");
    }

    const regionalTunnel = rewrites.find(
      (rewrite) =>
        rewrite.destination ===
        "https://o:orgid.ingest.:region.sentry.io/api/:projectid/envelope/?hsts=0",
    );

    expect(regionalTunnel).toMatchObject({
      has: [
        { type: "query", key: "o", value: "(?<orgid>\\d*)" },
        { type: "query", key: "p", value: "(?<projectid>\\d*)" },
        { type: "query", key: "r", value: "(?<region>[a-z]{2})" },
      ],
    });
    expect(regionalTunnel?.source).toMatch(/^\/[a-z0-9]{8}\(\/\?\)$/);
  });
});
