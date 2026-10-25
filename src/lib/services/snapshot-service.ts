import "server-only";
import { prisma } from "@/lib/prisma";
import {
  computeNetWorthSummary,
  getCachedNetWorthSummary,
  type NetWorthInputs,
} from "./net-worth-service";
import { taiwanCalendarDay } from "@/lib/app-day";

/**
 * Persists today's NetWorthSnapshot for one user.
 *
 * `fresh` computes the summary from direct DB reads instead of
 * `getCachedNetWorthSummary`. The cron MUST pass it: it refreshes prices/FX and
 * materializes recurring rows, then revalidates `net-worth` / `prices` /
 * `exchange-rates` / `accounts` with `"max"` — stale-while-revalidate, so the
 * cached summary (tagged with exactly those tags) serves the PREVIOUS cycle's
 * numbers while the fresh value loads in the background. Snapshotting that read
 * shifted the whole persisted history one day (#640).
 *
 * `preloaded` carries inputs the caller already bulk-loaded, so a multi-user
 * sweep costs a fixed number of queries instead of three per user (#641). It
 * only changes where the data comes from, never the arithmetic.
 *
 * `businessDay` lets a batch caller keep every snapshot on the calendar day
 * captured when the run began, even if later work crosses a day boundary.
 */
export async function createSnapshot(
  userId: string,
  baseCurrency: string,
  opts: { fresh?: boolean; preloaded?: NetWorthInputs; businessDay?: Date } = {},
) {
  const summary =
    opts.fresh || opts.preloaded
      ? await computeNetWorthSummary(userId, baseCurrency, {
          fresh: true,
          preloaded: opts.preloaded,
        })
      : await getCachedNetWorthSummary(userId, baseCurrency);
  const snapshotTakenAt = new Date();
  // A missing FX rate is valued at 1:1 for display so the dashboard still
  // renders. Persisting that number would freeze a wrong valuation into
  // history forever, so the writer refuses instead. The cron records the user
  // in `failedUserIds` and retries on the next run (or after a rate backfill).
  const unresolvedRatePairs = summary.unresolvedRatePairs ?? [];
  if (unresolvedRatePairs.length > 0) {
    throw new Error(
      `Refusing to persist snapshot with unresolved exchange rate(s): ${unresolvedRatePairs.join(", ")}`,
    );
  }
  // The cron fires at 21:30 UTC = 05:30 Taiwan time (#49) so the run lands just
  // after midnight local. Floor to the *Taiwan* calendar day (shift +8h before
  // reading UTC fields), not the raw UTC day, or a run at e.g. Jul 5 21:30 UTC
  // (Jul 6 05:30 Taipei) gets stamped Jul 5 — one day behind every calendar-day
  // bucketing elsewhere in the app (history table, heatmap, projections) that a
  // Taipei user actually sees. The result is still a fixed UTC-midnight Date, so
  // the `userId_date_baseCurrency` upsert key stays timezone-independent.
  const today = opts.businessDay ?? taiwanCalendarDay(snapshotTakenAt);

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
