import "server-only";
import { prisma } from "@/lib/prisma";
import { getCachedNetWorthSummary } from "./net-worth-service";

export async function createSnapshot(userId: string, baseCurrency: string) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  const snapshotTakenAt = new Date();
  // The cron fires at 21:30 UTC = 05:30 Taiwan time (#49) so the run lands just
  // after midnight local. Floor to the *Taiwan* calendar day (shift +8h before
  // reading UTC fields), not the raw UTC day, or a run at e.g. Jul 5 21:30 UTC
  // (Jul 6 05:30 Taipei) gets stamped Jul 5 — one day behind every calendar-day
  // bucketing elsewhere in the app (history table, heatmap, projections) that a
  // Taipei user actually sees. The result is still a fixed UTC-midnight Date, so
  // the `userId_date_baseCurrency` upsert key stays timezone-independent.
  const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taiwanNow = new Date(snapshotTakenAt.getTime() + TAIWAN_OFFSET_MS);
  const today = new Date(
    Date.UTC(taiwanNow.getUTCFullYear(), taiwanNow.getUTCMonth(), taiwanNow.getUTCDate()),
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
