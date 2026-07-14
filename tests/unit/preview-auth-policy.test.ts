import { describe, expect, it } from "vitest";
import { resolvePreviewAuthPolicy } from "@/lib/preview-auth-policy";

describe("resolvePreviewAuthPolicy", () => {
  it("enables passwordless auth in local development", () => {
    expect(
      resolvePreviewAuthPolicy({
        nodeEnv: "development",
        vercel: undefined,
        vercelEnv: undefined,
        authEnabled: undefined,
        authDisabled: undefined,
      }),
    ).toEqual({ enabled: true, requiresPassword: false });
  });

  it("disables auth by default in non-Vercel production", () => {
    expect(
      resolvePreviewAuthPolicy({
        nodeEnv: "production",
        vercel: undefined,
        vercelEnv: undefined,
        authEnabled: undefined,
        authDisabled: undefined,
      }),
    ).toEqual({ enabled: false, requiresPassword: false });
  });

  it("enables password-protected auth on a hosted Vercel preview", () => {
    expect(
      resolvePreviewAuthPolicy({
        nodeEnv: "production",
        vercel: "1",
        vercelEnv: "preview",
        authEnabled: undefined,
        authDisabled: undefined,
      }),
    ).toEqual({ enabled: true, requiresPassword: true });
  });

  it("enables password-protected auth when explicitly enabled in non-Vercel production", () => {
    expect(
      resolvePreviewAuthPolicy({
        nodeEnv: "production",
        vercel: undefined,
        vercelEnv: undefined,
        authEnabled: "true",
        authDisabled: undefined,
      }),
    ).toEqual({ enabled: true, requiresPassword: true });
  });

  it("honors the explicit passwordless override on a hosted preview", () => {
    expect(
      resolvePreviewAuthPolicy({
        nodeEnv: "production",
        vercel: "1",
        vercelEnv: "preview",
        authEnabled: undefined,
        authDisabled: "true",
      }),
    ).toEqual({ enabled: true, requiresPassword: false });
  });
});
