import "server-only";
import { prisma } from "@/lib/prisma";
import { getCachedNetWorthSummary } from "./net-worth-service";

export async function createSnapshot(userId: string, baseCurrency: string) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  const snapshotTakenAt = new Date();
  // Floor to UTC midnight: the `userId_date_baseCurrency` upsert key must be
  // timezone-independent, or the same calendar day maps to different keys
  // depending on the function region's local timezone.
  const today = new Date(
    Date.UTC(
      snapshotTakenAt.getUTCFullYear(),
      snapshotTakenAt.getUTCMonth(),
      snapshotTakenAt.getUTCDate(),
    ),
  );

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
      createdAt: snapshotTakenAt,
    },
    create: {
      userId,
      date: today,
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      netWorth: summary.netWorth,
      baseCurrency,
      breakdown,
      createdAt: snapshotTakenAt,
    },
  });

  return snapshot;
}
