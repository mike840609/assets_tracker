import type { MonthlyContribution } from "./analysis-service";

export interface CashFlowTransaction {
  createdAt: Date;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  accountCurrency: string;
}

export type ResolveTransactionFxRate = (params: {
  fromCurrency: string;
  toCurrency: string;
  at: Date;
}) => number;

/**
 * Aggregate transactions into monthly net contributions in a target base currency.
 *
 * FX is resolved per-transaction (using the transaction timestamp). This keeps the
 * conversion hook compatible with historical FX providers while remaining fully
 * deterministic for unit tests.
 */
export function aggregateMonthlyCashFlow(
  transactions: CashFlowTransaction[],
  baseCurrency: string,
  resolveFxRate: ResolveTransactionFxRate,
): MonthlyContribution[] {
  const byMonth = new Map<string, number>();

  for (const tx of transactions) {
    const monthKey = tx.createdAt.toISOString().slice(0, 7);
    const fx = resolveFxRate({
      fromCurrency: tx.accountCurrency,
      toCurrency: baseCurrency,
      at: tx.createdAt,
    });
    const amountInBase = tx.amount * fx;
    const signed = tx.type === "DEPOSIT" ? amountInBase : -amountInBase;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + signed);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, contributions]) => ({ monthKey, contributions }));
}
