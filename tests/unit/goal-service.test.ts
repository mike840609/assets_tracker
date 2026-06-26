import { describe, it, expect, beforeEach, vi } from "vitest";

// computeGoalsWithProgress is exercised through its public entry point. We
// neutralize the caching wrappers (React cache(), Next "use cache" tags) and
// feed deterministic goals + a net-worth summary through mocked Prisma and the
// mocked getCachedNetWorthSummary read. resolveRate stays real (identity rate)
// so the conversion path is genuinely exercised.

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

interface AccountValueFixture {
  id: string;
  category: string;
  type: "ASSET" | "LIABILITY";
  totalValueInBaseCurrency: number;
}

const h = vi.hoisted(() => ({
  goals: [] as GoalFixture[],
  summary: {
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    baseCurrency: "USD",
    currencyExposure: [],
    accounts: [] as AccountValueFixture[],
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T): T => fn };
});
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  withTiming: <T>(_name: string, fn: () => T) => fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    goal: { findMany: vi.fn(async () => h.goals) },
    netWorthSnapshot: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/services/net-worth-service", () => ({
  getCachedNetWorthSummary: vi.fn(async () => h.summary),
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  // Empty rate map → resolveRate falls back to identity for same-currency
  // pairs; goals here use the same base currency so targetAmount passes through.
  return { ...actual, getAllExchangeRates: vi.fn(async () => new Map<string, number>()) };
});

const { computeGoalsWithProgress } = await import("@/lib/services/goal-service");

const created = new Date("2026-01-01T00:00:00.000Z");

function goal(over: Partial<GoalFixture> & Pick<GoalFixture, "id" | "scope">): GoalFixture {
  return {
    userId: "user1",
    name: over.id,
    targetAmount: 10000,
    targetCurrency: "USD",
    targetDate: null,
    scopeRefId: null,
    sortOrder: 0,
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}

describe("computeGoalsWithProgress — CATEGORY scope sign convention", () => {
  beforeEach(() => {
    h.goals = [];
  });

  it("subtracts liability accounts so a debt-category goal nets non-positive", async () => {
    h.summary.accounts = [
      { id: "a1", category: "MORTGAGE", type: "LIABILITY", totalValueInBaseCurrency: 300000 },
      { id: "a2", category: "MORTGAGE", type: "LIABILITY", totalValueInBaseCurrency: 50000 },
      { id: "a3", category: "BANK", type: "ASSET", totalValueInBaseCurrency: 99999 },
    ];
    h.goals = [goal({ id: "g1", scope: "CATEGORY", scopeRefId: "MORTGAGE", targetAmount: 100000 })];

    const [result] = await computeGoalsWithProgress("user1", "USD");

    // Debt magnitudes are stored positive; signed they net negative.
    expect(result.currentAmount).toBe(-350000);
    expect(result.currentAmount).toBeLessThanOrEqual(0);
    // Negative current amount must not register as positive progress.
    expect(result.progressPercent).toBeLessThanOrEqual(0);
    expect(result.isCompleted).toBe(false);
  });

  it("leaves an asset-category goal unchanged (assets still add)", async () => {
    h.summary.accounts = [
      { id: "a1", category: "BANK", type: "ASSET", totalValueInBaseCurrency: 40000 },
      { id: "a2", category: "BANK", type: "ASSET", totalValueInBaseCurrency: 60000 },
      { id: "a3", category: "MORTGAGE", type: "LIABILITY", totalValueInBaseCurrency: 999999 },
    ];
    h.goals = [goal({ id: "g1", scope: "CATEGORY", scopeRefId: "BANK", targetAmount: 200000 })];

    const [result] = await computeGoalsWithProgress("user1", "USD");

    expect(result.currentAmount).toBe(100000);
    expect(result.progressPercent).toBe(50);
  });
});
