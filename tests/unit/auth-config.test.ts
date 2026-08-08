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

  it("copies Demo claims into the JWT and session", async () => {
    const token = await authConfig.callbacks!.jwt!({
      token: { sub: "demo-user" },
      user: {
        id: "demo-user",
        isDemo: true,
        demoExpiresAt: "2026-08-02T00:00:00.000Z",
      },
      account: null,
      profile: undefined,
      trigger: "signIn",
      isNewUser: false,
      session: undefined,
    } as never);

    expect(token).toMatchObject({
      isDemo: true,
      demoExpiresAt: "2026-08-02T00:00:00.000Z",
    });

    const session = await authConfig.callbacks!.session!({
      session: { user: { name: "Demo visitor" }, expires: "2026-08-02T00:00:00.000Z" },
      token,
      user: { id: "demo-user" },
      newSession: undefined,
      trigger: "update",
    } as never);

    expect(session.user).toMatchObject({
      id: "demo-user",
      isDemo: true,
      demoExpiresAt: "2026-08-02T00:00:00.000Z",
    });
  });

  it("clears old Demo claims when a formal provider signs in", async () => {
    const token = await authConfig.callbacks!.jwt!({
      token: {
        sub: "formal-user",
        isDemo: true,
        demoExpiresAt: "2026-08-02T00:00:00.000Z",
      },
      user: { id: "formal-user" },
      account: { provider: "google", type: "oidc", providerAccountId: "formal-user" },
      profile: undefined,
      trigger: "signIn",
      isNewUser: false,
      session: undefined,
    } as never);

    expect(token).toMatchObject({ isDemo: false });
    expect(token.demoExpiresAt).toBeUndefined();
  });

  it("rejects sessions without a signed subject claim", async () => {
    expect(() =>
      authConfig.callbacks!.session!({
        session: { user: { name: "Unknown" }, expires: "2026-08-02T00:00:00.000Z" },
        token: {},
        user: { id: "unknown" },
        newSession: undefined,
        trigger: "update",
      } as never),
    ).toThrow("auth: JWT token missing 'sub' claim");
  });
});
