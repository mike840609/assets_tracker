import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUnstableCache = vi.hoisted(() => vi.fn());
const mockComputeAnalysisRangeSeries = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => ({
    buckets: [],
    kpis: {},
    cashFlowBuckets: [],
    cumulativeGrowth: [],
    categoryHistory: [],
    attributionItems: [],
    investmentReturnPct: null,
    returnTrend: [],
    rangeStartIso: "2026-01-01",
  })),
);
const mockCache = vi.hoisted(() => new Map<string, unknown>());

vi.mock("next/cache", () => ({
  unstable_cache: mockUnstableCache,
}));

vi.mock("@/lib/services/analysis-series-service", () => ({
  computeAnalysisRangeSeries: mockComputeAnalysisRangeSeries,
}));

vi.mock("@/lib/services/history-service", () => ({
  getFullNormalizedHistory: vi.fn(async () => []),
  getMonthlyCashFlow: vi.fn(async () => []),
  getRawHistoryWithBreakdown: vi.fn(async () => ({ snapshots: [], accounts: [] })),
  getAccountMonthlyCashFlow: vi.fn(async () => []),
}));

vi.mock("@/lib/services/investment-cost-basis-service", () => ({
  getInvestmentCostBasisSummary: vi.fn(async () => ({
    marketValue: 0,
    costedMarketValue: 0,
    costBasis: 0,
    unrealizedGain: null,
    unrealizedGainPct: null,
    pricedHoldingCount: 0,
    costedHoldingCount: 0,
  })),
}));

import {
  getCachedAnalysisPayload,
  getCachedAnalysisRangeSeries,
} from "@/lib/services/analysis-payload-service";

beforeEach(() => {
  mockUnstableCache.mockReset();
  mockCache.clear();
  mockComputeAnalysisRangeSeries.mockClear();
  mockUnstableCache.mockImplementation(
    (fn: () => Promise<unknown>, keyParts: readonly unknown[]) => {
      const key = JSON.stringify(keyParts);
      return async () => {
        if (!mockCache.has(key)) mockCache.set(key, await fn());
        return mockCache.get(key);
      };
    },
  );
});

describe("getCachedAnalysisPayload", () => {
  it("is keyed by user and base currency only — locale is not a key part and meta is reduced", async () => {
    const payload = await getCachedAnalysisPayload("user-1", "USD");

    expect(mockUnstableCache).toHaveBeenCalledTimes(1);
    const keyParts = mockUnstableCache.mock.calls[0]?.[1];
    expect(keyParts).toEqual(["analysis-inputs", "user-1", "USD"]);

    expect(payload.meta).toEqual({ defaultRange: "YTD" });
    expect(payload.meta).not.toHaveProperty("hasSnapshots");
    expect(payload.meta).not.toHaveProperty("latestSnapshotAt");
    expect(Object.keys(payload.seriesByRange)).toEqual([payload.meta.defaultRange]);
  });

  it("keys a requested range series by cached input fill, user, base currency, and range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T03:00:00.000Z"));

    await getCachedAnalysisRangeSeries("user-1", "USD", "All");

    expect(mockUnstableCache).toHaveBeenCalledTimes(2);
    expect(mockUnstableCache.mock.calls[0]?.[1]).toContain("analysis-inputs");
    expect(mockUnstableCache.mock.calls[1]?.[1]).toEqual([
      "analysis-range-series",
      "user-1",
      "USD",
      "2026-08-24T03:00:00.000Z",
      "All",
    ]);

    vi.useRealTimers();
  });

  it("uses the cached input fill timestamp for default and on-demand ranges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T03:00:00.000Z"));

    await getCachedAnalysisPayload("user-1", "USD");
    vi.advanceTimersByTime(60_000);
    await getCachedAnalysisRangeSeries("user-1", "USD", "All");

    expect(mockComputeAnalysisRangeSeries.mock.calls).toHaveLength(2);
    expect(mockComputeAnalysisRangeSeries.mock.calls[0]?.[5]).toEqual(
      new Date("2026-08-24T03:00:00.000Z"),
    );
    expect(mockComputeAnalysisRangeSeries.mock.calls[1]?.[5]).toEqual(
      new Date("2026-08-24T03:00:00.000Z"),
    );

    vi.useRealTimers();
  });
});
