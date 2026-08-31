import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The literal `.env.example` ships. `env.ts` hardcodes the same string to reject
 * it; this file is what keeps the two in sync.
 */
const PLACEHOLDER = "replace-with-long-random-secret";
const REAL_SECRET = "f2b1c4d6e8a0f2b1c4d6e8a0f2b1c4d6e8a0f2b1c4d6e8a0f2b1c4d6e8a0f2b1";
const OWNER_PASSWORD = "a-secure-self-host-password";

function stubValidEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/asset_app");
  vi.stubEnv("AUTH_SECRET", REAL_SECRET);
  vi.stubEnv("CRON_SECRET", REAL_SECRET);
  vi.stubEnv("AUTH_GOOGLE_ID", "");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "");
  vi.stubEnv("AUTH_SELF_HOST_PASSWORD", OWNER_PASSWORD);
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
}

describe("environment secret validation", () => {
  beforeEach(() => {
    vi.resetModules();
    stubValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("still guards the exact placeholder .env.example ships", () => {
    // If .env.example changes its placeholder, the refine in env.ts silently
    // stops matching and the hole reopens. Fail here instead.
    const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(envExample).toContain(`AUTH_SECRET="${PLACEHOLDER}"`);
    expect(envExample).toContain(`CRON_SECRET="${PLACEHOLDER}"`);
    expect(envExample).toContain(`AUTH_SELF_HOST_PASSWORD="${PLACEHOLDER}"`);

    const envSource = fs.readFileSync(path.join(process.cwd(), "src/lib/env.ts"), "utf8");
    expect(envSource).toContain(`const ENV_EXAMPLE_PLACEHOLDER = "${PLACEHOLDER}";`);

    // setup-env.sh rewrites the same three lines. If it drifts from either the
    // example or the validator, `pnpm setup:env` silently stops filling a
    // secret in and the app refuses to boot afterwards.
    const setupScript = fs.readFileSync(path.join(process.cwd(), "scripts/setup-env.sh"), "utf8");
    expect(setupScript).toContain(`PLACEHOLDER="${PLACEHOLDER}"`);
    for (const key of ["AUTH_SECRET", "CRON_SECRET", "AUTH_SELF_HOST_PASSWORD"]) {
      expect(setupScript).toContain(key);
    }
  });

  it("accepts secrets generated the way the docs prescribe", async () => {
    await expect(import("@/lib/env")).resolves.toMatchObject({ CRON_SECRET: REAL_SECRET });
  });

  for (const key of ["AUTH_SECRET", "CRON_SECRET", "AUTH_SELF_HOST_PASSWORD"] as const) {
    it(`rejects ${key} left at the .env.example placeholder`, async () => {
      // The placeholder is 31 characters, so it clears every length rule and
      // is non-empty, which is why docker-compose's ${VAR:?} lets it through.
      expect(PLACEHOLDER.length).toBeGreaterThan(16);
      vi.stubEnv(key, PLACEHOLDER);
      vi.resetModules();

      await expect(import("@/lib/env")).rejects.toThrow(
        `${key}: is still the .env.example placeholder`,
      );
    });
  }

  for (const key of ["AUTH_SECRET", "CRON_SECRET"] as const) {
    it(`rejects a ${key} shorter than 32 characters`, async () => {
      vi.stubEnv(key, "short-secret");
      vi.resetModules();

      await expect(import("@/lib/env")).rejects.toThrow(`${key}: must be at least 32 characters`);
    });
  }
});
