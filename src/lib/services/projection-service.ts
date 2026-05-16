import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";

export interface ProjectionData {
  latestNetWorth: number;
  trailing12mSavings: number;
  /** Last snapshot value per calendar year, sorted ascending. */
  annualSnapshots: { year: number; netWorth: number }[];
  hasData: boolean;
}

export async function getProjectionData(
  userId: string,
  baseCurrency: string,
): Promise<ProjectionData> {
  "use cache";
  cacheTag("snapshots");
  cacheTag("net-worth");
  cacheTag(`history:${userId}`);
  cacheTag(`accounts:${userId}`);
  cacheLife("hours");

  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      select: { date: true, netWorth: true, baseCurrency: true },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({ where: { userId }, select: { id: true, currency: true } }),
    getAllExchangeRates(),
  ]);

  if (snapshotsRaw.length === 0) {
    return { latestNetWorth: 0, trailing12mSavings: 0, annualSnapshots: [], hasData: false };
  }

  // Normalize to baseCurrency, dedupe per date (prefer baseCurrency-matching snapshot)
  const dedupedMap = new Map<string, { date: Date; netWorth: number; bc: string }>();
  for (const s of snapshotsRaw) {
    const dateStr = s.date.toISOString().split("T")[0];
    const existing = dedupedMap.get(dateStr);
    if (!existing || s.baseCurrency === baseCurrency) {
      const rate = resolveRate(allRatesMap, s.baseCurrency, baseCurrency) ?? 1;
      dedupedMap.set(dateStr, {
        date: s.date,
        netWorth: Number(s.netWorth) * rate,
        bc: s.baseCurrency,
      });
    }
  }

  const normalized = Array.from(dedupedMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const latestNetWorth = normalized[normalized.length - 1].netWorth;

  // Last snapshot per calendar year
  const byYear = new Map<number, number>();
  for (const s of normalized) {
    byYear.set(s.date.getFullYear(), s.netWorth);
  }
  const annualSnapshots = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, netWorth]) => ({ year, netWorth }));

  // Trailing 12-month net cash (DEPOSIT − WITHDRAWAL)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const accountIds = accountsRaw.map((a) => a.id);
  const accountCurrencyMap = new Map(accountsRaw.map((a) => [a.id, a.currency]));

  const transactions = await prisma.cashTransaction.findMany({
    where: {
      accountId: { in: accountIds },
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
      createdAt: { gte: twelveMonthsAgo },
    },
    select: { amount: true, type: true, accountId: true },
  });

  let trailing12mSavings = 0;
  for (const tx of transactions) {
    const currency = accountCurrencyMap.get(tx.accountId) ?? "USD";
    const rate = resolveRate(allRatesMap, currency, baseCurrency) ?? 1;
    const amount = Number(tx.amount) * rate;
    trailing12mSavings += tx.type === "DEPOSIT" ? amount : -amount;
  }

  return { latestNetWorth, trailing12mSavings, annualSnapshots, hasData: true };
}
