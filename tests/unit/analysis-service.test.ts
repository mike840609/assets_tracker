import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  aggregateMonthlyChange,
  fillMonthRange,
  computeKpis,
  formatMonthLabel,
  buildCashFlowBuckets,
  buildCumulativeGrowth,
  aggregateCategoryHistory,
  computePerformanceAttribution,
  computeInvestmentReturn,
  computeInvestmentReturnSeries,
  computeDrawdownSeries,
  computeConcentration,
} from "@/lib/services/analysis-service";
import type {
  NormalizedSnapshot,
  SnapshotBreakdown,
  AccountMeta,
} from "@/lib/services/history-service";
import type { AccountMonthlyContribution } from "@/lib/services/history-service";
import type { NetWorthSummary } from "@/lib/types";

function snap(
  date: string,
  netWorth: number,
  assets = netWorth,
  liabilities = 0,
): NormalizedSnapshot {
  return {
    id: date,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    netWorth,
    totalAssets: assets,
    totalLiabilities: liabilities,
    baseCurrency: "USD",
    label: null,
    note: null,
  };
}

describe("aggregateMonthlyChange", () => {
  it("returns [] for no snapshots", () => {
    expect(aggregateMonthlyChange([])).toEqual([]);
  });

  it("groups by month and uses the last snapshot as the month end", () => {
    const buckets = aggregateMonthlyChange([
      snap("2026-01-05", 100),
      snap("2026-01-20", 150),
      snap("2026-02-10", 200),
    ]);
    expect(buckets).toHaveLength(2);
    // First month has no prior baseline → start = its own first snapshot.
    expect(buckets[0]).toMatchObject({
      monthKey: "2026-01",
      startNetWorth: 100,
      endNetWorth: 150,
      deltaNetWorth: 50,
    });
    // Second month's baseline is the prior month's last snapshot (150).
    expect(buckets[1]).toMatchObject({
      monthKey: "2026-02",
      startNetWorth: 150,
      endNetWorth: 200,
      deltaNetWorth: 50,
    });
  });

  it("yields null deltaPct when the baseline is zero", () => {
    const buckets = aggregateMonthlyChange([snap("2026-01-05", 0), snap("2026-01-20", 100)]);
    expect(buckets[0].deltaPct).toBeNull();
  });
});

describe("fillMonthRange", () => {
  it("pads missing months with isEmpty buckets", () => {
    const real = aggregateMonthlyChange([snap("2026-01-05", 100), snap("2026-03-05", 300)]);
    const filled = fillMonthRange(
      real,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 2, 1)),
    );
    expect(filled.map((b) => b.monthKey)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(filled[1]).toMatchObject({ monthKey: "2026-02", isEmpty: true, deltaNetWorth: 0 });
    expect(filled[0].isEmpty).toBe(false);
  });

  // Regression for #507: callers construct rangeStart/rangeEnd as UTC-midnight
  // (`new Date(Date.UTC(...))`), so fillMonthRange must read them back with UTC
  // getters. Read with local getters, a west-of-UTC timezone rolls the boundary
  // back a month — the current month (holding the latest snapshots) is dropped
  // and a phantom empty month is prepended. Force America/New_York (UTC-5) so
  // this fails deterministically with the old local-getter code and passes with
  // the fix, regardless of the CI runner's own timezone (UTC).
  describe("under a west-of-UTC timezone (America/New_York)", () => {
    const originalTz = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "America/New_York";
    });
    afterAll(() => {
      process.env.TZ = originalTz;
    });

    it("keeps the first and current month when rangeStart/rangeEnd are UTC-midnight", () => {
      // Jan-1-UTC is Dec-31 in New York; Jul-1-UTC is Jun-30 in New York.
      const rangeStart = new Date(Date.UTC(2026, 0, 1));
      const rangeEnd = new Date(Date.UTC(2026, 6, 1));
      const filled = fillMonthRange([], rangeStart, rangeEnd);
      const keys = filled.map((b) => b.monthKey);
      expect(keys[0]).toBe("2026-01"); // no phantom "2025-12" lead
      expect(keys[keys.length - 1]).toBe("2026-07"); // current month not dropped
      expect(keys).not.toContain("2025-12");
    });
  });
});

