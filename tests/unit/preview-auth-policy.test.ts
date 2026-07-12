import { describe, expect, it } from "vitest";
import { requiresPreviewAuthPassword } from "@/lib/preview-auth-policy";

describe("requiresPreviewAuthPassword", () => {
  it("does not require a password for a local preview simulation", () => {
    expect(
      requiresPreviewAuthPassword({
        vercel: undefined,
        vercelEnv: "preview",
        authDisabled: undefined,
      }),
    ).toBe(false);
  });

  it("requires a password on a hosted Vercel preview", () => {
    expect(
      requiresPreviewAuthPassword({
        vercel: "1",
        vercelEnv: "preview",
        authDisabled: undefined,
      }),
    ).toBe(true);
  });

  it("honors the explicit passwordless override on a hosted preview", () => {
    expect(
      requiresPreviewAuthPassword({
        vercel: "1",
        vercelEnv: "preview",
        authDisabled: "true",
      }),
    ).toBe(false);
  });
});
