import { describe, it, expect } from "vitest";
import {
  computeAllRangeSeries,
  computeAnalysisRangeSeries,
} from "@/lib/services/analysis-series-service";
import type {
  NormalizedSnapshot,
  RawHistoryData,
  AccountMeta,
  AccountMonthlyContribution,
} from "@/lib/services/history-service";

function snap(date: string, netWorth: number): NormalizedSnapshot {
  return {
    id: date,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    netWorth,
    totalAssets: netWorth,
    totalLiabilities: 0,
    baseCurrency: "USD",
    label: null,
    note: null,
  };
}

const accounts: AccountMeta[] = [
  { id: "brokerage", name: "Brokerage", category: "BROKERAGE", type: "ASSET" },
];

const rawHistory: RawHistoryData = {
  snapshots: [
    { date: "2025-01-31", accountValues: { brokerage: 100 } },
    { date: "2025-03-31", accountValues: { brokerage: 200 } },
    { date: "2025-05-31", accountValues: { brokerage: 150 } },
    { date: "2025-12-31", accountValues: { brokerage: 170 } },
    { date: "2026-02-28", accountValues: { brokerage: 180 } },
    { date: "2026-06-30", accountValues: { brokerage: 190 } },
  ],
  accounts,
  unattributedDates: [],
};

const snapshots = rawHistory.snapshots.map((s) => snap(s.date, s.accountValues.brokerage));

const accountCashFlow: AccountMonthlyContribution[] = [
  { accountId: "brokerage", monthKey: "2025-06", contributions: 50 },
  { accountId: "brokerage", monthKey: "2026-02", contributions: 25 },
];

// 28 Jul 2026, 12:00 local — matches the analysis-range.test.ts timezone convention.
const NOW = new Date(2026, 6, 28, 12);

describe("computeAllRangeSeries", () => {
  it("produces every one of the five ranges with the full series shape", () => {
    const series = computeAllRangeSeries(snapshots, rawHistory, accountCashFlow, NOW);
    expect(Object.keys(series)).toEqual(["YTD", "6M", "1Y", "2Y", "All"]);
    for (const label of ["YTD", "6M", "1Y", "2Y", "All"] as const) {
      expect(series[label]).toMatchObject({
        buckets: expect.any(Array),
        kpis: expect.any(Object),
        cashFlowBuckets: expect.any(Array),
        cumulativeGrowth: expect.any(Array),
        categoryHistory: expect.any(Array),
        attributionItems: expect.any(Array),
        returnTrend: expect.any(Array),
      });
    }
  });
});

describe("locale-independent series", () => {
  it("produces all five ranges from month keys without preformatted labels", () => {
    const series = computeAllRangeSeries(snapshots, rawHistory, accountCashFlow, NOW);
    expect(Object.keys(series)).toEqual(["YTD", "6M", "1Y", "2Y", "All"]);
    for (const label of ["YTD", "6M", "1Y", "2Y", "All"] as const) {
      const s = series[label];
      expect(s.cashFlowBuckets[0].monthKey).toBeTypeOf("string");
      expect(s.cashFlowBuckets[0]).not.toHaveProperty("label");
      expect(s.cumulativeGrowth[0]).not.toHaveProperty("label");
      expect(s.returnTrend.length).toBeGreaterThan(0);
      expect(s.returnTrend[0]).not.toHaveProperty("label");
    }
  });
});