describe("computeKpis", () => {
  it("returns the empty shape when there are no real buckets", () => {
    expect(computeKpis([], [])).toEqual({
      best: null,
      worst: null,
      avgMonthlyDelta: 0,
      ytdDelta: 0,
      ytdPct: null,
    });
  });

  it("finds best/worst/avg and computes YTD against the prior-year baseline", () => {
    const snapshots = [
      snap("2025-12-31", 1000),
      snap("2026-01-31", 1200),
      snap("2026-02-28", 1100),
    ];
    const buckets = aggregateMonthlyChange(snapshots);
    const kpis = computeKpis(buckets, snapshots);
    expect(kpis.best?.monthKey).toBe("2026-01");
    expect(kpis.worst?.monthKey).toBe("2026-02");
    // YTD baseline = last prior-year snapshot (1000); latest = 1100.
    expect(kpis.ytdDelta).toBe(100);
    expect(kpis.ytdPct).toBeCloseTo(10);
  });
});

describe("formatMonthLabel", () => {
  it("formats a valid key", () => {
    expect(formatMonthLabel("2026-04", "en-US")).toBe("Apr 2026");
  });
  it("falls back to the raw key when malformed", () => {
    expect(formatMonthLabel("not-a-month")).toBe("not-a-month");
  });
});

describe("buildCashFlowBuckets", () => {
  it("splits net-worth change into contributions and market performance", () => {
    const buckets = [
      {
        monthKey: "2026-01",
        endDate: "2026-01",
        startNetWorth: 0,
        endNetWorth: 100,
        totalAssets: 100,
        totalLiabilities: 0,
        deltaNetWorth: 100,
        deltaPct: null,
        isEmpty: false,
      },
    ];
    const result = buildCashFlowBuckets(
      buckets,
      [{ monthKey: "2026-01", contributions: 60 }],
      "en-US",
    );
    expect(result[0]).toMatchObject({
      monthKey: "2026-01",
      contributions: 60,
      marketPerformance: 40,
      deltaNetWorth: 100,
    });
  });

  it("treats months with no contribution data as zero contribution", () => {
    const buckets = [
      {
        monthKey: "2026-02",
        endDate: "2026-02",
        startNetWorth: 100,
        endNetWorth: 90,
        totalAssets: 90,
        totalLiabilities: 0,
        deltaNetWorth: -10,
        deltaPct: null,
        isEmpty: false,
      },
    ];
    const result = buildCashFlowBuckets(buckets, [], "en-US");
    expect(result[0]).toMatchObject({ contributions: 0, marketPerformance: -10 });
  });
});

describe("buildCumulativeGrowth", () => {
  const bucket = (
    monthKey: string,
    contributions: number,
    marketPerformance: number,
    isEmpty = false,
  ) => ({
    monthKey,
    label: monthKey,
    contributions,
    marketPerformance,
    deltaNetWorth: contributions + marketPerformance,
    isEmpty,
  });

  it("accumulates contributions and market into running totals", () => {
    const result = buildCumulativeGrowth([
      bucket("2026-01", 100, 20),
      bucket("2026-02", 50, -10),
      bucket("2026-03", 0, 30),
    ]);
    expect(result.map((p) => p.cumulativeContributions)).toEqual([100, 150, 150]);
    expect(result.map((p) => p.cumulativeMarket)).toEqual([20, 10, 40]);
    expect(result.map((p) => p.cumulativeTotal)).toEqual([120, 160, 190]);
  });

  it("keeps the running total flat across empty padded months", () => {
    const result = buildCumulativeGrowth([
      bucket("2026-01", 100, 20),
      bucket("2026-02", 0, 0, true),
    ]);
    expect(result[1]).toMatchObject({ cumulativeContributions: 100, cumulativeTotal: 120 });
  });
});

describe("aggregateCategoryHistory", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "INVESTMENT" },
    { id: "a2", name: "Savings", category: "CASH" },
    { id: "a3", name: "401k", category: "INVESTMENT" },
  ];

  it("sums account values per category, keeping the last snapshot of each month", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-10", accountValues: { a1: 100, a2: 50, a3: 200 } },
      { date: "2026-01-28", accountValues: { a1: 110, a2: 55, a3: 210 } },
    ];
    const points = aggregateCategoryHistory(snapshots, accounts);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ monthKey: "2026-01", INVESTMENT: 320, CASH: 55 });
  });

  it("returns [] when there are no snapshots", () => {
    expect(aggregateCategoryHistory([], accounts)).toEqual([]);
  });
});

