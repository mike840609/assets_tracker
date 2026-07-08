import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import { normalizeSnapshots } from "./history-service";

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
  cacheTag("exchange-rates");
  cacheLife("hours");

  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      select: {
        id: true,
        date: true,
        createdAt: true,
        netWorth: true,
        totalAssets: true,
        totalLiabilities: true,
        baseCurrency: true,
        label: true,
        note: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({ where: { userId }, select: { id: true, currency: true } }),
    getAllExchangeRates(),
  ]);

  if (snapshotsRaw.length === 0) {
    return { latestNetWorth: 0, trailing12mSavings: 0, annualSnapshots: [], hasData: false };
  }

  const normalized = normalizeSnapshots(snapshotsRaw, allRatesMap, baseCurrency);

  const latestNetWorth = normalized[normalized.length - 1].netWorth;

  // Last snapshot per calendar year
  const byYear = new Map<number, number>();
  for (const s of normalized) {
    // Snapshots are stored at UTC-midnight and deduped by their UTC date, so
    // bucket by the UTC year. A local getter would land a Jan-1-UTC snapshot in
    // the prior year on a west-of-UTC server (#514).
    byYear.set(new Date(`${s.date}T00:00:00.000Z`).getUTCFullYear(), s.netWorth);
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
      // Window by the effective date (occurrenceDate ?? createdAt) so backdated
      // or catch-up-materialized flows count in the month they occurred (#498).
      OR: [
        { occurrenceDate: { gte: twelveMonthsAgo } },
        { occurrenceDate: null, createdAt: { gte: twelveMonthsAgo } },
      ],
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
