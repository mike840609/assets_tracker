import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared fixtures, hoisted so the vi.mock factories (which are themselves
// hoisted above imports) can close over them.
interface SnapshotRowFixture {
  id: string;
  date: Date;
  createdAt: Date;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  breakdown: unknown;
  label: string | null;
  note: string | null;
}
interface CashTransactionFixture {
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  createdAt: Date;
  occurrenceDate: Date | null;
  recurringId: string | null;
  materializedAt: Date | null;
  materializedAtEstimated: boolean;
  accountId: string;
}
const h = vi.hoisted(() => ({
  rows: [] as SnapshotRowFixture[],
  latestSnapshot: null as SnapshotRowFixture | null,
  currencyMatchedSnapshot: null as SnapshotRowFixture | null,
  snapshotCurrencies: [] as string[],
  accounts: [] as unknown[],
  cashTransactions: [] as CashTransactionFixture[],
  prices: [] as { symbol: string; price: number; currency: string }[],
  rates: new Map<string, number>(),
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
    account: { findMany: vi.fn(async () => h.accounts) },
    netWorthSnapshot: {
      findMany: vi.fn(async () => h.rows),
      findFirst: vi.fn(async (args?: { where?: { baseCurrency?: string }; orderBy?: unknown }) => {
        // A baseCurrency-ordered findFirst is the min/max currency seek; mirror
        // the DB by sorting the user's currencies and taking the requested end.
        const direction = (args?.orderBy as { baseCurrency?: "asc" | "desc" } | undefined)
          ?.baseCurrency;
        if (direction) {
          const sorted = [...h.snapshotCurrencies].sort();
          const baseCurrency = direction === "asc" ? sorted[0] : sorted[sorted.length - 1];
          return baseCurrency === undefined ? null : { baseCurrency };
        }
        // Same-date row already stored in the target currency (reconciliation tie-break).
        if (typeof args?.where?.baseCurrency === "string") return h.currencyMatchedSnapshot;
        return h.latestSnapshot;
      }),
    },
    cashTransaction: {
      findMany: vi.fn(async (args?: { where?: { OR?: Array<Record<string, unknown>> } }) => {
        const or = args?.where?.OR;
        if (!or) return h.cashTransactions;
        // Faithfully apply the first-snapshot floor OR clause so tests that
        // depend on which rows survive the DB filter (e.g. #509) exercise the
        // real query semantics instead of ignoring `where`.
        const cmp = (op: string, a: Date, b: Date) =>
          op === "gt" ? a.getTime() > b.getTime() : a.getTime() >= b.getTime();
        return h.cashTransactions.filter((tx) =>
          or.some((branch) => {
            const recurring = branch.recurringId as { not?: null } | null | undefined;
            if (recurring === null && tx.recurringId !== null) return false;
            if (recurring && tx.recurringId === null) return false;

            const materialized = branch.materializedAt as { not?: null } | null | undefined;
            if (materialized === null && tx.materializedAt !== null) return false;
            if (materialized) {
              if (tx.materializedAt === null) return false;
              if (
                "gt" in materialized &&
                tx.materializedAt.getTime() <= (materialized.gt as Date).getTime()
              ) {
                return false;
              }
            }
            if (
              typeof branch.materializedAtEstimated === "boolean" &&
              tx.materializedAtEstimated !== branch.materializedAtEstimated
            ) {
              return false;
            }

            const occ = branch.occurrenceDate as Record<string, Date> | null | undefined;
            if (occ && typeof occ === "object") {
              if (tx.occurrenceDate == null) return false;
              const [op, floor] = Object.entries(occ)[0];
              return cmp(op, tx.occurrenceDate, floor);
            }
            if (occ === null) {
              if (tx.occurrenceDate != null) return false;
              const created = branch.createdAt as Record<string, Date>;
              const [op, floor] = Object.entries(created)[0];
              return cmp(op, tx.createdAt, floor);
            }
            const created = branch.createdAt as Record<string, Date> | undefined;
            if (!created) return materialized !== undefined || recurring !== undefined;
            const [op, floor] = Object.entries(created)[0];
            return cmp(op, tx.createdAt, floor);
          }),
        );
      }),
    },
    priceCache: { findMany: vi.fn(async () => h.prices) },
  },
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

const {
  getAccountMonthlyCashFlow,
  getMonthlyCashFlow,
  getFullNormalizedHistory,
  getNormalizedHistory,
  getSnapshotReconciliationWarning,
  getSnapshotReconciliationWarningFromHistory,
  hasForeignCurrencySnapshots,
  isBetterDuplicate,
} = await import("@/lib/services/history-service");
const { aggregateMonthlyChange, fillMonthRange, buildCashFlowBuckets, buildCumulativeGrowth } =
  await import("@/lib/services/analysis-service");
const { prisma } = await import("@/lib/prisma");

function row(
  over: Partial<SnapshotRowFixture> & Pick<SnapshotRowFixture, "id" | "date">,
): SnapshotRowFixture {
  return {
    createdAt: over.date,
    netWorth: 100,
    totalAssets: 100,
    totalLiabilities: 0,
    baseCurrency: "USD",
    breakdown: null,
    label: null,
    note: null,
    ...over,
  };
}

const created = new Date("2026-01-01T00:00:00.000Z");

function account(over: Record<string, unknown> = {}) {
  return {
    id: "acc",
    userId: "u1",
    name: "Cash",
    type: "ASSET",
    category: "BANK",
    currency: "USD",
    cashBalance: 1100,
    isActive: true,
    isPinned: false,
    sortOrder: 0,
    createdAt: created,
    updatedAt: created,
    holdings: [],
    ...over,
  };
}

beforeEach(() => {
  vi.useRealTimers();
  h.rows = [];
  h.latestSnapshot = null;
  h.currencyMatchedSnapshot = null;
  h.snapshotCurrencies = [];
  h.accounts = [];
  h.cashTransactions = [];
  h.prices = [];
  h.rates = new Map<string, number>();
});

describe("getFullNormalizedHistory (normalize + dedupe — locks E2)", () => {
  it.each([
    ["default history", () => getNormalizedHistory("u1", "USD")],
    ["full history", () => getFullNormalizedHistory("u1", "USD")],
    [
      "range history",
      () =>
        getFullNormalizedHistory("u1", "USD", {
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-01-31T00:00:00.000Z"),
        }),
    ],
  ])("revalues mixed-currency breakdown entries for %s", async (_name, loadHistory) => {
    h.rows = [
      row({
        id: "mixed",
        date: new Date("2026-01-15T00:00:00.000Z"),
        netWorth: 170,
        totalAssets: 250,
        totalLiabilities: 80,
        breakdown: {
          usd: { value: 100, currency: "USD" },
          eur: { value: 100, currency: "EUR" },
          debt: { value: 10_000, currency: "JPY" },
        },
        label: "Mixed portfolio",
        note: "Values retain their original currencies.",
      }),
    ];
    h.accounts = [
      account({ id: "usd", type: "ASSET", currency: "USD" }),
      account({ id: "eur", type: "ASSET", currency: "EUR" }),
      account({ id: "debt", type: "LIABILITY", currency: "JPY" }),
    ];
    h.rates = new Map([
      ["USD_EUR", 0.5],
      ["USD_JPY", 100],
    ]);

    const result = await loadHistory();

    expect(result).toEqual([
      {
        id: "mixed",
        date: "2026-01-15",
        createdAt: "2026-01-15T00:00:00.000Z",
        netWorth: 200,
        totalAssets: 300,
        totalLiabilities: 100,
        baseCurrency: "USD",
        label: "Mixed portfolio",
        note: "Values retain their original currencies.",
      },
    ]);
  });

  it("falls back to aggregate conversion when a breakdown account has been deleted", async () => {
    h.rows = [
      row({
        id: "deleted-account",
        date: new Date("2026-01-15T00:00:00.000Z"),
        netWorth: 3000,
        totalAssets: 3300,
        totalLiabilities: 300,
        baseCurrency: "TWD",
        breakdown: {
          active: { value: 100, currency: "USD" },
          deleted: { value: 300, currency: "TWD" },
        },
      }),
    ];
    h.accounts = [account({ id: "active", type: "ASSET" })];
    h.rates = new Map([["USD_TWD", 30]]);

    const result = await getFullNormalizedHistory("u1", "USD");

    expect(result[0]).toMatchObject({
      netWorth: 100,
      totalAssets: 110,
      totalLiabilities: 10,
    });
  });

  it("falls back to aggregate conversion when a breakdown entry is malformed", async () => {
    h.rows = [
      row({
        id: "malformed",
        date: new Date("2026-01-15T00:00:00.000Z"),
        netWorth: 3000,
        totalAssets: 3000,
        baseCurrency: "TWD",
        breakdown: {
          active: { value: null, currency: "USD" },
        },
      }),
    ];
    h.accounts = [account({ id: "active", type: "ASSET" })];
    h.rates = new Map([["USD_TWD", 30]]);

    const result = await getFullNormalizedHistory("u1", "USD");

    expect(result[0]).toMatchObject({
      netWorth: 100,
      totalAssets: 100,
      totalLiabilities: 0,
    });
  });

  it("sorts ascending by date", async () => {
    h.rows = [
      row({ id: "b", date: new Date("2026-02-01T00:00:00.000Z") }),
      row({ id: "a", date: new Date("2026-01-01T00:00:00.000Z") }),
    ];
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result.map((s) => s.date)).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("prefers the snapshot whose baseCurrency matches the target on same-day collisions", async () => {
    // The non-matching TWD row has the LATER createdAt, proving the
    // currency-match tie-break outranks recency.
    h.rows = [
      row({
        id: "usd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T06:00:00.000Z"),
        netWorth: 1000,
        baseCurrency: "USD",
      }),
      row({
        id: "twd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        netWorth: 30000,
        baseCurrency: "TWD",
      }),
    ];
    h.rates = new Map([["USD_TWD", 30]]);
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("usd");
    expect(result[0].netWorth).toBe(1000);
  });

  it("breaks same-currency same-day ties by greatest createdAt", async () => {
    h.rows = [
      row({
        id: "early",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T01:00:00.000Z"),
        netWorth: 100,
      }),
      row({
        id: "late",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T23:00:00.000Z"),
        netWorth: 200,
      }),
    ];
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("late");
    expect(result[0].netWorth).toBe(200);
  });

  it("renormalizes a non-target-currency snapshot using the current rate map", async () => {
    h.rows = [
      row({
        id: "twd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        netWorth: 3000,
        totalAssets: 3300,
        totalLiabilities: 300,
        baseCurrency: "TWD",
      }),
    ];
    h.rates = new Map([["USD_TWD", 30]]); // TWD→USD = 1/30
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result[0].netWorth).toBeCloseTo(100);
    expect(result[0].totalAssets).toBeCloseTo(110);
    expect(result[0].totalLiabilities).toBeCloseTo(10);
    expect(result[0].baseCurrency).toBe("USD");
  });

  it("preserves snapshot label and note through normalization", async () => {
    h.rows = [
      row({
        id: "labelled",
        date: new Date("2026-01-01T00:00:00.000Z"),
        label: "Bonus paid",
        note: "Annual bonus landed in brokerage cash.",
      }),
    ];

    const result = await getFullNormalizedHistory("u1", "USD");

    expect(result[0]).toMatchObject({
      id: "labelled",
      label: "Bonus paid",
      note: "Annual bonus landed in brokerage cash.",
    });
  });
});

describe("getAccountMonthlyCashFlow (occurrence-date bucketing — locks #498)", () => {
  function cashTx(over: Partial<CashTransactionFixture> = {}): CashTransactionFixture {
    return {
      amount: 100,
      type: "DEPOSIT",
      createdAt: new Date("2026-07-01T10:00:00.000Z"),
      occurrenceDate: null,
      recurringId: null,
      materializedAt: null,
      materializedAtEstimated: false,
      accountId: "acc",
      ...over,
    };
  }

  it("buckets a backdated transaction into its occurrenceDate month, not its createdAt month", async () => {
    h.accounts = [account()];
    h.cashTransactions = [
      cashTx({
        occurrenceDate: new Date("2026-05-15T00:00:00.000Z"), // happened in May…
        createdAt: new Date("2026-07-01T10:00:00.000Z"), // …entered in July
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([{ accountId: "acc", monthKey: "2026-05", contributions: 100 }]);
  });

  it("falls back to createdAt when occurrenceDate is null", async () => {
    h.accounts = [account()];
    h.cashTransactions = [
      cashTx({ occurrenceDate: null, createdAt: new Date("2026-06-10T08:00:00.000Z") }),
      cashTx({
        type: "WITHDRAWAL",
        amount: 40,
        occurrenceDate: null,
        createdAt: new Date("2026-06-20T08:00:00.000Z"),
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([{ accountId: "acc", monthKey: "2026-06", contributions: 60 }]);
  });

  it("uses each account's net-worth direction for asset, loan, and credit-card cash flows", async () => {
    h.accounts = [
      account({ id: "asset", type: "ASSET", category: "BANK" }),
      account({ id: "loan", type: "LIABILITY", category: "LOAN" }),
      account({ id: "credit-card", type: "LIABILITY", category: "CREDIT_CARD" }),
    ];
    h.cashTransactions = [
      cashTx({ accountId: "asset", amount: 100, type: "DEPOSIT" }),
      cashTx({ accountId: "asset", amount: 25, type: "WITHDRAWAL" }),
      cashTx({ accountId: "loan", amount: 100, type: "DEPOSIT" }),
      cashTx({ accountId: "loan", amount: 25, type: "WITHDRAWAL" }),
      cashTx({ accountId: "credit-card", amount: 40, type: "DEPOSIT" }),
      cashTx({ accountId: "credit-card", amount: 10, type: "WITHDRAWAL" }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([
      { accountId: "asset", monthKey: "2026-07", contributions: 75 },
      { accountId: "credit-card", monthKey: "2026-07", contributions: -30 },
      { accountId: "loan", monthKey: "2026-07", contributions: -75 },
    ]);
  });

  it("floors the effective date to the first snapshot instant, exclusive (#509)", async () => {
    h.accounts = [account()];
    h.latestSnapshot = row({
      id: "first",
      date: new Date("2026-03-05T00:00:00.000Z"),
      createdAt: new Date("2026-03-05T21:30:00.000Z"),
    });

    await getAccountMonthlyCashFlow("u1", "USD");

    const args = vi.mocked(prisma.cashTransaction.findMany).mock.lastCall?.[0] as {
      where: Record<string, unknown>;
    };
    // The floor is the first snapshot's createdAt with a strict `gt`: flows on/before
    // the first snapshot are already baked into the first bucket's baseline, so
    // counting them as contributions double-counts the opening deposit (#509).
    const floor = new Date("2026-03-05T21:30:00.000Z");
    expect(args.where.OR).toEqual([
      { materializedAtEstimated: false, materializedAt: { gt: floor } },
      { materializedAtEstimated: true, materializedAt: { not: null } },
      { materializedAt: null, recurringId: { not: null } },
      { materializedAt: null, recurringId: null, occurrenceDate: { gt: floor } },
      {
        materializedAt: null,
        recurringId: null,
        occurrenceDate: null,
        createdAt: { gt: floor },
      },
    ]);
    // The accountId/type conditions stay ANDed alongside the floor OR.
    expect(args.where.accountId).toEqual({ in: ["acc"] });
    expect(args.where.type).toEqual({ in: ["DEPOSIT", "WITHDRAWAL"] });
  });

  it("excludes flows between snapshot date midnight and the snapshot creation instant (#551)", async () => {
    h.accounts = [account()];
    h.latestSnapshot = row({
      id: "first",
      date: new Date("2026-03-05T00:00:00.000Z"),
      createdAt: new Date("2026-03-05T21:30:00.000Z"),
    });
    h.cashTransactions = [
      cashTx({
        amount: 100,
        occurrenceDate: null,
        createdAt: new Date("2026-03-05T12:00:00.000Z"),
      }),
      cashTx({
        amount: 25,
        occurrenceDate: null,
        createdAt: new Date("2026-03-05T22:00:00.000Z"),
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([{ accountId: "acc", monthKey: "2026-03", contributions: 25 }]);
  });

  it("keeps an opening deposit out of the first bucket's contributions (#509)", async () => {
    // Account opened with a $100k deposit on Mar 10; the first snapshot on
    // Mar 15 already reflects it (netWorth $100k). The market then earns $1k by
    // April. The opening deposit must NOT be attributed to March as a
    // contribution — otherwise marketPerformance shows a phantom −$100k loss
    // that buildCumulativeGrowth carries across the whole range.
    h.accounts = [account()];
    h.latestSnapshot = row({ id: "first", date: new Date("2026-03-15T00:00:00.000Z") });
    h.cashTransactions = [
      cashTx({
        amount: 100_000,
        type: "DEPOSIT",
        occurrenceDate: new Date("2026-03-10T00:00:00.000Z"),
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      }),
    ];

    const contributions = await getMonthlyCashFlow("u1", "USD");
    // No contribution should survive: the only flow predates the first snapshot.
    expect(contributions).toEqual([]);

    const nSnap = (date: string, netWorth: number) => ({
      id: date,
      date,
      createdAt: `${date}T00:00:00.000Z`,
      netWorth,
      totalAssets: netWorth,
      totalLiabilities: 0,
      baseCurrency: "USD",
      label: null,
      note: null,
    });
    const snapshots = [nSnap("2026-03-15", 100_000), nSnap("2026-04-15", 101_000)];
    const buckets = fillMonthRange(
      aggregateMonthlyChange(snapshots),
      new Date(Date.UTC(2026, 2, 1)),
      new Date(Date.UTC(2026, 3, 1)),
    );
    const cashFlow = buildCashFlowBuckets(buckets, contributions);
    const cumulative = buildCumulativeGrowth(cashFlow);

    // First bucket: no fake market loss.
    expect(cashFlow[0].contributions).toBe(0);
    expect(cashFlow[0].marketPerformance).toBeCloseTo(0);
    // Cumulative market reflects the real +$1k gain, not −$99k.
    expect(cumulative.at(-1)!.cumulativeMarket).toBeCloseTo(1_000);
  });

  it("omits the floor filter entirely when the user has no snapshots", async () => {
    h.accounts = [account()];

    await getAccountMonthlyCashFlow("u1", "USD");

    const args = vi.mocked(prisma.cashTransaction.findMany).mock.lastCall?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.OR).toBeUndefined();
  });

  it("includes a generated catch-up posted after the first snapshot after its rule is deleted", async () => {
    h.accounts = [account()];
    h.latestSnapshot = row({
      id: "first",
      date: new Date("2026-03-05T00:00:00.000Z"),
      createdAt: new Date("2026-03-05T21:30:00.000Z"),
    });
    h.cashTransactions = [
      cashTx({
        amount: 75,
        recurringId: null,
        occurrenceDate: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        materializedAt: new Date("2026-03-06T21:30:00.000Z"),
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([{ accountId: "acc", monthKey: "2026-03", contributions: 75 }]);
  });

  it("uses an estimated rule-creation posting bound for a legacy immediate backfill", async () => {
    h.accounts = [account()];
    h.latestSnapshot = row({
      id: "first",
      date: new Date("2026-03-05T00:00:00.000Z"),
      createdAt: new Date("2026-03-05T21:30:00.000Z"),
    });
    h.cashTransactions = [
      cashTx({
        amount: 80,
        recurringId: null,
        occurrenceDate: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        materializedAt: new Date("2026-03-06T12:00:00.000Z"),
        materializedAtEstimated: true,
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([{ accountId: "acc", monthKey: "2026-03", contributions: 80 }]);
  });

  it("excludes a legacy backdated recurring flow already represented in the first snapshot", async () => {
    h.accounts = [account()];
    h.latestSnapshot = row({
      id: "first",
      date: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2025-12-31T21:30:01.000Z"),
    });
    h.cashTransactions = [
      cashTx({
        amount: 100,
        recurringId: "monthly-deposit",
        occurrenceDate: new Date("2026-01-01T00:00:00.000Z"),
        // Rows created before #658 backdated both timestamps to the business
        // day, even though cron had posted the balance before this snapshot.
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ];

    const result = await getAccountMonthlyCashFlow("u1", "USD");

    expect(result).toEqual([]);
  });
});

describe("getSnapshotReconciliationWarning", () => {
  it("compares current balances with a latest-rate revaluation of the snapshot breakdown", async () => {
    h.latestSnapshot = row({
      id: "mixed",
      date: new Date("2026-01-01T00:00:00.000Z"),
      netWorth: 500,
      totalAssets: 500,
      breakdown: {
        acc: { value: 500, currency: "EUR" },
      },
    });
    h.accounts = [account({ cashBalance: 1100 })];
    h.rates = new Map([["USD_EUR", 0.5]]);

    const warning = await getSnapshotReconciliationWarning("u1", "USD");

    expect(warning).toMatchObject({
      difference: 100,
      baseCurrency: "USD",
    });
    expect(warning?.differencePercent).toBeCloseTo(0.1);
  });

  it("returns a non-mutating warning when current balances drift past the threshold", async () => {
    h.latestSnapshot = row({
      id: "snap",
      date: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T06:00:00.000Z"),
      netWorth: 1000,
      label: "Manual correction",
      note: "Imported brokerage migration.",
    });
    h.accounts = [account()];

    const warning = await getSnapshotReconciliationWarning("u1", "USD");

    expect(warning).toMatchObject({
      difference: 100,
      baseCurrency: "USD",
    });
    expect(warning?.differencePercent).toBeCloseTo(0.1);
  });

  it("returns null when drift stays inside the threshold", async () => {
    h.latestSnapshot = row({
      id: "snap",
      date: new Date("2026-01-01T00:00:00.000Z"),
      netWorth: 1000,
    });
    h.accounts = [account({ cashBalance: 1030 })];

    await expect(getSnapshotReconciliationWarning("u1", "USD")).resolves.toBeNull();
  });

  it("resolves the same-day tie-break the same way as the history fill", async () => {
    const usdRow = row({
      id: "usd",
      date: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T02:00:00.000Z"),
      netWorth: 900,
      totalAssets: 900,
    });
    const eurRow = row({
      id: "eur",
      date: new Date("2026-01-01T00:00:00.000Z"),
      // Newer, but stored in another currency: the currency match still wins.
      createdAt: new Date("2026-01-01T06:00:00.000Z"),
      netWorth: 500,
      totalAssets: 500,
      baseCurrency: "EUR",
    });
    h.rows = [usdRow, eurRow];
    h.latestSnapshot = eurRow;
    h.currencyMatchedSnapshot = usdRow;
    h.accounts = [account({ cashBalance: 1100 })];
    h.rates = new Map([["USD_EUR", 0.5]]);

    const fromHistory = await getSnapshotReconciliationWarningFromHistory(
      "u1",
      "USD",
      await getFullNormalizedHistory("u1", "USD"),
    );
    const fromDb = await getSnapshotReconciliationWarning("u1", "USD");

    // 1100 current - 900 from the USD row (the EUR row would revalue to 1000).
    expect(fromHistory?.difference).toBeCloseTo(200);
    expect(fromDb).toEqual(fromHistory);
  });

  it("returns null for an empty history without hitting the database", async () => {
    h.accounts = [account()];
    const findFirst = vi.mocked(prisma.netWorthSnapshot.findFirst);
    findFirst.mockClear();

    await expect(getSnapshotReconciliationWarningFromHistory("u1", "USD", [])).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("isBetterDuplicate (exported for import dedupe)", () => {
  it("prefers a currency match over a newer non-match", () => {
    expect(
      isBetterDuplicate(
        { matchesTarget: true, createdAt: new Date("2026-01-01T00:00:00Z") },
        { matchesTarget: false, createdAt: new Date("2026-06-01T00:00:00Z") },
      ),
    ).toBe(true);
  });

  it("prefers the newest createdAt among equal matches", () => {
    expect(
      isBetterDuplicate(
        { matchesTarget: true, createdAt: new Date("2026-01-01T00:00:00Z") },
        { matchesTarget: true, createdAt: new Date("2026-06-01T00:00:00Z") },
      ),
    ).toBe(false);
  });
});

describe("hasForeignCurrencySnapshots", () => {
  it.each([
    ["no snapshots at all", [], false],
    ["every snapshot already in the target currency", ["USD", "USD", "USD"], false],
    ["a foreign currency sorting below the target", ["EUR", "USD"], true],
    ["a foreign currency sorting above the target", ["USD", "ZAR"], true],
    ["only foreign currencies", ["EUR", "JPY"], true],
  ] as const)("%s", async (_label, currencies, expected) => {
    h.snapshotCurrencies = [...currencies];

    await expect(hasForeignCurrencySnapshots("user-1", "USD")).resolves.toBe(expected);
  });

  it("asks only for the min and max baseCurrency so the index prefix is seekable", async () => {
    h.snapshotCurrencies = ["USD"];
    vi.mocked(prisma.netWorthSnapshot.findFirst).mockClear();

    await hasForeignCurrencySnapshots("user-1", "USD");

    const calls = vi
      .mocked(prisma.netWorthSnapshot.findFirst)
      .mock.calls.map(([args]) => args as Record<string, unknown>);
    expect(calls).toEqual([
      {
        where: { userId: "user-1" },
        select: { baseCurrency: true },
        orderBy: { baseCurrency: "asc" },
      },
      {
        where: { userId: "user-1" },
        select: { baseCurrency: true },
        orderBy: { baseCurrency: "desc" },
      },
    ]);
  });
});
