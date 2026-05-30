import "server-only";
import { unstable_cache } from "next/cache";
import {
  getAccountMonthlyCashFlow,
  getFullNormalizedHistory,
  getMonthlyCashFlow,
  getRawHistoryWithBreakdown,
} from "@/lib/services/history-service";
import { getCachedNetWorthSummary } from "@/lib/services/net-worth-service";

export interface AnalysisPayload {
  snapshots: Awaited<ReturnType<typeof getFullNormalizedHistory>>;
  cashFlowData: Awaited<ReturnType<typeof getMonthlyCashFlow>>;
  rawHistory: Awaited<ReturnType<typeof getRawHistoryWithBreakdown>>;
  accountCashFlow: Awaited<ReturnType<typeof getAccountMonthlyCashFlow>>;
  summary: Awaited<ReturnType<typeof getCachedNetWorthSummary>>;
}

export async function getCachedAnalysisPayload(
  userId: string,
  baseCurrency: string,
): Promise<AnalysisPayload> {
  return unstable_cache(
    async () => {
      const [snapshots, cashFlowData, rawHistory, accountCashFlow, summary] = await Promise.all([
        getFullNormalizedHistory(userId, baseCurrency),
        getMonthlyCashFlow(userId, baseCurrency),
        getRawHistoryWithBreakdown(userId, baseCurrency),
        getAccountMonthlyCashFlow(userId, baseCurrency),
        getCachedNetWorthSummary(userId, baseCurrency),
      ]);

      return {
        snapshots,
        cashFlowData,
        rawHistory,
        accountCashFlow,
        summary,
      };
    },
    ["analysis-payload", userId, baseCurrency],
    {
      revalidate: 300,
      tags: ["net-worth", "snapshots", `history:${userId}`, `accounts:${userId}`],
    },
  )();
}
