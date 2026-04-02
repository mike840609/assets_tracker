import { prisma } from "@/lib/prisma";
import { getNetWorthSummary } from "./net-worth-service";

export async function createSnapshot(baseCurrency: string) {
  const summary = await getNetWorthSummary(baseCurrency);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const breakdown = Object.fromEntries(
    summary.accounts.map((a) => [a.id, a.totalValueInBaseCurrency])
  );

  const snapshot = await prisma.netWorthSnapshot.upsert({
    where: {
      date_baseCurrency: {
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
