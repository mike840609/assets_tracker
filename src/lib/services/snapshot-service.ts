import "server-only";
import { prisma } from "@/lib/prisma";
import { getNetWorthSummary } from "./net-worth-service";
import { log } from "@/lib/logger";

/**
 * Thrown when a snapshot would be computed with missing exchange rates
 * (values silently converted at 1:1). Snapshots are permanent records, so
 * persisting them with known-wrong conversions is worse than skipping a day.
 */
export class UnresolvedRatesError extends Error {
  constructor(
    public readonly userId: string,
    public readonly pairs: string[],
  ) {
    super(`Cannot snapshot with unresolved exchange rates: ${pairs.join(", ")}`);
    this.name = "UnresolvedRatesError";
  }
}

export async function createSnapshot(userId: string, baseCurrency: string) {
  const summary = await getNetWorthSummary(userId, baseCurrency);

  // Optional chaining: summaries cached (unstable_cache) before this field
  // existed may survive a deploy without it.
  const unresolvedPairs = summary.unresolvedRatePairs ?? [];
  if (unresolvedPairs.length > 0) {
    log.error("snapshot.unresolved_rates", { userId, baseCurrency, pairs: unresolvedPairs });
    throw new UnresolvedRatesError(userId, unresolvedPairs);
  }
  const snapshotTakenAt = new Date();
  const today = new Date(snapshotTakenAt);
  today.setHours(0, 0, 0, 0);

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
