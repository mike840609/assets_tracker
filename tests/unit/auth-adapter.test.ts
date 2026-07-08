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
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
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
