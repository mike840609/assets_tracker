import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Sentry browser transport", () => {
  it("does not add a same-origin Sentry tunnel rewrite", () => {
    expect(nextConfig.rewrites).toBeUndefined();
  });

  it("allows direct Sentry ingest hosts in the content security policy", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");

    const rules = await nextConfig.headers?.();
    const appRule = rules?.find((rule) => rule.source === "/:path*");
    const csp = appRule?.headers.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("https://*.ingest.sentry.io");
    expect(csp).toContain("https://*.ingest.us.sentry.io");
    expect(csp).toContain("https://*.ingest.de.sentry.io");
  });
});
