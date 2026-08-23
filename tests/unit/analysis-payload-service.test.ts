import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUnstableCache = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  unstable_cache: mockUnstableCache,
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
  mockUnstableCache.mockImplementation((fn: () => Promise<unknown>) => () => fn());
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

  it("keys a requested range series by inputs, user, base currency, and range", async () => {
    await getCachedAnalysisRangeSeries("user-1", "USD", "All");

    expect(mockUnstableCache).toHaveBeenCalledTimes(2);
    expect(mockUnstableCache.mock.calls[0]?.[1]).toContain("analysis-inputs");
    expect(mockUnstableCache.mock.calls[1]?.[1]).toEqual([
      "analysis-range-series",
      "user-1",
      "USD",
      "All",
    ]);
  });
});