describe("computePerformanceAttribution", () => {
  const accounts: AccountMeta[] = [{ id: "a1", name: "Brokerage", category: "INVESTMENT" }];

  it("splits totalDelta into cash contribution and market performance", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000 } },
      { date: "2026-03-01", accountValues: { a1: 1500 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2025-12", contributions: 999 }, // before range — excluded
      { accountId: "a1", monthKey: "2026-02", contributions: 200 },
    ];
    const items = computePerformanceAttribution(snapshots, accounts, cashFlows, "2026-01");
    expect(items[0]).toMatchObject({
      totalDelta: 500,
      cashContribution: 200,
      marketPerformance: 300,
    });
  });

  it("returns [] when fewer than two snapshots", () => {
    expect(computePerformanceAttribution([], accounts, [], "2026-01")).toEqual([]);
  });
});

describe("computeInvestmentReturn", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "BROKERAGE" },
    { id: "a2", name: "Checking", category: "BANK" },
    { id: "a3", name: "Cold Wallet", category: "CRYPTO_WALLET" },
  ];

  it("computes Modified-Dietz return over investment accounts only", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000, a2: 5000, a3: 0 } },
      { date: "2026-03-01", accountValues: { a1: 1500, a2: 9000, a3: 0 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2025-12", contributions: 999 }, // before range — excluded
      { accountId: "a1", monthKey: "2026-02", contributions: 200 },
      { accountId: "a2", monthKey: "2026-02", contributions: 4000 }, // BANK — excluded
    ];
    // gain = 1500 − 1000 − 200 = 300; base = 1000 + 200/2 = 1100
    const result = computeInvestmentReturn(snapshots, accounts, cashFlows, "2026-01");
    expect(result).toBeCloseTo(300 / 1100, 10);
  });

  it("handles a withdrawal-heavy period (negative contributions)", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000 } },
      { date: "2026-03-01", accountValues: { a1: 650 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: -400 },
    ];
    // gain = 650 − 1000 − (−400) = 50; base = 1000 + (−400)/2 = 800
    const result = computeInvestmentReturn(snapshots, accounts, cashFlows, "2026-01");
    expect(result).toBeCloseTo(50 / 800, 10);
  });

  it("returns null when the base is zero or negative", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 0 } },
      { date: "2026-03-01", accountValues: { a1: 0 } },
    ];
    expect(computeInvestmentReturn(snapshots, accounts, [], "2026-01")).toBeNull();
    const withdrawnPast: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: -3000 },
    ];
    const bigSnapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000 } },
      { date: "2026-03-01", accountValues: { a1: 0 } },
    ];
    // base = 1000 + (−3000)/2 = −500 → null
    expect(computeInvestmentReturn(bigSnapshots, accounts, withdrawnPast, "2026-01")).toBeNull();
  });

  it("returns null with fewer than two snapshots", () => {
    expect(computeInvestmentReturn([], accounts, [], "2026-01")).toBeNull();
    expect(
      computeInvestmentReturn(
        [{ date: "2026-01-01", accountValues: { a1: 1000 } }],
        accounts,
        [],
        "2026-01",
      ),
    ).toBeNull();
  });

  it("returns null when the user has no investment accounts", () => {
    const bankOnly: AccountMeta[] = [{ id: "a2", name: "Checking", category: "BANK" }];
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a2: 5000 } },
      { date: "2026-03-01", accountValues: { a2: 6000 } },
    ];
    expect(computeInvestmentReturn(snapshots, bankOnly, [], "2026-01")).toBeNull();
  });
});

