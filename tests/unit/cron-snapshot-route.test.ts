import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  events: [] as string[],
  expiredOptions: [] as Array<{ id: string; quantity: number }>,
  users: [{ id: "user1", appSettings: { baseCurrency: "USD" } }],
  snapshotFailures: new Set<string>(),
}));

vi.mock("@/lib/env", () => ({
  CRON_SECRET: "test-secret",
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn((tag: string) => {
    h.events.push(`revalidate:${tag}`);
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/sentry-cron", () => ({
  startSnapshotCronCheckIn: vi.fn(() => "check-in"),
  finishSnapshotCronCheckIn: vi.fn(),
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(async () => ({ updated: 0, changed: 0 })),
}));

vi.mock("@/lib/services/price-service", () => ({
  refreshAllPrices: vi.fn(async () => ({ updated: 0, changed: 0 })),
}));

vi.mock("@/lib/services/recurring-cash-service", () => ({
  materializeDueRecurringTransactions: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/services/recurring-investment-service", () => ({
  materializeDueInvestments: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/services/snapshot-service", () => ({
  createSnapshot: vi.fn(async (userId: string) => {
    h.events.push(`snapshot:${userId}`);
    if (h.snapshotFailures.has(userId)) throw new Error(`snapshot failed for ${userId}`);
    return { id: `snapshot-${userId}` };
  }),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    cronRun: {
      create: vi.fn(async () => ({ id: "cron1" })),
      update: vi.fn(async () => ({})),
    },
    holding: {
      findMany: vi.fn(async () => h.expiredOptions),
      updateMany: vi.fn(async () => ({ count: h.expiredOptions.length })),
    },
    holdingTransaction: {
      createMany: vi.fn(async () => ({ count: h.expiredOptions.length })),
    },
    account: {
      findMany: vi.fn(async () => []),
    },
    setting: {
      findMany: vi.fn(async () => []),
    },
    user: {
      findMany: vi.fn(async () => h.users),
    },
    $transaction: vi.fn(async (work: unknown) => {
      if (Array.isArray(work)) return Promise.all(work);
      return (work as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }),
  };
  return { prisma };
});

describe("snapshot cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.events = [];
    h.expiredOptions = [];
    h.users = [{ id: "user1", appSettings: { baseCurrency: "USD" } }];
    h.snapshotFailures = new Set();
  });

  it("invalidates net worth before snapshot creation when options expire", async () => {
    h.expiredOptions = [{ id: "holding1", quantity: 2 }];
    const { GET } = await import("@/app/api/cron/snapshot/route");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(h.events).toContain("revalidate:accounts");
    expect(h.events).toContain("revalidate:net-worth");
    expect(h.events.indexOf("revalidate:net-worth")).toBeLessThan(
      h.events.indexOf("snapshot:user1"),
    );
  });

  it("returns 200 and records failed user ids when only some snapshots fail", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "TWD" } },
    ];
    h.snapshotFailures = new Set(["user2"]);
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { log } = await import("@/lib/logger");
    const { prisma } = await import("@/lib/prisma");
    const { finishSnapshotCronCheckIn } = await import("@/lib/sentry-cron");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        success: true,
        snapshotIds: ["snapshot-user1"],
        failedUserIds: ["user2"],
      },
    });
    expect(h.events).toContain("revalidate:snapshots");
    expect(h.events).toContain("revalidate:history:user1");
    expect(h.events).not.toContain("revalidate:history:user2");
    expect(log.warn).toHaveBeenCalledWith("cron.snapshot.user_failed", {
      userId: "user2",
      error: "Error: snapshot failed for user2",
    });
    expect(log.error).not.toHaveBeenCalled();
    expect(prisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ok: true,
          error: expect.stringContaining("user2"),
        }),
      }),
    );
    expect(finishSnapshotCronCheckIn).toHaveBeenCalledWith("check-in", "ok");
  });

  it("preserves failure semantics when every user snapshot fails", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "TWD" } },
    ];
    h.snapshotFailures = new Set(["user1", "user2"]);
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { log } = await import("@/lib/logger");
    const { prisma } = await import("@/lib/prisma");
    const { finishSnapshotCronCheckIn } = await import("@/lib/sentry-cron");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(h.events).not.toContain("revalidate:snapshots");
    expect(log.error).toHaveBeenCalledWith("cron.snapshot.failed", {
      error: "Error: Snapshot failed for users: user1, user2",
    });
    expect(prisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ok: false,
          error: expect.stringContaining("user1"),
        }),
      }),
    );
    expect(finishSnapshotCronCheckIn).toHaveBeenCalledWith("check-in", "error");
  });

  it("materializes recurring rules for the Taiwan calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z")); // 07-06 05:30 Taipei
    try {
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { materializeDueRecurringTransactions } = await import(
        "@/lib/services/recurring-cash-service"
      );
      const { materializeDueInvestments } = await import(
        "@/lib/services/recurring-investment-service"
      );

      await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      const expected = new Date("2026-07-06T00:00:00.000Z");
      expect(vi.mocked(materializeDueRecurringTransactions)).toHaveBeenCalledWith(expected);
      expect(vi.mocked(materializeDueInvestments)).toHaveBeenCalledWith(expected);
    } finally {
      vi.useRealTimers();
    }
  });
});
