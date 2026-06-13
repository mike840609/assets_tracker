import { describe, it, expect } from "vitest";
import {
  aggregateMonthlyChange,
  fillMonthRange,
  computeKpis,
  formatMonthLabel,
  buildCashFlowBuckets,
  aggregateCategoryHistory,
  computePerformanceAttribution,
  computeTopMovers,
} from "@/lib/services/analysis-service";
import type {
  NormalizedSnapshot,
  SnapshotBreakdown,
  AccountMeta,
} from "@/lib/services/history-service";
import type { AccountMonthlyContribution } from "@/lib/services/history-service";

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

describe("computeTopMovers", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "INVESTMENT" },
    { id: "a2", name: "Savings", category: "CASH" },
  ];

  it("ranks by absolute change and drops untouched accounts", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 100, a2: 1000 } },
      { date: "2026-02-01", accountValues: { a1: 400, a2: 1010 } },
    ];
    const movers = computeTopMovers(snapshots, accounts);
    expect(movers.map((m) => m.accountId)).toEqual(["a1", "a2"]);
    expect(movers[0]).toMatchObject({ absoluteChange: 300, percentChange: 300 });
  });

  it("returns [] when fewer than two snapshots", () => {
    expect(computeTopMovers([{ date: "2026-01-01", accountValues: { a1: 1 } }], accounts)).toEqual(
      [],
    );
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
