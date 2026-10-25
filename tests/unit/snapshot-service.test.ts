import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  upsertArgs: [] as unknown[],
  cachedCalls: [] as unknown[],
  computeCalls: [] as unknown[],
  unresolvedPairs: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    netWorthSnapshot: {
      upsert: vi.fn(async (args: unknown) => {
        h.upsertArgs.push(args);
        return { id: "snap1" };
      }),
    },
  },
}));

// The two readers return DIFFERENT numbers on purpose: 100 stands for the
// pre-refresh value the cached (stale-while-revalidate) summary still holds
// during a cron run, 250 for what a direct DB read sees after the refresh.
vi.mock("@/lib/services/net-worth-service", () => ({
  getCachedNetWorthSummary: vi.fn(async (userId: string, baseCurrency: string) => {
    h.cachedCalls.push({ userId, baseCurrency });
    return {
      totalAssets: 100,
      totalLiabilities: 0,
      netWorth: 100,
      accounts: [],
      ...(h.unresolvedPairs.length > 0 && { unresolvedRatePairs: [...h.unresolvedPairs] }),
    };
  }),
  computeNetWorthSummary: vi.fn(
    async (userId: string, baseCurrency: string, opts?: { fresh?: boolean }) => {
      h.computeCalls.push({ userId, baseCurrency, opts });
      return {
        totalAssets: 250,
        totalLiabilities: 0,
        netWorth: 250,
        accounts: [],
        ...(h.unresolvedPairs.length > 0 && { unresolvedRatePairs: [...h.unresolvedPairs] }),
      };
    },
  ),
}));

import { createSnapshot } from "@/lib/services/snapshot-service";

describe("createSnapshot date bucketing", () => {
  afterEach(() => {
    vi.useRealTimers();
    h.upsertArgs.length = 0;
  });

  // Regression: the cron fires at 21:30 UTC — deliberately 05:30 Taiwan time
  // (#49) — so a run just after Taiwan midnight must be bucketed under the
  // Taiwan calendar day it actually occurred on, not the UTC day (which is
  // still "yesterday"). Otherwise every calendar-day view a Taipei user sees
  // (history table, heatmap) shows that day's snapshot dated one day early.
  it("buckets a 21:30 UTC run under the Taiwan calendar day, not the UTC day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z")); // Jul 6 05:30 Taipei

    await createSnapshot("u1", "USD");

    const args = h.upsertArgs[0] as { create: { date: Date } };
    expect(args.create.date.toISOString().split("T")[0]).toBe("2026-07-06");
  });

  it("uses the caller's captured business day when snapshot execution crosses a day boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T16:30:00.000Z")); // Jul 7 00:30 Taipei

    await createSnapshot("u1", "USD", {
      businessDay: new Date("2026-07-06T00:00:00.000Z"),
    });

    const args = h.upsertArgs[0] as {
      where: { userId_date_baseCurrency: { date: Date } };
      create: { date: Date };
    };
    expect(args.where.userId_date_baseCurrency.date).toEqual(new Date("2026-07-06T00:00:00.000Z"));
    expect(args.create.date).toEqual(new Date("2026-07-06T00:00:00.000Z"));
  });
});

// Regression #640: the cron refreshes prices/FX and materializes recurring rows,
// then revalidates `net-worth` / `prices` / `exchange-rates` / `accounts` with
// `"max"` — stale-while-revalidate, i.e. "the stale content is served while
// fresh content is fetched in the background" (Next 16 revalidateTag docs). The
// cached summary is tagged with exactly those tags, so snapshotting it persisted
// the PREVIOUS cron cycle's numbers and shifted the whole history one day.
describe("createSnapshot summary source", () => {
  beforeEach(() => {
    h.upsertArgs.length = 0;
    h.cachedCalls.length = 0;
    h.computeCalls.length = 0;
  });

  it("persists the uncached summary on the fresh path and never touches the cached read", async () => {
    await createSnapshot("u1", "USD", { fresh: true });

    expect(h.computeCalls).toEqual([{ userId: "u1", baseCurrency: "USD", opts: { fresh: true } }]);
    expect(h.cachedCalls).toEqual([]);
    const args = h.upsertArgs[0] as {
      create: { netWorth: number; totalAssets: number };
      update: { netWorth: number };
    };
    // 250 = post-refresh. 100 would mean the stale cached summary was persisted.
    expect(args.create.netWorth).toBe(250);
    expect(args.create.totalAssets).toBe(250);
    expect(args.update.netWorth).toBe(250);
  });

  it("still reads through the cached summary by default (render/manual callers)", async () => {
    await createSnapshot("u1", "USD");

    expect(h.cachedCalls).toEqual([{ userId: "u1", baseCurrency: "USD" }]);
    expect(h.computeCalls).toEqual([]);
    const args = h.upsertArgs[0] as { create: { netWorth: number } };
    expect(args.create.netWorth).toBe(100);
  });
});

describe("createSnapshot FX guard", () => {
  beforeEach(() => {
    h.upsertArgs.length = 0;
    h.unresolvedPairs = [];
  });

  it("refuses to persist a summary with an unresolved rate pair", async () => {
    h.unresolvedPairs = ["EUR->USD"];

    await expect(createSnapshot("u1", "USD", { fresh: true })).rejects.toThrow(
      /unresolved exchange rate/i,
    );

    expect(h.upsertArgs).toHaveLength(0);
  });

  it("persists normally once every pair resolves", async () => {
    await createSnapshot("u1", "USD", { fresh: true });

    expect(h.upsertArgs).toHaveLength(1);
  });
});
