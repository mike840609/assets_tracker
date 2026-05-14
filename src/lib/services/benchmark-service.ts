import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export interface IndexDataPoint {
  /** ISO date of the month-end row: "YYYY-MM-DD". */
  date: string;
  close: number;
}

export interface IndexHistory {
  symbol: string;
  /** Human-readable label shown in the chart legend. */
  label: string;
  data: IndexDataPoint[];
}

const INDEX_META = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^RUT", label: "Russell 2000" },
] as const;

export const INDEX_SYMBOLS = INDEX_META.map((m) => m.symbol);

export async function getIndexHistory(): Promise<IndexHistory[]> {
  "use cache";
  cacheTag("index-prices");
  cacheLife("hours");

  const YahooFinance = (await import("yahoo-finance2")).default;
  const yahooFinance = new YahooFinance();

  // 3-year lookback covers All/2Y/1Y/6M/YTD range selectors without extra fetches
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 3);
  const period1Str = period1.toISOString().split("T")[0];

  const results = await Promise.allSettled(
    INDEX_META.map(async ({ symbol, label }): Promise<IndexHistory> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await yahooFinance.historical(symbol, {
        period1: period1Str,
        interval: "1mo",
      });
      return {
        symbol,
        label,
        data: rows
          .filter((r) => (r.adjClose ?? r.close) != null)
          .map((r) => ({
            date: (r.date as Date).toISOString().split("T")[0],
            close: (r.adjClose ?? r.close) as number,
          })),
      };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<IndexHistory> => r.status === "fulfilled")
    .map((r) => r.value);
}
