import "server-only";
import { unstable_cache } from "next/cache";
import {
  getAccountMonthlyCashFlow,
  getFullNormalizedHistory,
  getMonthlyCashFlow,
  getRawHistoryWithBreakdown,
} from "@/lib/services/history-service";
import { getInvestmentCostBasisSummary } from "@/lib/services/investment-cost-basis-service";

export interface AnalysisPayload {
  snapshots: Awaited<ReturnType<typeof getFullNormalizedHistory>>;
  cashFlowData: Awaited<ReturnType<typeof getMonthlyCashFlow>>;
  rawHistory: Awaited<ReturnType<typeof getRawHistoryWithBreakdown>>;
  accountCashFlow: Awaited<ReturnType<typeof getAccountMonthlyCashFlow>>;
  investmentCostBasis: Awaited<ReturnType<typeof getInvestmentCostBasisSummary>>;
}

export async function getCachedAnalysisPayload(
  userId: string,
  baseCurrency: string,
): Promise<AnalysisPayload> {
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
    ["analysis-payload", userId, baseCurrency],
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
