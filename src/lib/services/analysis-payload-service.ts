import "server-only";
import { unstable_cache } from "next/cache";
import {
  getAccountMonthlyCashFlow,
  getFullNormalizedHistory,
  getMonthlyCashFlow,
  getRawHistoryWithBreakdown,
} from "@/lib/services/history-service";
import { getInvestmentCostBasisSummary } from "@/lib/services/investment-cost-basis-service";
import { computeAnalysisRangeSeries } from "@/lib/services/analysis-series-service";
import { pickDefaultRange, type RangeLabel } from "@/lib/analysis-range";
import type { AnalysisPayload, AnalysisPayloadMeta } from "@/lib/analysis-contract";

async function getCachedAnalysisInputs(userId: string, baseCurrency: string) {
  return unstable_cache(
    async () => {
      const [snapshots, cashFlowData, rawHistory, accountCashFlow, investmentCostBasis] =
        await Promise.all([
          getFullNormalizedHistory(userId, baseCurrency),
          getMonthlyCashFlow(userId, baseCurrency),
          getRawHistoryWithBreakdown(userId, baseCurrency),
          getAccountMonthlyCashFlow(userId, baseCurrency),
          getInvestmentCostBasisSummary(userId, baseCurrency),
        ]);

      return {
        snapshots,
        cashFlowData,
        rawHistory,
        accountCashFlow,
        investmentCostBasis,
      };
    },
    ["analysis-inputs", userId, baseCurrency],
    {
      revalidate: 300,
      // All bundled reads convert at current FX (getAllExchangeRates +
      // resolveRate), so an FX refresh must be able to invalidate this composite.
      tags: [
        "net-worth",
        "snapshots",
        "exchange-rates",
        "prices",
        `history:${userId}`,
        `accounts:${userId}`,
      ],
    },
  )();
}

export async function getCachedAnalysisPayload(
  userId: string,
  baseCurrency: string,
): Promise<AnalysisPayload> {
  const { snapshots, rawHistory, cashFlowData, accountCashFlow, investmentCostBasis } =
    await getCachedAnalysisInputs(userId, baseCurrency);
  // One clock reading for the whole fill: the default range and its series must
  // agree on "now", even when a fill straddles midnight.
  const now = new Date();
  const defaultRange = pickDefaultRange(snapshots, now);

  return {
    seriesByRange: {
      [defaultRange]: computeAnalysisRangeSeries(
        snapshots,
        rawHistory,
        cashFlowData,
        accountCashFlow,
        defaultRange,
        now,
      ),
    },
    investmentCostBasis,
    snapshots,
    meta: {
      defaultRange,
    } satisfies AnalysisPayloadMeta,
  };
}

export async function getCachedAnalysisRangeSeries(
  userId: string,
  baseCurrency: string,
  range: RangeLabel,
) {
  const { snapshots, rawHistory, cashFlowData, accountCashFlow } = await getCachedAnalysisInputs(
    userId,
    baseCurrency,
  );

  return unstable_cache(
    async () =>
      computeAnalysisRangeSeries(snapshots, rawHistory, cashFlowData, accountCashFlow, range),
    ["analysis-range-series", userId, baseCurrency, range],
    {
      revalidate: 300,
      tags: [
        "net-worth",
        "snapshots",
        "exchange-rates",
        "prices",
        `history:${userId}`,
        `accounts:${userId}`,
      ],
    },
  )();
}
