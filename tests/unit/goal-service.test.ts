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
}
const h = vi.hoisted(() => ({
  goals: [] as GoalFixture[],
  snapshots: [] as SnapshotFixture[],
  summary: null as NetWorthSummary | null,
}));

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
      findMany: vi.fn(async () =>
        h.snapshots.map((s) => ({
          date: s.date,
          netWorth: s.netWorth,
          totalAssets: s.totalAssets,
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
  return { ...actual, getAllExchangeRates: vi.fn(async () => new Map<string, number>()) };
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
  });

  it("returns null linear projection (does not throw RangeError) for a near-flat trend against a huge gap", async () => {
    // +$1 over a 90-day window → dailyChange ≈ 0.011/day; a ~$10M remaining gap
    // makes daysToGoal ≈ 9e8 days, beyond the JS Date range. Pre-fix this
    // 500'd via `.toISOString()` on an Invalid Date.
    h.goals = [makeGoal({ targetAmount: 10_000_000 })];
    h.summary = makeSummary(2); // currentAmount = 2, target = 10M
    h.snapshots = [
      { date: new Date("2026-04-04T00:00:00.000Z"), netWorth: 1, totalAssets: 1 },
      { date: new Date("2026-07-03T00:00:00.000Z"), netWorth: 2, totalAssets: 2 },
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
    // +$10k over 90 days → ~$111/day; a $90k gap → ~810 days, well in range.
    h.goals = [makeGoal({ targetAmount: 200_000 })];
    h.summary = makeSummary(110_000);
    h.snapshots = [
      { date: new Date("2026-04-04T00:00:00.000Z"), netWorth: 100_000, totalAssets: 100_000 },
      { date: new Date("2026-07-03T00:00:00.000Z"), netWorth: 110_000, totalAssets: 110_000 },
    ];

    const result = await computeGoalsWithProgress("u1", "USD");
    const linear = result[0].projectedDateLinear;
    expect(linear).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(linear!))).toBe(false);
  });
});
