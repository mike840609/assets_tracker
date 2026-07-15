import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CredentialsProvider = {
  id?: string;
  authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
};

const h = vi.hoisted(() => ({
  authConfig: null as { providers: CredentialsProvider[] } | null,
  userUpsert: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: (config: { providers: CredentialsProvider[] }) => {
    h.authConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: CredentialsProvider) => ({ id: config.id ?? "credentials", ...config }),
}));

vi.mock("@/auth.config", () => ({
  default: { providers: [] },
}));

vi.mock("@/lib/auth-adapter", () => ({
  customPrismaAdapter: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { upsert: h.userUpsert } },
}));

vi.mock("@/lib/env", () => ({
  AUTH_SELF_HOST_PASSWORD: "a-secure-self-host-password",
  isSelfHostAuthEnabled: true,
  isPreviewAuthEnabled: false,
  previewAuthRequiresPassword: false,
  PREVIEW_AUTH_PASSWORD: undefined,
}));

await import("@/auth");

describe("self-host credentials provider", () => {
  beforeEach(() => {
    h.userUpsert.mockReset();
  });

  it("is registered independently from the preview credentials provider", () => {
    const provider = h.authConfig?.providers.find(({ id }) => id === "self-host");

    expect(provider).toBeDefined();
  });

  it("authenticates the stable owner account with the configured password", async () => {
    const user = {
      id: "self-host-owner-id",
      name: "Self-host Owner",
      email: "owner@self-host.local",
      image: null,
    };
    h.userUpsert.mockResolvedValue(user);
    const provider = h.authConfig?.providers.find(({ id }) => id === "self-host");

    await expect(
      provider?.authorize?.({ password: "a-secure-self-host-password" }),
    ).resolves.toEqual(user);
    expect(h.userUpsert).toHaveBeenCalledWith({
      where: { email: "owner@self-host.local" },
      update: {},
      create: {
        email: "owner@self-host.local",
        name: "Self-host Owner",
        appSettings: { create: { locale: "en-US", baseCurrency: "USD" } },
      },
    });
  });

  it("rejects an incorrect password without querying the owner account", async () => {
    const provider = h.authConfig?.providers.find(({ id }) => id === "self-host");

    await expect(provider?.authorize?.({ password: "incorrect-password" })).resolves.toBeNull();
    expect(h.userUpsert).not.toHaveBeenCalled();
  });
});

describe("self-host login page", () => {
  it("shows the configured auth methods without presenting Google unconditionally", () => {
    const source = readFileSync("src/app/login/page.tsx", "utf8");

    expect(source).toContain("isSelfHostAuthEnabled");
    expect(source).toContain('await signIn("self-host"');
    expect(source).toContain("{isGoogleAuthEnabled && (");
  });
});

describe("self-host distribution defaults", () => {
  it("boots with password auth without requiring a Google OAuth application", () => {
    const exampleEnv = readFileSync(".env.example", "utf8");
    const compose = readFileSync("docker-compose.yml", "utf8");
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const readme = readFileSync("README.md", "utf8");

    expect(exampleEnv).toMatch(/^AUTH_SELF_HOST_PASSWORD=/m);
    expect(compose).toContain("AUTH_SELF_HOST_PASSWORD: ${AUTH_SELF_HOST_PASSWORD:-}");
    expect(compose).not.toContain("AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID:?");
    expect(compose).not.toContain("AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET:?");
    expect(dockerfile).toContain('ENV AUTH_SELF_HOST_PASSWORD="docker-build-placeholder"');
    expect(dockerfile).not.toContain('ENV AUTH_GOOGLE_ID="docker-build-placeholder"');
    expect(readme).not.toContain("- A Google OAuth application");
  });
});
