import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ googleProvider: vi.fn(() => ({ id: "google" })) }));

vi.mock("next-auth/providers/google", () => ({
  default: h.googleProvider,
}));

vi.mock("@/lib/env", () => ({
  AUTH_GOOGLE_ID: undefined,
  AUTH_GOOGLE_SECRET: undefined,
  AUTH_REDIRECT_PROXY_URL: undefined,
  isGoogleAuthEnabled: false,
}));

const { default: authConfig } = await import("@/auth.config");

describe("authConfig", () => {
  it("omits Google OAuth when a self-host has not configured it", () => {
    expect(authConfig.providers).toEqual([]);
    expect(h.googleProvider).not.toHaveBeenCalled();
  });
});