describe("computeInvestmentReturnSeries", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "BROKERAGE" },
    { id: "a2", name: "Checking", category: "BANK" },
  ];

  it("computes monthly Dietz returns and a chained cumulative index", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-05", accountValues: { a1: 1000, a2: 500 } },
      { date: "2026-01-31", accountValues: { a1: 1100, a2: 500 } },
      { date: "2026-02-28", accountValues: { a1: 1265, a2: 9999 } },
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      [],
      ["2026-01", "2026-02", "2026-03"],
      "en-US",
    );
    expect(points).toHaveLength(3);
    // Jan: first-month baseline = first snapshot within the month (1000), end 1100
    expect(points[0].monthlyReturn).toBeCloseTo(0.1, 10);
    expect(points[0].cumulativeReturn).toBeCloseTo(0.1, 10);
    // Feb: start = Jan month-end (1100), end 1265 → r = 0.15; index = 1.1*1.15 − 1
    expect(points[1].monthlyReturn).toBeCloseTo(0.15, 10);
    expect(points[1].cumulativeReturn).toBeCloseTo(0.265, 10);
    // Mar: no snapshots → empty gap, index carries forward
    expect(points[2]).toMatchObject({
      monthKey: "2026-03",
      monthlyReturn: null,
      isEmpty: true,
    });
    expect(points[2].cumulativeReturn).toBeCloseTo(0.265, 10);
    // BANK account movement (a2: 500 → 9999) must not affect any return
  });

  it("applies half-weight cash flows in the month they occur", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-31", accountValues: { a1: 1000 } },
      { date: "2026-02-28", accountValues: { a1: 1500 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: 200 },
      { accountId: "a2", monthKey: "2026-02", contributions: 4000 }, // BANK — excluded
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02"],
      "en-US",
    );
    // Feb: gain = 1500 − 1000 − 200 = 300; base = 1000 + 100 = 1100
    expect(points[1].monthlyReturn).toBeCloseTo(300 / 1100, 10);
  });

  it("skips base ≤ 0 months and carries the index through them", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-05", accountValues: { a1: 0 } },
      { date: "2026-01-31", accountValues: { a1: 0 } },
      { date: "2026-02-28", accountValues: { a1: 1000 } }, // funded by 1000 deposit
      { date: "2026-03-31", accountValues: { a1: 1100 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: 1000 },
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02", "2026-03"],
      "en-US",
    );
    // Jan: base = 0 → null return, index still null
    expect(points[0].monthlyReturn).toBeNull();
    expect(points[0].cumulativeReturn).toBeNull();
    expect(points[0].isEmpty).toBeUndefined();
    // Feb: start 0 + 1000/2 = 500 base, gain = 1000 − 0 − 1000 = 0 → r = 0
    expect(points[1].monthlyReturn).toBeCloseTo(0, 10);
    expect(points[1].cumulativeReturn).toBeCloseTo(0, 10);
    // Mar: r = 100/1000 = 0.1; index = 1.0*1.1 − 1
    expect(points[2].monthlyReturn).toBeCloseTo(0.1, 10);
    expect(points[2].cumulativeReturn).toBeCloseTo(0.1, 10);
  });

  it("rolls cash flows from snapshot-less gap months into the next computable month", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-31", accountValues: { a1: 1000 } },
      { date: "2026-03-31", accountValues: { a1: 11100 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: 10000 }, // deposited during the gap
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02", "2026-03"],
      "en-US",
    );
    expect(points[1].isEmpty).toBe(true);
    // Mar: gain = 11100 − 1000 − 10000 = 100; base = 1000 + 10000/2 = 6000
    expect(points[2].monthlyReturn).toBeCloseTo(100 / 6000, 10);
  });

  it("ignores cash flows in leading gap months before the first snapshot baseline", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-02-05", accountValues: { a1: 10000 } },
      { date: "2026-02-28", accountValues: { a1: 10500 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-01", contributions: 10000 }, // predates the baseline
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02"],
      "en-US",
    );
    expect(points[0].isEmpty).toBe(true);
    // Feb baseline is the first snapshot within Feb (10000), which already contains the Jan deposit
    expect(points[1].monthlyReturn).toBeCloseTo(500 / 10000, 10);
  });

  it("returns [] with fewer than two snapshots or no investment accounts", () => {
    expect(
      computeInvestmentReturnSeries(
        [{ date: "2026-01-31", accountValues: { a1: 1000 } }],
        accounts,
        [],
        ["2026-01"],
        "en-US",
      ),
    ).toEqual([]);
    const bankOnly: AccountMeta[] = [{ id: "a2", name: "Checking", category: "BANK" }];
    const snaps: SnapshotBreakdown[] = [
      { date: "2026-01-31", accountValues: { a2: 500 } },
      { date: "2026-02-28", accountValues: { a2: 600 } },
    ];
    expect(
      computeInvestmentReturnSeries(snaps, bankOnly, [], ["2026-01", "2026-02"], "en-US"),
    ).toEqual([]);
  });
});

