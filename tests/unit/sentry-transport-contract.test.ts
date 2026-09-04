import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sentry browser transport", () => {
  it("sends browser telemetry directly to Sentry instead of tunneling through Vercel compute", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../next.config.ts"), "utf8");

    expect(source).not.toMatch(/tunnelRoute\s*:\s*true/);
    expect(source).toContain("https://*.ingest.sentry.io");
  });
});
