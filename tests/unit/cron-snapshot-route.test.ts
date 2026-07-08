import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  events: [] as string[],
  expiredOptions: [] as Array<{ id: string; quantity: number }>,
  users: [{ id: "user1", appSettings: { baseCurrency: "USD" } }] as Array<{
    id: string;
    appSettings: { baseCurrency: string } | null;
  }>,
  /** userIds whose createSnapshot call should reject. */
  failingUserIds: [] as string[],
  cronRunUpdates: [] as Array<Record<string, unknown>>,
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
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
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
    if (h.failingUserIds.includes(userId)) {
      throw new Error(`snapshot failed for ${userId}`);
    }
    h.events.push(`snapshot:${userId}`);
    return { id: `snapshot-${userId}` };
  }),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    cronRun: {
      create: vi.fn(async () => ({ id: "cron1" })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        h.cronRunUpdates.push(args.data);
        return {};
      }),
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
    h.events = [];
    h.expiredOptions = [];
    h.users = [{ id: "user1", appSettings: { baseCurrency: "USD" } }];
    h.failingUserIds = [];
    h.cronRunUpdates = [];
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

  it("still revalidates and reports success for users whose snapshot succeeded when another user's fails (#558)", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "USD" } },
      { id: "user3", appSettings: { baseCurrency: "TWD" } },
    ];
    h.failingUserIds = ["user2"];
    const { GET } = await import("@/app/api/cron/snapshot/route");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    const body = (await response.json()) as {
      data: { success: boolean; degraded: boolean; snapshotIds: string[]; failedUserIds: string[] };
    };

    // Overall request still succeeds — a single user's failure isn't a total outage.
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.degraded).toBe(true);
    expect(body.data.failedUserIds).toEqual(["user2"]);

    // The users who succeeded still got their snapshot committed...
    expect(h.events).toContain("snapshot:user1");
    expect(h.events).toContain("snapshot:user3");
    expect(body.data.snapshotIds).toEqual(
      expect.arrayContaining(["snapshot-user1", "snapshot-user3"]),
    );

    // ...and, crucially, revalidation still ran for every user whose snapshot
    // committed — this is exactly what used to get skipped when Promise.all
    // rejected on the first failing user.
    expect(h.events).toContain("revalidate:snapshots");
    expect(h.events).toContain("revalidate:history:user1");
    expect(h.events).toContain("revalidate:history:user3");
    // The failed user's history tag should not be revalidated — nothing new
    // was written for them.
    expect(h.events).not.toContain("revalidate:history:user2");

    // The CronRun audit row records a degraded-but-ok run, not a hard failure.
    const lastUpdate = h.cronRunUpdates[h.cronRunUpdates.length - 1];
    expect(lastUpdate.ok).toBe(true);
    expect(String(lastUpdate.error)).toContain("user2");
  });

  it("marks the CronRun as a hard failure only when every user's snapshot fails", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "USD" } },
    ];
    h.failingUserIds = ["user1", "user2"];
    const { GET } = await import("@/app/api/cron/snapshot/route");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(h.events).not.toContain("revalidate:snapshots");

    const lastUpdate = h.cronRunUpdates[h.cronRunUpdates.length - 1];
    expect(lastUpdate.ok).toBe(false);
  });
});