describe("computeDrawdownSeries", () => {
  it("returns [] for no snapshots", () => {
    expect(computeDrawdownSeries([], "2020-01-01")).toEqual([]);
  });

  it("is all zeros for a strictly rising series", () => {
    const s = [snap("2024-01-01", 100), snap("2024-02-01", 120), snap("2024-03-01", 150)];
    expect(computeDrawdownSeries(s, "2024-01-01").map((p) => p.drawdownPct)).toEqual([0, 0, 0]);
  });

  it("computes the trough and recovery back to 0", () => {
    const s = [snap("2024-01-01", 100), snap("2024-02-01", 80), snap("2024-03-01", 100)];
    const r = computeDrawdownSeries(s, "2024-01-01");
    expect(r[0].drawdownPct).toBe(0);
    expect(r[1].drawdownPct).toBeCloseTo(-20);
    expect(r[2].drawdownPct).toBe(0);
  });

  it("uses the all-time peak even when it precedes the range window", () => {
    const s = [snap("2024-01-01", 200), snap("2024-02-01", 150), snap("2024-03-01", 150)];
    const r = computeDrawdownSeries(s, "2024-02-01");
    expect(r).toHaveLength(2);
    expect(r[0].date).toBe("2024-02-01");
    expect(r[0].drawdownPct).toBeCloseTo(-25); // 150 measured against all-time peak 200
  });

  it("guards divide-by-zero when the running peak is non-positive", () => {
    const s = [snap("2024-01-01", -50), snap("2024-02-01", -80)];
    expect(computeDrawdownSeries(s, "2024-01-01").every((p) => p.drawdownPct === 0)).toBe(true);
  });
});

function assetSummary(
  totalAssets: number,
  holdings: { name: string; symbol: string; marketValueInBaseCurrency: number | null }[],
): NetWorthSummary {
  return {
    totalAssets,
    totalLiabilities: 0,
    netWorth: totalAssets,
    baseCurrency: "USD",
    currencyExposure: [],
    accounts: [
      {
        type: "ASSET",
        holdings,
      },
    ],
  } as unknown as NetWorthSummary; // test double: only the fields computeConcentration reads
}

describe("computeConcentration", () => {
  it("returns zeros and no positions for an empty portfolio", () => {
    const r = computeConcentration(assetSummary(0, []));
    expect(r.top).toEqual([]);
    expect(r.topHoldingPct).toBe(0);
    expect(r.hhi).toBe(0);
  });

  it("reports 100% and hhi 1 for a single holding", () => {
    const r = computeConcentration(
      assetSummary(1000, [{ name: "Apple", symbol: "AAPL", marketValueInBaseCurrency: 1000 }]),
    );
    expect(r.topHoldingPct).toBeCloseTo(100);
    expect(r.top[0].label).toBe("Apple");
    expect(r.hhi).toBeCloseTo(1);
  });

  it("sorts descending, caps at 5, and skips non-positive/null holdings", () => {
    const r = computeConcentration(
      assetSummary(1000, [
        { name: "A", symbol: "A", marketValueInBaseCurrency: 100 },
        { name: "B", symbol: "B", marketValueInBaseCurrency: 400 },
        { name: "C", symbol: "C", marketValueInBaseCurrency: 200 },
        { name: "D", symbol: "D", marketValueInBaseCurrency: 50 },
        { name: "E", symbol: "E", marketValueInBaseCurrency: 150 },
        { name: "F", symbol: "F", marketValueInBaseCurrency: 100 },
        { name: "Z", symbol: "Z", marketValueInBaseCurrency: null },
        { name: "Y", symbol: "Y", marketValueInBaseCurrency: -10 },
      ]),
    );
    expect(r.top.map((p) => p.label)).toEqual(["B", "C", "E", "A", "F"]);
    expect(r.top[0].pct).toBeCloseTo(40);
  });

  it("falls back to symbol when a holding has no name", () => {
    const r = computeConcentration(
      assetSummary(500, [{ name: "", symbol: "BTC", marketValueInBaseCurrency: 500 }]),
    );
    expect(r.top[0].label).toBe("BTC");
  });
});
