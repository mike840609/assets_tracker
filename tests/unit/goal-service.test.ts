import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NetWorthSummary } from "@/lib/types";

// Shared fixtures, hoisted so the vi.mock factories (themselves hoisted above
// imports) can close over them.
interface GoalFixture {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  targetCurrency: string;
  targetDate: Date | null;
  scope: "NET_WORTH" | "ASSETS_ONLY" | "CATEGORY" | "ACCOUNT";
  scopeRefId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
interface SnapshotFixture {
  date: Date;
  netWorth: number;
  totalAssets: number;
  baseCurrency?: string;
  createdAt?: Date;
}
const h = vi.hoisted(() => ({
  goals: [] as GoalFixture[],
  snapshots: [] as SnapshotFixture[],
  summary: null as NetWorthSummary | null,
  rates: new Map<string, number>(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T): T => fn };
});
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    goal: { findMany: vi.fn(async () => h.goals) },
    netWorthSnapshot: {
      findMany: vi.fn(async (args?: { where?: { baseCurrency?: string; date?: { gte?: Date } } }) =>
        h.snapshots
          .filter(
            (s) =>
              !args?.where?.baseCurrency || (s.baseCurrency ?? "USD") === args.where.baseCurrency,
          )
          .filter((s) => !args?.where?.date?.gte || s.date >= args.where.date.gte)
          .map((s) => ({
            id: s.date.toISOString(),
            date: s.date,
            createdAt: s.createdAt ?? s.date,
            netWorth: s.netWorth,
            totalAssets: s.totalAssets,
            totalLiabilities: 0,
            baseCurrency: s.baseCurrency ?? "USD",
            label: null,
            note: null,
          })),
      ),
    },
  },
}));
vi.mock("@/lib/services/net-worth-service", () => ({
  getCachedNetWorthSummary: vi.fn(async () => h.summary),
}));
// Keep resolveRate real (identity path returns 1 for same-currency); only stub
// the bulk loader so no DB/network is hit.
vi.mock("@/lib/services/exchange-rate-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

import { computeGoalsWithProgress } from "@/lib/services/goal-service";

function makeGoal(overrides: Partial<GoalFixture> = {}): GoalFixture {
  return {
    id: "g1",
    userId: "u1",
    name: "Test goal",
    targetAmount: 10_000_000,
    targetCurrency: "USD",
    targetDate: null,
    scope: "NET_WORTH",
    scopeRefId: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSummary(netWorth: number): NetWorthSummary {
  return {
    totalAssets: netWorth,
    totalLiabilities: 0,
    netWorth,
    baseCurrency: "USD",
    currencyExposure: [],
    accounts: [],
  };
}

describe("computeGoalsWithProgress projection bounds", () => {
  beforeEach(() => {
    h.goals = [];
    h.snapshots = [];
    h.summary = null;
    h.rates = new Map<string, number>();
  });

  it("returns null linear projection (does not throw RangeError) for a near-flat trend against a huge gap", async () => {
    // +$1 over a 90-day window → dailyChange ≈ 0.011/day; a ~$10M remaining gap
    // makes daysToGoal ≈ 9e8 days, beyond the JS Date range. Pre-fix this
    // 500'd via `.toISOString()` on an Invalid Date.
    h.goals = [makeGoal({ targetAmount: 10_000_000 })];
    h.summary = makeSummary(2); // currentAmount = 2, target = 10M
    h.snapshots = [
      { date: daysAgo(80), netWorth: 1, totalAssets: 1 },
      { date: daysAgo(1), netWorth: 2, totalAssets: 2 },
    ];

    let result: Awaited<ReturnType<typeof computeGoalsWithProgress>>;
    await expect(
      (async () => {
        result = await computeGoalsWithProgress("u1", "USD");
      })(),
    ).resolves.not.toThrow();

    expect(result![0].projectedDateLinear).toBeNull();
  });

  it("returns a valid ISO date for a reasonable trend (happy path unchanged)", async () => {
    // +$10k over a recent window; a $90k gap remains well in range.
    h.goals = [makeGoal({ targetAmount: 200_000 })];
    h.summary = makeSummary(110_000);
    h.snapshots = [
      { date: daysAgo(80), netWorth: 100_000, totalAssets: 100_000 },
      { date: daysAgo(1), netWorth: 110_000, totalAssets: 110_000 },
    ];

    const result = await computeGoalsWithProgress("u1", "USD");
    const linear = result[0].projectedDateLinear;
    expect(linear).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(linear!))).toBe(false);
  });

  it("projects from snapshots captured before a base-currency switch", async () => {
    h.goals = [makeGoal({ targetAmount: 400 })];
    h.summary = makeSummary(300);
    h.rates = new Map([["TWD_USD", 0.25]]);
    h.snapshots = [
      {
        date: daysAgo(30),
        netWorth: 400,
        totalAssets: 400,
        baseCurrency: "TWD",
      },
      {
        date: daysAgo(1),
        netWorth: 800,
        totalAssets: 800,
        baseCurrency: "TWD",
      },
    ];

    const result = await computeGoalsWithProgress("u1", "USD");

    expect(result[0].projectedDateLinear).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
