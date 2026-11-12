import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface CashRow {
  accountId: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  recurringId: string | null;
  occurrenceDate: Date | null;
  createdAt: Date;
  materializedAt: Date | null;
  materializedAtEstimated: boolean;
}

interface SnapshotRow {
  id: string;
  userId: string;
  date: Date;
  createdAt: Date;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  breakdown: Record<string, { value: number; currency: string }>;
  label: null;
  note: null;
}

const h = vi.hoisted(() => ({
  balance: 0,
  cashRows: [] as CashRow[],
  snapshotRows: [] as SnapshotRow[],
  dueRules: [] as Array<Record<string, unknown>>,
  accounts: [
    {
      id: "brokerage",
      userId: "u1",
      name: "Brokerage",
      type: "ASSET",
      category: "BROKERAGE",
      currency: "USD",
    },
  ],
}));

function matchesDate(value: Date, condition: Record<string, Date>): boolean {
  if (condition.gt) return value.getTime() > condition.gt.getTime();
  if (condition.gte) return value.getTime() >= condition.gte.getTime();
  return true;
}

function matchesCashWhere(row: CashRow, where: Record<string, unknown>): boolean {
  if (Array.isArray(where.OR) && !where.OR.some((branch) => matchesCashWhere(row, branch))) {
    return false;
  }
  if (Array.isArray(where.AND) && !where.AND.every((branch) => matchesCashWhere(row, branch))) {
    return false;
  }

  for (const [field, condition] of Object.entries(where)) {
    if (field === "OR" || field === "AND") continue;
    if (field === "accountId" || field === "type") {
      const values = (condition as { in?: string[] }).in;
      if (values && !values.includes(String(row[field]))) return false;
      continue;
    }
    if (field === "recurringId") {
      if (condition === null && row.recurringId !== null) return false;
      if (
        condition !== null &&
        (condition as { not?: null }).not === null &&
        row.recurringId === null
      ) {
        return false;
      }
      continue;
    }
    if (field === "materializedAt") {
      if (condition === null && row.materializedAt !== null) return false;
      if (condition !== null) {
        if ((condition as { not?: null }).not === null && row.materializedAt === null) {
          return false;
        }
        if (
          "gt" in (condition as object) &&
          (row.materializedAt === null ||
            row.materializedAt.getTime() <= ((condition as { gt: Date }).gt as Date).getTime())
        ) {
          return false;
        }
      }
      continue;
    }
    if (field === "materializedAtEstimated" && row.materializedAtEstimated !== condition) {
      return false;
    }
    if (field === "occurrenceDate") {
      if (condition === null) {
        if (row.occurrenceDate !== null) return false;
      } else if (
        row.occurrenceDate === null ||
        !matchesDate(row.occurrenceDate, condition as Record<string, Date>)
      ) {
        return false;
      }
      continue;
    }
    if (field === "createdAt" && !matchesDate(row.createdAt, condition as Record<string, Date>)) {
      return false;
    }
  }
  return true;
}

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => new Map<string, number>()) };
});
vi.mock("@/lib/services/net-worth-service", () => ({
  computeNetWorthSummary: vi.fn(async () => ({
    totalAssets: h.balance,
    totalLiabilities: 0,
    netWorth: h.balance,
    accounts: [
      {
        id: "brokerage",
        totalValue: h.balance,
        currency: "USD",
      },
    ],
  })),
  getCachedNetWorthSummary: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    account: {
      findMany: vi.fn(async () => h.accounts),
      update: vi.fn(async (args: { data: { cashBalance: { increment: unknown } } }) => {
        h.balance += Number(args.data.cashBalance.increment);
        return {};
      }),
    },
    recurringCashTransaction: {
      findMany: vi.fn(async () => h.dueRules),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    cashTransaction: {
      createMany: vi.fn(
        async (args: {
          data: Array<
            Omit<CashRow, "createdAt"> & {
              createdAt?: Date;
            }
          >;
        }) => {
          h.cashRows.push(
            ...args.data.map((row) => ({
              ...row,
              createdAt: row.createdAt ?? new Date(),
              materializedAt:
                "materializedAt" in row && row.materializedAt instanceof Date
                  ? row.materializedAt
                  : null,
              materializedAtEstimated:
                "materializedAtEstimated" in row && row.materializedAtEstimated === true,
            })),
          );
          return { count: args.data.length };
        },
      ),
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) =>
        h.cashRows.filter((row) => matchesCashWhere(row, args.where)),
      ),
    },
    netWorthSnapshot: {
      upsert: vi.fn(
        async (args: {
          create: Omit<SnapshotRow, "id" | "label" | "note">;
          update: Partial<SnapshotRow>;
        }) => {
          const row: SnapshotRow = {
            id: `snapshot-${h.snapshotRows.length + 1}`,
            label: null,
            note: null,
            ...args.create,
          };
          h.snapshotRows.push(row);
          return row;
        },
      ),
      findFirst: vi.fn(async () =>
        [...h.snapshotRows].sort((a, b) => a.date.getTime() - b.date.getTime()).at(0),
      ),
      findMany: vi.fn(async () =>
        [...h.snapshotRows].sort((a, b) => a.date.getTime() - b.date.getTime()),
      ),
    },
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    // Per-account first snapshot, as the DISTINCT ON breakdown-keys query returns it.
    $queryRaw: vi.fn(async () => {
      const firstSeen = new Map<string, { accountId: string; date: Date; createdAt: Date }>();
      for (const row of [...h.snapshotRows].sort((a, b) => a.date.getTime() - b.date.getTime())) {
        const breakdown = (row as { breakdown?: unknown }).breakdown;
        if (!breakdown || typeof breakdown !== "object") continue;
        for (const accountId of Object.keys(breakdown)) {
          if (!firstSeen.has(accountId)) {
            firstSeen.set(accountId, { accountId, date: row.date, createdAt: row.createdAt });
          }
        }
      }
      return [...firstSeen.values()];
    }),
  };
  return { prisma };
});

