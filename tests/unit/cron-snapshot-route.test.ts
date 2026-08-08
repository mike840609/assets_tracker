import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  events: [] as string[],
  expiredOptions: [] as Array<{
    id: string;
    quantity: number;
    expiration?: Date;
    isDemo?: boolean;
  }>,
  optionSweepGuardFails: false,
  users: [{ id: "user1", appSettings: { baseCurrency: "USD" } }] as Array<{
    id: string;
    appSettings: { baseCurrency: string };
    isDemo?: boolean;
  }>,
  cleanupFailure: null as Error | null,
  snapshotFailures: new Set<string>(),
  /** #641 — how many times the global FX map was loaded across the whole run. */
  rateMapLoads: 0,
  /** #641 — one entry per bulk input load, holding that page's user ids. */
  inputLoads: [] as string[][],
  /** Opts each createSnapshot call received, to prove preloaded inputs are used. */
  snapshotOpts: [] as unknown[],
  rateRefreshes: [] as string[],
  rateRefreshFailures: new Set<string>(),
  priceRefreshResult: { updated: 0, changed: 0, outcome: "success", errors: [] as string[] },
  snapshotTimeJumpUser: null as string | null,
  snapshotTimeJumpMs: 0,
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
  refreshExchangeRates: vi.fn(async (currency: string) => {
    h.rateRefreshes.push(currency);
    if (h.rateRefreshFailures.has(currency)) throw new Error(`rate refresh failed for ${currency}`);
    return { updated: 0, changed: 0 };
  }),
  getFreshExchangeRates: vi.fn(async () => {
    h.rateMapLoads += 1;
    return new Map<string, number>();
  }),
}));

vi.mock("@/lib/services/net-worth-service", () => ({
  loadNetWorthInputsForUsers: vi.fn(async (userIds: string[]) => {
    h.events.push("snapshot-inputs:loaded");
    h.inputLoads.push(userIds);
    return new Map(userIds.map((id) => [id, { accounts: [], ratesMap: new Map(), priceMap: {} }]));
  }),
}));

vi.mock("@/lib/services/price-service", () => ({
  refreshAllPrices: vi.fn(async () => h.priceRefreshResult),
}));

vi.mock("@/lib/services/recurring-cash-service", () => ({
  materializeDueRecurringTransactions: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/services/recurring-investment-service", () => ({
  materializeDueInvestments: vi.fn(async () => ({ created: 0, rulesProcessed: 0 })),
}));

vi.mock("@/lib/demo/demo-service", () => ({
  cleanupExpiredDemoUsers: vi.fn(async () => {
    h.events.push("cleanup:started");
    if (h.cleanupFailure) throw h.cleanupFailure;
    return { deleted: 2, budgetExhausted: false };
  }),
}));

