import { beforeEach, describe, expect, it, vi } from "vitest";

type CredentialsProvider = {
  id?: string;
  credentials?: Record<string, unknown>;
  authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
};

const h = vi.hoisted(() => ({
  authConfig: null as {
    providers: CredentialsProvider[];
    callbacks?: Record<string, unknown>;
  } | null,
  userUpsert: vi.fn(),
  env: {
    AUTH_SELF_HOST_PASSWORD: "self-host-password",
    isSelfHostAuthEnabled: false,
    isPreviewAuthEnabled: true,
    previewAuthRequiresPassword: true,
    PREVIEW_AUTH_PASSWORD: "expected-preview-password",
    isPublicDemoEnabled: false,
  },
}));

vi.mock("next-auth", () => ({
  default: (config: { providers: CredentialsProvider[]; callbacks?: Record<string, unknown> }) => {
    h.authConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: CredentialsProvider) => ({ id: config.id ?? "credentials", ...config }),
}));

vi.mock("@/auth.config", () => ({
  default: { providers: [], callbacks: {} },
}));

vi.mock("@/lib/auth-adapter", () => ({
  customPrismaAdapter: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { upsert: h.userUpsert } },
}));

vi.mock("@/lib/env", () => ({
  get AUTH_SELF_HOST_PASSWORD() {
    return h.env.AUTH_SELF_HOST_PASSWORD;
  },
  get isSelfHostAuthEnabled() {
    return h.env.isSelfHostAuthEnabled;
  },
  get isPreviewAuthEnabled() {
    return h.env.isPreviewAuthEnabled;
  },
  get previewAuthRequiresPassword() {
    return h.env.previewAuthRequiresPassword;
  },
  get PREVIEW_AUTH_PASSWORD() {
    return h.env.PREVIEW_AUTH_PASSWORD;
  },
  get isPublicDemoEnabled() {
    return h.env.isPublicDemoEnabled;
  },
}));

vi.mock("@/lib/demo/demo-service", () => ({
  authenticateDemoTicket: vi.fn(),
}));

await import("@/auth");

describe("preview credentials provider authorization", () => {
  beforeEach(() => {
    h.userUpsert.mockReset();
    h.env.previewAuthRequiresPassword = true;
    h.env.PREVIEW_AUTH_PASSWORD = "expected-preview-password";
  });

  it("authenticates the preview user when password matches the configured password", async () => {
    const user = {
      id: "preview-user-id",
      name: "E2E Test User",
      email: "e2e-test@preview.local",
      image: null,
    };
    h.userUpsert.mockResolvedValue(user);

    const provider = h.authConfig?.providers.find(
      (p) => p.id === "credentials" || p.id === "preview",
    );
    expect(provider).toBeDefined();

    const result = await provider?.authorize?.({ password: "expected-preview-password" });
    expect(result).toEqual(user);
    expect(h.userUpsert).toHaveBeenCalledWith({
      where: { email: "e2e-test@preview.local" },
      update: {},
      create: {
        email: "e2e-test@preview.local",
        name: "E2E Test User",
        appSettings: {
          create: {
            locale: "en-US",
            baseCurrency: "USD",
          },
        },
      },
    });
  });

  it("rejects authentication in constant time when password does not match", async () => {
    const provider = h.authConfig?.providers.find(
      (p) => p.id === "credentials" || p.id === "preview",
    );
    const result = await provider?.authorize?.({ password: "wrong-password" });
    expect(result).toBeNull();
    expect(h.userUpsert).not.toHaveBeenCalled();
  });

  it("rejects authentication when password is empty or not provided", async () => {
    const provider = h.authConfig?.providers.find(
      (p) => p.id === "credentials" || p.id === "preview",
    );
    const result = await provider?.authorize?.({});
    expect(result).toBeNull();
    expect(h.userUpsert).not.toHaveBeenCalled();
  });

  it("allows authentication when previewAuthRequiresPassword is false even without password", async () => {
    h.env.previewAuthRequiresPassword = false;
    const user = {
      id: "preview-user-id",
      name: "E2E Test User",
      email: "e2e-test@preview.local",
      image: null,
    };
    h.userUpsert.mockResolvedValue(user);

    const provider = h.authConfig?.providers.find(
      (p) => p.id === "credentials" || p.id === "preview",
    );
    const result = await provider?.authorize?.({});
    expect(result).toEqual(user);
    expect(h.userUpsert).toHaveBeenCalled();
  });
});
