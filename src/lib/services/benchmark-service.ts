import { prisma } from "@/lib/prisma";

export interface BenchmarkOption {
  symbol: string;
  labelKey: "benchmarkSP500" | "benchmarkNasdaq100";
}

export interface BenchmarkPricePoint {
  symbol: string;
  date: string;
  close: number;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: "^GSPC", labelKey: "benchmarkSP500" },
  { symbol: "^NDX", labelKey: "benchmarkNasdaq100" },
];

async function refreshBenchmarkRange(symbol: string, from: Date, to: Date): Promise<void> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();

    const rows = await yahooFinance.historical(symbol, {
      period1: from,
      period2: to,
      interval: "1d",
    });

    const validRows = rows
      .filter((r) => !!r.date && typeof r.close === "number")
      .map((r) => ({
        symbol,
        date: new Date(Date.UTC(r.date!.getUTCFullYear(), r.date!.getUTCMonth(), r.date!.getUTCDate())),
        close: r.close!,
      }));

    if (validRows.length === 0) return;

    for (const row of validRows) {
      await prisma.benchmarkPrice.upsert({
        where: { symbol_date: { symbol: row.symbol, date: row.date } },
        update: { close: row.close, updatedAt: new Date() },
        create: {
          symbol: row.symbol,
          date: row.date,
          close: row.close,
        },
      });
    }
  } catch (error) {
    console.error(`Failed to refresh benchmark history for ${symbol}:`, error);
  }
}

export async function getBenchmarkSeries(
  symbol: string,
  from: Date,
  to: Date,
): Promise<BenchmarkPricePoint[]> {
  const normalizedFrom = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const normalizedTo = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  const existing = await prisma.benchmarkPrice.findMany({
    where: {
      symbol,
      date: {
        gte: normalizedFrom,
        lte: normalizedTo,
      },
    },
    orderBy: { date: "asc" },
  });

  const lastExisting = existing[existing.length - 1];
  const needsRefresh =
    existing.length === 0 ||
    !lastExisting ||
    lastExisting.date.getTime() < normalizedTo.getTime() - 1000 * 60 * 60 * 24 * 2;

  if (needsRefresh) {
    const refreshStart = new Date(normalizedFrom);
    refreshStart.setUTCDate(refreshStart.getUTCDate() - 7);
    await refreshBenchmarkRange(symbol, refreshStart, normalizedTo);
  }

  const rows = await prisma.benchmarkPrice.findMany({
    where: {
      symbol,
      date: {
        gte: normalizedFrom,
        lte: normalizedTo,
      },
    },
    orderBy: { date: "asc" },
  });

  return rows.map((r) => ({
    symbol: r.symbol,
    date: r.date.toISOString().slice(0, 10),
    close: Number(r.close),
  }));
}
