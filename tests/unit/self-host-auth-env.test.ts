import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SELF_HOST_PASSWORD = "a-secure-self-host-password";

describe("self-host authentication environment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/asset_app");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    vi.stubEnv("AUTH_SELF_HOST_PASSWORD", SELF_HOST_PASSWORD);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a non-Vercel production deployment with password auth and no Google OAuth", async () => {
    await expect(import("@/lib/env")).resolves.toMatchObject({
      AUTH_SELF_HOST_PASSWORD: SELF_HOST_PASSWORD,
      isGoogleAuthEnabled: false,
      isSelfHostAuthEnabled: true,
    });
  });

  it("does not allow the self-host password provider on Vercel production", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.resetModules();

    await expect(import("@/lib/env")).rejects.toThrow(
      "AUTH_SELF_HOST_PASSWORD: or Google authentication is required in production",
    );
  });

  it("requires a strong self-host password", async () => {
    vi.stubEnv("AUTH_SELF_HOST_PASSWORD", "too-short");
    vi.resetModules();

    await expect(import("@/lib/env")).rejects.toThrow(
      "AUTH_SELF_HOST_PASSWORD: must be at least 16 characters",
    );
  });

  it("accepts Google-only authentication on a non-Vercel deployment", async () => {
    vi.stubEnv("AUTH_SELF_HOST_PASSWORD", "");
    vi.stubEnv("AUTH_GOOGLE_ID", "google-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "google-client-secret");
    vi.resetModules();

    await expect(import("@/lib/env")).resolves.toMatchObject({
      isGoogleAuthEnabled: true,
      isSelfHostAuthEnabled: false,
    });
  });
});