vi.mock("@/lib/services/snapshot-service", () => ({
  createSnapshot: vi.fn(async (userId: string, _baseCurrency: string, opts?: unknown) => {
    h.events.push(`snapshot:${userId}`);
    h.snapshotOpts.push(opts);
    if (h.snapshotTimeJumpUser === userId) {
      vi.setSystemTime(new Date(Date.now() + h.snapshotTimeJumpMs));
    }
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
      findMany: vi.fn(
        async (args?: {
          where?: {
            assetType?: string;
            expiration?: { lt: Date };
            quantity?: { gt: number };
            account?: { user?: { demoWorkspace?: null } };
          };
        }) => {
          if (args?.where?.assetType !== "OPTION") return h.expiredOptions;
          h.events.push("options:queried");
          const cutoff = args.where.expiration?.lt;
          return h.expiredOptions.filter(
            (holding) =>
              (args.where?.account?.user?.demoWorkspace !== null || !holding.isDemo) &&
              holding.quantity > (args.where?.quantity?.gt ?? 0) &&
              (!holding.expiration || !cutoff || holding.expiration < cutoff),
          );
        },
      ),
      // Per-holding guarded zeroing: count 0 simulates a concurrent writer
      // moving the quantity between the sweep's read and its write.
      updateMany: vi.fn(async (args: { where: { id: string } }) => {
        h.events.push(`option:${args.where.id}:zeroed`);
        return { count: h.optionSweepGuardFails ? 0 : 1 };
      }),
    },
    holdingTransaction: {
      create: vi.fn(async (args: { data: { holdingId: string } }) => {
        h.events.push(`option:${args.data.holdingId}:sell-recorded`);
        return {};
      }),
      createMany: vi.fn(async () => ({ count: h.expiredOptions.length })),
    },
    account: {
      findMany: vi.fn(async () => []),
    },
    setting: {
      findMany: vi.fn(async () => []),
    },
    user: {
      findMany: vi.fn(
        async (args?: {
          where?: { demoWorkspace?: null };
          take?: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const users =
            args?.where?.demoWorkspace === null ? h.users.filter((user) => !user.isDemo) : h.users;
          const cursorIndex = args?.cursor
            ? users.findIndex((user) => user.id === args.cursor?.id)
            : -1;
          const start = cursorIndex < 0 ? 0 : cursorIndex + (args?.skip ?? 0);
          return users.slice(start, args?.take ? start + args.take : undefined);
        },
      ),
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
    h.optionSweepGuardFails = false;
    h.users = [{ id: "user1", appSettings: { baseCurrency: "USD" } }];
    h.cleanupFailure = null;
    h.snapshotFailures = new Set();
    h.rateMapLoads = 0;
    h.inputLoads = [];
    h.snapshotOpts = [];
    h.rateRefreshes = [];
    h.rateRefreshFailures = new Set();
    h.priceRefreshResult = { updated: 0, changed: 0, outcome: "success", errors: [] };
    h.snapshotTimeJumpUser = null;
    h.snapshotTimeJumpMs = 0;
  });

  it("keeps Demo rows out of every global discovery query and cleans up first", async () => {
    h.users = [
      { id: "formal-user", appSettings: { baseCurrency: "USD" } },
      { id: "demo-user", appSettings: { baseCurrency: "TWD" }, isDemo: true },
    ];
    h.expiredOptions = [
      { id: "formal-option", quantity: 1, isDemo: false },
      { id: "demo-option", quantity: 1, isDemo: true },
    ];
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { prisma } = await import("@/lib/prisma");
    const { cleanupExpiredDemoUsers } = await import("@/lib/demo/demo-service");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(cleanupExpiredDemoUsers).toHaveBeenCalledWith({
      now: expect.any(Date),
      batchSize: 25,
      maxUsers: 250,
      budgetMs: 5_000,
    });
    expect(h.events.indexOf("cleanup:started")).toBeLessThan(h.events.indexOf("options:queried"));
    expect(vi.mocked(prisma.holding.findMany)).toHaveBeenCalledWith({
      where: {
        assetType: "OPTION",
        expiration: { lt: expect.any(Date) },
        quantity: { gt: 0 },
        account: { user: { demoWorkspace: null } },
      },
    });
    expect(vi.mocked(prisma.account.findMany)).toHaveBeenCalledWith({
      where: { user: { demoWorkspace: null } },
      select: { currency: true },
      distinct: ["currency"],
    });
    expect(vi.mocked(prisma.holding.findMany)).toHaveBeenCalledWith({
      where: { account: { user: { demoWorkspace: null } } },
      select: { currency: true },
      distinct: ["currency"],
    });
    expect(vi.mocked(prisma.setting.findMany)).toHaveBeenCalledWith({
      where: { user: { demoWorkspace: null } },
      select: { baseCurrency: true },
      distinct: ["baseCurrency"],
    });
    expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { demoWorkspace: null } }),
    );
    expect(h.events).toContain("snapshot:formal-user");
    expect(h.events).not.toContain("snapshot:demo-user");
    expect(h.events).not.toContain("option:demo-option:zeroed");
  });

  it("continues formal snapshots when bounded Demo cleanup fails with private metadata", async () => {
    h.cleanupFailure = new TypeError("visitor abc workspace demo-user");
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { log } = await import("@/lib/logger");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(h.events).toContain("snapshot:user1");
    expect(log.warn).toHaveBeenCalledWith("cron.public_demo.cleanup_failed", {
      errorType: "TypeError",
    });
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

  it("mints a SELL row for the read quantity when the expiry sweep guard holds", async () => {
    h.expiredOptions = [{ id: "holding1", quantity: 2 }];
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { prisma } = await import("@/lib/prisma");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.holding.updateMany)).toHaveBeenCalledWith({
      where: { id: "holding1", quantity: 2 },
      data: { quantity: 0 },
    });
    expect(vi.mocked(prisma.holdingTransaction.create)).toHaveBeenCalledWith({
      data: { holdingId: "holding1", type: "SELL", quantity: 2, note: "Expired" },
    });
  });

  it("skips the SELL row when another writer changed the option quantity mid-sweep", async () => {
    h.expiredOptions = [{ id: "holding1", quantity: 2 }];
    h.optionSweepGuardFails = true;
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { prisma } = await import("@/lib/prisma");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.holdingTransaction.create)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.holdingTransaction.createMany)).not.toHaveBeenCalled();
  });

  it("returns a retryable degraded result after preserving successful snapshots when one user fails", async () => {
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

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: "Snapshot partially completed",
      },
      data: {
        success: false,
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
          ok: false,
          error: expect.stringContaining("user2"),
        }),
      }),
    );
    expect(finishSnapshotCronCheckIn).toHaveBeenCalledWith("check-in", "error");
  });

  it("records a clean success and invalidates every successful user's history", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "TWD" } },
    ];
    const { GET } = await import("@/app/api/cron/snapshot/route");
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
        snapshotIds: ["snapshot-user1", "snapshot-user2"],
        failedUserIds: [],
      },
    });
    expect(h.events).toContain("revalidate:snapshots");
    expect(h.events).toContain("revalidate:history:user1");
    expect(h.events).toContain("revalidate:history:user2");
    const auditData = vi.mocked(prisma.cronRun.update).mock.calls[0][0].data;
    expect(auditData).toMatchObject({ ok: true });
    expect(auditData).not.toHaveProperty("error");
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
    expect(h.events.some((event) => event.startsWith("revalidate:history:"))).toBe(false);
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

  it("fails the audit and skips stale-price snapshots when every due price fetch fails", async () => {
    h.priceRefreshResult = {
      updated: 0,
      changed: 0,
      outcome: "total_failure",
      errors: ["Yahoo Finance batch failed: Error: upstream unavailable"],
    };
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { prisma } = await import("@/lib/prisma");
    const { log } = await import("@/lib/logger");
    const { finishSnapshotCronCheckIn } = await import("@/lib/sentry-cron");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(h.events.filter((event) => event.startsWith("snapshot:"))).toEqual([]);
    expect(log.error).toHaveBeenCalledWith(
      "cron.prices.refresh_failed",
      expect.objectContaining({ errors: h.priceRefreshResult.errors }),
    );
    expect(prisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ok: false }) }),
    );
    expect(finishSnapshotCronCheckIn).toHaveBeenCalledWith("check-in", "error");
  });

  // Regression #640: the tag bumps above are `"max"` (stale-while-revalidate),
  // so a cached net-worth read here would persist the previous cycle's numbers.
  // The cron must ask createSnapshot for the uncached computation.
  it("asks for a fresh (uncached) summary when creating each snapshot", async () => {
    h.users = [
      { id: "user1", appSettings: { baseCurrency: "USD" } },
      { id: "user2", appSettings: { baseCurrency: "TWD" } },
    ];
    const { GET } = await import("@/app/api/cron/snapshot/route");
    const { createSnapshot } = await import("@/lib/services/snapshot-service");

    const response = await GET(
      new Request("http://unit.test/api/cron/snapshot", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(createSnapshot)).toHaveBeenCalledWith(
      "user1",
      "USD",
      expect.objectContaining({ fresh: true }),
    );
    expect(vi.mocked(createSnapshot)).toHaveBeenCalledWith(
      "user2",
      "TWD",
      expect.objectContaining({ fresh: true }),
    );
    // The bulk loader reads directly (no `"use cache"`), so preloaded inputs are
    // fresh by construction — but they must actually be handed over, or
    // createSnapshot silently falls back to per-user queries.
    for (const opts of h.snapshotOpts) {
      expect(opts).toHaveProperty("preloaded");
      expect((opts as { preloaded?: unknown }).preloaded).toBeDefined();
    }
  });

  // Regression #641: reads used to be per-user and unbounded in flight, so the
  // cron's round-trips grew linearly with the instance and exhausted the pool.
  describe("bulk loading (#641)", () => {
    const manyUsers = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `user${i}`,
        appSettings: { baseCurrency: "USD" },
      }));

    it("loads the global FX map once for the whole run, not once per user", async () => {
      h.users = manyUsers(25);
      const { GET } = await import("@/app/api/cron/snapshot/route");

      const response = await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(response.status).toBe(200);
      expect(h.rateMapLoads).toBe(1);
    });

    it("bulk-loads net-worth inputs once per page, covering every user exactly once", async () => {
      h.users = manyUsers(25);
      const { GET } = await import("@/app/api/cron/snapshot/route");

      await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      // 25 users fit in one page (USER_PAGE_SIZE = 200), so one load — the point
      // is that it is a fixed count, not 25.
      expect(h.inputLoads).toHaveLength(1);
      expect(h.inputLoads.flat()).toEqual(h.users.map((u) => u.id));
      expect(h.events.filter((e) => e.startsWith("snapshot:"))).toHaveLength(25);
    });

    it("cursor-pages users instead of loading the whole table before chunking", async () => {
      h.users = manyUsers(201);
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { prisma } = await import("@/lib/prisma");

      const response = await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(response.status).toBe(200);
      expect(h.inputLoads.map((ids) => ids.length)).toEqual([200, 1]);
      expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(prisma.user.findMany)).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          take: 200,
          orderBy: { id: "asc" },
        }),
      );
      expect(vi.mocked(prisma.user.findMany)).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          take: 200,
          orderBy: { id: "asc" },
          cursor: { id: "user199" },
          skip: 1,
        }),
      );
    });

    it("stops scheduling snapshot waves before the platform deadline and records partial failure", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z"));
      try {
        h.users = manyUsers(25);
        // Simulate upstream + two write waves consuming the safe cron budget.
        // The third wave must never be scheduled, leaving time to persist the
        // CronRun failure and return before Vercel's 60-second hard kill.
        h.snapshotTimeJumpUser = "user19";
        h.snapshotTimeJumpMs = 51_000;
        const { GET } = await import("@/app/api/cron/snapshot/route");
        const { prisma } = await import("@/lib/prisma");
        const { log } = await import("@/lib/logger");
        const { finishSnapshotCronCheckIn } = await import("@/lib/sentry-cron");

        const response = await GET(
          new Request("http://unit.test/api/cron/snapshot", {
            headers: { authorization: "Bearer test-secret" },
          }),
        );

        expect(response.status).toBe(503);
        expect(h.events.filter((event) => event.startsWith("snapshot:"))).toHaveLength(20);
        expect(h.events).toContain("revalidate:snapshots");
        expect(h.events).toContain("revalidate:history:user0");
        expect(h.events).not.toContain("snapshot:user20");
        expect(prisma.cronRun.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              ok: false,
              error: expect.stringMatching(/budget.*20.*25/i),
            }),
          }),
        );
        expect(prisma.cronRun.update).toHaveBeenCalledTimes(1);
        expect(log.error).not.toHaveBeenCalledWith("cron.snapshot.failed", expect.anything());
        expect(finishSnapshotCronCheckIn).toHaveBeenCalledWith("check-in", "error");
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps sweeping when one currency's rate refresh throws", async () => {
      h.rateRefreshFailures = new Set(["USD"]);
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { log } = await import("@/lib/logger");

      const response = await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      // Previously a single rejected currency aborted the entire run via
      // Promise.all, losing that day's snapshot for everyone.
      expect(response.status).toBe(200);
      expect(h.events).toContain("snapshot:user1");
      expect(log.warn).toHaveBeenCalledWith(
        "cron.rates.currency_failed",
        expect.objectContaining({ error: expect.stringContaining("USD") }),
      );
    });
  });

  it("materializes recurring rules for the Taiwan calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z")); // 07-06 05:30 Taipei
    try {
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { materializeDueRecurringTransactions } =
        await import("@/lib/services/recurring-cash-service");
      const { materializeDueInvestments } =
        await import("@/lib/services/recurring-investment-service");

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

  it("uses the captured Taiwan business day for option expiry, recurring work, and snapshots", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z")); // Jul 6 05:30 Taipei
    h.expiredOptions = [
      { id: "expired-before-day", quantity: 2, expiration: new Date("2026-07-05T00:00:00Z") },
      { id: "active-on-day", quantity: 3, expiration: new Date("2026-07-06T00:00:00Z") },
      { id: "active-after-day", quantity: 4, expiration: new Date("2026-07-07T00:00:00Z") },
    ];
    try {
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { prisma } = await import("@/lib/prisma");
      const { materializeDueRecurringTransactions } =
        await import("@/lib/services/recurring-cash-service");
      const { materializeDueInvestments } =
        await import("@/lib/services/recurring-investment-service");

      const response = await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(response.status).toBe(200);
      const businessDay = new Date("2026-07-06T00:00:00.000Z");
      expect(vi.mocked(prisma.holding.findMany)).toHaveBeenCalledWith({
        where: {
          assetType: "OPTION",
          expiration: { lt: businessDay },
          quantity: { gt: 0 },
          account: { user: { demoWorkspace: null } },
        },
      });
      expect(vi.mocked(prisma.holding.updateMany)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.holding.updateMany)).toHaveBeenCalledWith({
        where: { id: "expired-before-day", quantity: 2 },
        data: { quantity: 0 },
      });
      expect(vi.mocked(prisma.holdingTransaction.create)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.holdingTransaction.create)).toHaveBeenCalledWith({
        data: {
          holdingId: "expired-before-day",
          type: "SELL",
          quantity: 2,
          note: "Expired",
        },
      });
      expect(vi.mocked(materializeDueRecurringTransactions)).toHaveBeenCalledWith(businessDay);
      expect(vi.mocked(materializeDueInvestments)).toHaveBeenCalledWith(businessDay);
      expect(h.snapshotOpts).toEqual([expect.objectContaining({ fresh: true, businessDay })]);
      expect(h.events.indexOf("option:expired-before-day:zeroed")).toBeLessThan(
        h.events.indexOf("option:expired-before-day:sell-recorded"),
      );
      expect(h.events.indexOf("option:expired-before-day:sell-recorded")).toBeLessThan(
        h.events.indexOf("snapshot-inputs:loaded"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves the UTC cutoff when UTC and Taiwan share the calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00.000Z")); // Jul 5 in UTC and Taipei
    try {
      const { GET } = await import("@/app/api/cron/snapshot/route");
      const { prisma } = await import("@/lib/prisma");
      const { materializeDueRecurringTransactions } =
        await import("@/lib/services/recurring-cash-service");
      const { materializeDueInvestments } =
        await import("@/lib/services/recurring-investment-service");

      const response = await GET(
        new Request("http://unit.test/api/cron/snapshot", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(response.status).toBe(200);
      const businessDay = new Date("2026-07-05T00:00:00.000Z");
      expect(vi.mocked(prisma.holding.findMany)).toHaveBeenCalledWith({
        where: {
          assetType: "OPTION",
          expiration: { lt: businessDay },
          quantity: { gt: 0 },
          account: { user: { demoWorkspace: null } },
        },
      });
      expect(vi.mocked(materializeDueRecurringTransactions)).toHaveBeenCalledWith(businessDay);
      expect(vi.mocked(materializeDueInvestments)).toHaveBeenCalledWith(businessDay);
      expect(h.snapshotOpts).toEqual([expect.objectContaining({ fresh: true, businessDay })]);
    } finally {
      vi.useRealTimers();
    }
  });
});