describe("computeAnalysisRangeSeries — 1Y (now = Jul 2026)", () => {
  const s = () => computeAnalysisRangeSeries(snapshots, rawHistory, accountCashFlow, "1Y", NOW);

  it("aligns buckets to the 1Y month window", () => {
    const series = s();
    expect(series.rangeStartIso).toBe("2025-07-01");
    expect(series.buckets.map((b) => b.monthKey)).toEqual([
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    expect(series.buckets.filter((b) => b.isEmpty)).toHaveLength(10); // 13 − 3 real
  });

  it("counts cash from the pre-range baseline onward and zeroes empty months", () => {
    const series = s();
    const feb = series.cashFlowBuckets.find((b) => b.monthKey === "2026-02")!;
    expect(feb.contributions).toBe(25);
    expect(feb.marketPerformance).toBeCloseTo(-15); // delta 10 − contrib 25
    // Dec's change runs from the May 31 baseline (150 → 170), which spans June's deposit.
    const dec = series.cashFlowBuckets.find((b) => b.monthKey === "2025-12")!;
    expect(dec.contributions).toBe(50);
    expect(dec.marketPerformance).toBe(-30);
    expect(series.cashFlowBuckets.find((b) => b.monthKey === "2025-07")?.contributions).toBe(0);
    expect(series.cashFlowBuckets.find((b) => b.monthKey === "2025-06")).toBeUndefined();
  });

  it("pads category history with monthKey-only points for months without snapshots (#511)", () => {
    const series = s();
    expect(series.categoryHistory).toHaveLength(13);
    expect(series.categoryHistory[0]).toEqual({ monthKey: "2025-07" });
    expect(series.categoryHistory.find((c) => c.monthKey === "2026-01")).toEqual({
      monthKey: "2026-01",
    });
    expect(series.categoryHistory.find((c) => c.monthKey === "2026-02")?.BROKERAGE).toBe(180);
  });

  it("computes attribution from the pre-range baseline with the cash since it", () => {
    const series = s();
    expect(series.attributionItems).toEqual([
      expect.objectContaining({
        accountName: "Brokerage",
        startValue: 150, // 2025-05-31, the last snapshot before 2025-07-01
        endValue: 190,
        totalDelta: 40,
        cashContribution: 75, // Jun 50 + Feb 25
        marketPerformance: -35,
      }),
    ]);
  });

  it("computes the half-weight Dietz return for the whole range", () => {
    expect(s().investmentReturnPct).toBeCloseTo(-35 / (150 + 75 / 2), 5);
  });

  it("chains monthly Dietz returns across the full month axis", () => {
    const series = s();
    expect(series.returnTrend).toHaveLength(13);
    // Dec: 150 (May 31 baseline) → 170 with June's 50 deposit at half weight.
    const dec = series.returnTrend.find((p) => p.monthKey === "2025-12")!;
    expect(dec.monthlyReturn).toBeCloseTo(-30 / 175, 10);
    expect(dec.cumulativeReturn).toBeCloseTo(-30 / 175, 10);
    const feb = series.returnTrend.find((p) => p.monthKey === "2026-02")!;
    expect(feb.monthlyReturn).toBeCloseTo(-15 / 182.5, 5);
    expect(feb.cumulativeReturn).toBeCloseTo((1 - 30 / 175) * (1 - 15 / 182.5) - 1, 5);
  });

  it("does not ship a drawdown series — the client derives it from snapshots", () => {
    expect(s()).not.toHaveProperty("drawdownSeries");
  });

  it("computes YTD KPIs from the full snapshot series, not the visible range", () => {
    const series = s();
    expect(series.kpis.ytdDelta).toBe(20); // latest 190 − prior-year-end 170
    expect(series.kpis.ytdPct).toBeCloseTo((20 / 170) * 100, 5);
    expect(series.kpis.avgMonthlyDelta).toBeCloseTo(40 / 3, 5); // Dec +20 (from May), Feb +10, Jun +10
    expect(series.kpis.best?.monthKey).toBe("2025-12");
    expect(series.kpis.worst?.monthKey).toBe("2026-02");
  });
});

describe("computeAnalysisRangeSeries — Taiwan-day month boundary", () => {
  // 2026-09-01 06:00 Taipei: the cron (21:30 UTC) has already stamped a
  // snapshot with the new month while a UTC host still reads August.
  const JUST_AFTER_CRON = new Date("2026-08-31T22:00:00Z");
  const withSeptember: RawHistoryData = {
    snapshots: [...rawHistory.snapshots, { date: "2026-09-01", accountValues: { brokerage: 210 } }],
    accounts,
    unattributedDates: [],
  };
  const septemberSnapshots = withSeptember.snapshots.map((s) =>
    snap(s.date, s.accountValues.brokerage),
  );

  it("keeps the newest month in the buckets", () => {
    const series = computeAnalysisRangeSeries(
      septemberSnapshots,
      withSeptember,
      accountCashFlow,
      "6M",
      JUST_AFTER_CRON,
    );
    expect(series.buckets.at(-1)?.monthKey).toBe("2026-09");
    expect(series.categoryHistory.at(-1)?.monthKey).toBe("2026-09");
  });

  it("shares one instant across every range", () => {
    const all = computeAllRangeSeries(
      septemberSnapshots,
      withSeptember,
      accountCashFlow,
      JUST_AFTER_CRON,
    );
    const lastMonths = Object.values(all).map((s) => s.buckets.at(-1)?.monthKey);
    expect(new Set(lastMonths)).toEqual(new Set(["2026-09"]));
  });
});

describe("computeAnalysisRangeSeries — empty history", () => {
  it("returns empty/zeroed series without throwing", () => {
    const s = computeAnalysisRangeSeries(
      [],
      { snapshots: [], accounts, unattributedDates: [] },
      [],
      "YTD",
      NOW,
    );
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets.every((b) => b.isEmpty)).toBe(true);
    expect(s.kpis).toEqual({
      best: null,
      worst: null,
      avgMonthlyDelta: 0,
      ytdDelta: 0,
      ytdPct: null,
    });
    expect(s.categoryHistory).toHaveLength(7);
    expect(s.attributionItems).toEqual([]);
    expect(s.returnTrend).toEqual([]);
    expect(s.investmentReturnPct).toBeNull();
  });
});

describe("computeAnalysisRangeSeries — hasUnattributedAccounts", () => {
  // rawHistory starts 2025-01-31; NOW = 28 Jul 2026, so the range starts are
  // YTD/6M 2026-01-01, 1Y 2025-07-01, 2Y 2024-07-01, All 2025-01-31.
  const withDeleted: RawHistoryData = { ...rawHistory, unattributedDates: ["2025-01-31"] };

  it("is false when no snapshot references a deleted account", () => {
    const series = computeAllRangeSeries(snapshots, rawHistory, accountCashFlow, NOW);
    for (const label of ["YTD", "6M", "1Y", "2Y", "All"] as const) {
      expect(series[label].hasUnattributedAccounts).toBe(false);
    }
  });

  it("flags only the ranges that actually contain the affected snapshot", () => {
    const series = computeAllRangeSeries(snapshots, withDeleted, accountCashFlow, NOW);
    expect(series.YTD.hasUnattributedAccounts).toBe(false);
    expect(series["6M"].hasUnattributedAccounts).toBe(false);
    expect(series["1Y"].hasUnattributedAccounts).toBe(false);
    expect(series["2Y"].hasUnattributedAccounts).toBe(true);
    expect(series.All.hasUnattributedAccounts).toBe(true);
  });

  it("includes a snapshot landing exactly on the range start", () => {
    const onBoundary: RawHistoryData = { ...rawHistory, unattributedDates: ["2026-01-01"] };
    const series = computeAnalysisRangeSeries(snapshots, onBoundary, accountCashFlow, "YTD", NOW);
    expect(series.rangeStartIso).toBe("2026-01-01");
    expect(series.hasUnattributedAccounts).toBe(true);
  });
});

describe("computeAnalysisRangeSeries — money without a deposit record", () => {
  // 6M on 12 Nov 2026 → range May–Nov. "new" brokerage is added in July with 100k.
  const now = new Date("2026-11-12T04:00:00Z");
  const accts: AccountMeta[] = [
    { id: "old", name: "Old brokerage", category: "BROKERAGE", type: "ASSET" },
    { id: "new", name: "New brokerage", category: "BROKERAGE", type: "ASSET" },
  ];
  const raw: RawHistoryData = {
    snapshots: [
      { date: "2026-04-30", accountValues: { old: 10000 } },
      { date: "2026-05-31", accountValues: { old: 10200 } },
      { date: "2026-07-10", accountValues: { old: 10300, new: 100000 } },
      { date: "2026-11-12", accountValues: { old: 10500, new: 100000 } },
    ],
    accounts: accts,
    unattributedDates: [],
  };
  const totals = raw.snapshots.map((s) =>
    snap(
      s.date,
      Object.values(s.accountValues).reduce((a, b) => a + b, 0),
    ),
  );
  const series = () => computeAnalysisRangeSeries(totals, raw, [], "6M", now);

  it("does not report a new account's opening value as investment return", () => {
    expect(series().investmentReturnPct).toBeCloseTo(500 / 60000, 5); // gain 500 on 10000 + 100000/2
  });

  it("attributes a new account's opening value to cash flow, not market", () => {
    const item = series().attributionItems.find((a) => a.accountId === "new")!;
    expect(item.cashContribution).toBe(100000);
    expect(item.marketPerformance).toBe(0);
  });

  it("shows the opening value as a contribution in the month it appeared", () => {
    const jul = series().cashFlowBuckets.find((b) => b.monthKey === "2026-07")!;
    expect(jul.contributions).toBe(100000);
    expect(jul.marketPerformance).toBe(100);
  });
});

describe("computeAnalysisRangeSeries — range edges", () => {
  const now = new Date("2026-11-12T04:00:00Z");
  const raw: RawHistoryData = {
    snapshots: [
      { date: "2026-04-30", accountValues: { brokerage: 1000 } },
      { date: "2026-05-01", accountValues: { brokerage: 1100 } },
      { date: "2026-05-31", accountValues: { brokerage: 1300 } },
      { date: "2026-10-31", accountValues: { brokerage: 1500 } },
      { date: "2026-11-12", accountValues: { brokerage: 1510 } },
    ],
    accounts,
    unattributedDates: [],
  };
  const totals = raw.snapshots.map((s) => snap(s.date, s.accountValues.brokerage));
  const series = () => computeAnalysisRangeSeries(totals, raw, [], "6M", now);

  it("measures the first month from the last snapshot before the range", () => {
    expect(series().buckets[0]).toMatchObject({ monthKey: "2026-05", deltaNetWorth: 300 });
    const attr = series().attributionItems[0];
    expect(attr.startValue).toBe(1000);
  });

  it("keeps the in-progress month out of best, worst and average", () => {
    const { kpis } = series();
    expect(kpis.worst?.monthKey).toBe("2026-10"); // +200, not November's partial +10
    expect(kpis.avgMonthlyDelta).toBeCloseTo(250, 5); // May +300, Oct +200
  });
});