const { taiwanCalendarDay } = await import("@/lib/app-day");
const { materializeDueRecurringTransactions } =
  await import("@/lib/services/recurring-cash-service");
const { createSnapshot } = await import("@/lib/services/snapshot-service");
const {
  getAccountMonthlyCashFlow,
  getFullNormalizedHistory,
  getMonthlyCashFlow,
  getRawHistoryWithBreakdown,
} = await import("@/lib/services/history-service");
const {
  aggregateMonthlyChange,
  buildCashFlowBuckets,
  buildCumulativeGrowth,
  computeInvestmentReturn,
  computePerformanceAttribution,
} = await import("@/lib/services/analysis-service");

describe("first-day recurring cash flow (#658)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.balance = 0;
    h.cashRows = [];
    h.snapshotRows = [];
    h.dueRules = [
      {
        id: "monthly-deposit",
        accountId: "brokerage",
        type: "DEPOSIT",
        amount: 100,
        note: "Monthly savings",
        frequency: "MONTHLY",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        nextRunDate: new Date("2026-01-01T00:00:00.000Z"),
        isActive: true,
        updatedAt: new Date("2025-12-01T00:00:00.000Z"),
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not subtract a Taiwan Jan 1 deposit already represented in the first snapshot", async () => {
    // The real cron interleaving: 21:30 UTC is already Jan 1 in Taiwan.
    vi.setSystemTime(new Date("2025-12-31T21:30:00.000Z"));
    const businessDay = taiwanCalendarDay(new Date());
    expect(businessDay.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    await materializeDueRecurringTransactions(businessDay);
    // Deleting the rule sets the foreign key to null. Durable materialization
    // provenance must still keep this generated row out of the baseline.
    h.cashRows[0].recurringId = null;

    // Snapshotting happens after the balance-changing materialization.
    vi.setSystemTime(new Date("2025-12-31T21:30:01.000Z"));
    await createSnapshot("u1", "USD", { fresh: true });
    vi.setSystemTime(new Date("2026-01-30T21:30:00.000Z"));
    await createSnapshot("u1", "USD", { fresh: true });

    const [snapshots, monthlyCashFlow, accountCashFlow, rawHistory] = await Promise.all([
      getFullNormalizedHistory("u1", "USD"),
      getMonthlyCashFlow("u1", "USD"),
      getAccountMonthlyCashFlow("u1", "USD"),
      getRawHistoryWithBreakdown("u1", "USD"),
    ]);
    const cashFlow = buildCashFlowBuckets(aggregateMonthlyChange(snapshots), monthlyCashFlow);
    const cumulative = buildCumulativeGrowth(cashFlow);
    const attribution = computePerformanceAttribution(
      rawHistory.snapshots,
      rawHistory.accounts,
      accountCashFlow,
      "2026-01",
    );
    const investmentReturn = computeInvestmentReturn(
      rawHistory.snapshots,
      rawHistory.accounts,
      accountCashFlow,
      "2026-01",
    );

    expect(monthlyCashFlow).toEqual([]);
    expect(cashFlow[0]).toMatchObject({ contributions: 0, marketPerformance: 0 });
    expect(cumulative[0]).toMatchObject({
      cumulativeContributions: 0,
      cumulativeMarket: 0,
    });
    expect(attribution.reduce((sum, item) => sum + item.marketPerformance, 0)).toBe(0);
    expect(investmentReturn).toBe(0);
  });
});
