import "server-only";
import { prisma } from "@/lib/prisma";
import { getNetWorthSummary } from "./net-worth-service";

export async function createSnapshot(userId: string, baseCurrency: string) {
  const summary = await getNetWorthSummary(userId, baseCurrency);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const breakdown = Object.fromEntries(
    summary.accounts.map((a) => [a.id, { value: a.totalValue, currency: a.currency }]),
  );

  const snapshot = await prisma.netWorthSnapshot.upsert({
    where: {
      userId_date_baseCurrency: {
        userId,
        date: today,
        baseCurrency,
      },
    },
    update: {
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      netWorth: summary.netWorth,
      breakdown,
    },
    create: {
      userId,
      date: today,
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      netWorth: summary.netWorth,
      baseCurrency,
      breakdown,
    },
  });

  return snapshot;
}
