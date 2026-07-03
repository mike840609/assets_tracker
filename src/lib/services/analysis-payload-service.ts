import "server-only";
import { unstable_cache } from "next/cache";
import {
  getAccountMonthlyCashFlow,
  getFullNormalizedHistory,
  getMonthlyCashFlow,
  getRawHistoryWithBreakdown,
} from "@/lib/services/history-service";

export interface AnalysisPayload {
  snapshots: Awaited<ReturnType<typeof getFullNormalizedHistory>>;
  cashFlowData: Awaited<ReturnType<typeof getMonthlyCashFlow>>;
  rawHistory: Awaited<ReturnType<typeof getRawHistoryWithBreakdown>>;
  accountCashFlow: Awaited<ReturnType<typeof getAccountMonthlyCashFlow>>;
}

export async function getCachedAnalysisPayload(
  userId: string,
  baseCurrency: string,
): Promise<AnalysisPayload> {
  return unstable_cache(
    async () => {
      const [snapshots, cashFlowData, rawHistory, accountCashFlow] = await Promise.all([
        getFullNormalizedHistory(userId, baseCurrency),
        getMonthlyCashFlow(userId, baseCurrency),
        getRawHistoryWithBreakdown(userId, baseCurrency),
        getAccountMonthlyCashFlow(userId, baseCurrency),
      ]);

      return {
        snapshots,
        cashFlowData,
        rawHistory,
        accountCashFlow,
      };
    },
    ["analysis-payload", userId, baseCurrency],
    {
      revalidate: 300,
      // All four bundled reads convert at current FX (getAllExchangeRates +
      // resolveRate), so an FX refresh must be able to invalidate this composite.
      tags: ["net-worth", "snapshots", "exchange-rates", `history:${userId}`, `accounts:${userId}`],
    },
  )();
}
