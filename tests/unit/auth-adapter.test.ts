import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  tx: {
    user: {
      create: vi.fn(async () => ({ id: "user1", email: "u@example.com" })),
    },
    setting: {
      create: vi.fn(async () => ({ id: "setting1" })),
    },
  },
  demoWorkspaceFindUnique: vi.fn(),
  authAccountCreate: vi.fn(),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: () => ({}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof h.tx) => Promise<unknown>) => callback(h.tx)),
    user: {
      create: vi.fn(async () => ({ id: "outside-tx" })),
    },
    setting: {
      create: vi.fn(async () => ({ id: "outside-setting" })),
    },
    authAccount: {
      create: h.authAccountCreate,
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    demoWorkspace: {
      findUnique: h.demoWorkspaceFindUnique,
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { customPrismaAdapter } from "@/lib/auth-adapter";

describe("customPrismaAdapter.createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the user and default setting inside one transaction", async () => {
    const user = await customPrismaAdapter.createUser?.({ email: "u@example.com" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.user.create).toHaveBeenCalledWith({ data: { email: "u@example.com" } });
    expect(h.tx.setting.create).toHaveBeenCalledWith({
      data: { userId: "user1", locale: "en-US", baseCurrency: "USD" },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.setting.create).not.toHaveBeenCalled();
    expect(user).toEqual({ id: "user1", email: "u@example.com" });
  });
});

describe("customPrismaAdapter.linkAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never persists an OAuth account with a Demo user ID", async () => {
    h.demoWorkspaceFindUnique.mockResolvedValue({ userId: "demo-user" });

    await expect(
      customPrismaAdapter.linkAccount?.({
        userId: "demo-user",
        type: "oidc",
        provider: "google",
        providerAccountId: "google-account",
        access_token: "opaque-access-token",
        token_type: "bearer",
      }),
    ).rejects.toThrow("auth: refusing to link an account to a Demo user");

    expect(h.authAccountCreate).not.toHaveBeenCalled();
  });

  it("continues to persist OAuth accounts for formal users", async () => {
    h.demoWorkspaceFindUnique.mockResolvedValue(null);
    h.authAccountCreate.mockResolvedValue({
      userId: "formal-user",
      type: "oidc",
      provider: "google",
      providerAccountId: "google-account",
    });
    const account = {
      userId: "formal-user",
      type: "oidc",
      provider: "google",
      providerAccountId: "google-account",
      access_token: "opaque-access-token",
      token_type: "bearer",
    };

    await expect(customPrismaAdapter.linkAccount?.(account)).resolves.toMatchObject({
      userId: "formal-user",
      provider: "google",
    });
    expect(h.authAccountCreate).toHaveBeenCalledWith({ data: account });
  });
});
