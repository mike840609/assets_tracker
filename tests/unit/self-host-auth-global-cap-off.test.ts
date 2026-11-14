import { describe, expect, it, vi } from "vitest";

type CredentialsProvider = {
  id?: string;
  authorize?: (credentials: Record<string, unknown>, request: Request) => Promise<unknown>;
};

const h = vi.hoisted(() => ({
  authConfig: null as {
    providers: CredentialsProvider[];
    callbacks?: Record<string, unknown>;
  } | null,
  sessionCallback: vi.fn(),
  userUpsert: vi.fn(),
}));

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
  default: (config: { providers: CredentialsProvider[]; callbacks?: Record<string, unknown> }) => {
    h.authConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: CredentialsProvider) => ({ id: config.id ?? "credentials", ...config }),
}));

vi.mock("@/auth.config", () => ({
  default: { providers: [], callbacks: { session: h.sessionCallback } },
}));

vi.mock("@/lib/auth-adapter", () => ({
  customPrismaAdapter: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { upsert: h.userUpsert } },
}));

vi.mock("@/lib/env", () => ({
  AUTH_GLOBAL_FAILURE_LIMIT: 0,
  AUTH_SELF_HOST_PASSWORD: "a-secure-self-host-password",
  isSelfHostAuthEnabled: true,
  isPreviewAuthEnabled: false,
  previewAuthRequiresPassword: false,
  PREVIEW_AUTH_PASSWORD: undefined,
  isPublicDemoEnabled: false,
}));

vi.mock("@/lib/demo/demo-service", () => ({
  authenticateDemoTicket: vi.fn(),
}));

await import("@/auth");

/** Each test uses its own client IP so the module-level throttle doesn't leak between tests. */
const requestFrom = (ip: string) =>
  new Request("http://localhost/api/auth/callback/self-host", {
    headers: { "x-forwarded-for": ip },
  });

describe("self-host credentials provider with the global cap disabled", () => {
  it("never applies a global block, so only the per-IP limit holds", async () => {
    const provider = h.authConfig?.providers.find(({ id }) => id === "self-host");
    // 150 failures, each from a new (spoofed) IP: none may be refused.
    for (let i = 0; i < 150; i++) {
      await expect(
        provider?.authorize?.({ password: `wrong-${i}` }, requestFrom(`203.0.113.${i}`)),
      ).resolves.toBeNull();
    }
  });
});
