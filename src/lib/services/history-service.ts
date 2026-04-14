import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import type { NetWorthSnapshot } from "@/generated/prisma/client";

export interface NormalizedSnapshot {
  id: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
}

/** Default history window: last 90 days. Keeps the query fast for the dashboard. */
const DEFAULT_HISTORY_DAYS = 90;

/**
 * Pure transformation: convert and dedupe raw snapshots into NormalizedSnapshot[].
 * If multiple snapshots exist for the same date (e.g. from a currency change),
 * prefers the one whose baseCurrency already matches the target, otherwise the latest seen.
 */
function normalizeSnapshots(
  snapshots: NetWorthSnapshot[],
  allRatesMap: Map<string, number>,
  targetBaseCurrency: string,
): NormalizedSnapshot[] {
  const normalizedMap = new Map<string, NormalizedSnapshot>();

  for (const s of snapshots) {
    const dateStr = s.date.toISOString().split("T")[0];
    const rate = resolveRate(allRatesMap, s.baseCurrency, targetBaseCurrency) ?? 1;

    const normalized: NormalizedSnapshot = {
      id: s.id,
      date: dateStr,
      netWorth: Number(s.netWorth) * rate,
      totalAssets: Number(s.totalAssets) * rate,
      totalLiabilities: Number(s.totalLiabilities) * rate,
      baseCurrency: targetBaseCurrency,
    };

    const existing = normalizedMap.get(dateStr);
    if (!existing || s.baseCurrency === targetBaseCurrency) {
      normalizedMap.set(dateStr, normalized);
    }
  }

  return Array.from(normalizedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch and normalize net worth history for a user.
 * Converts all snapshots to the current target base currency.
 * Defaults to the last 90 days if no date range is specified.
 */
async function computeNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - DEFAULT_HISTORY_DAYS);

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId, date: { gte: fromDate } },
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}

/**
 * Cached version of normalized history (60-second TTL, invalidated by "snapshots" tag).
 * Used by the dashboard trend chart for fast repeated loads.
 */
export const getNormalizedHistory = unstable_cache(
  computeNormalizedHistory,
  ["normalized-history"],
  { revalidate: 60, tags: ["snapshots", "net-worth"] }
);

/**
 * Full history fetch (uncached, no date limit) for pages that need the complete history.
 */
export async function getFullNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
  options?: { from?: Date; to?: Date }
): Promise<NormalizedSnapshot[]> {
  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };
  if (options?.from || options?.to) {
    where.date = {};
    if (options.from) where.date.gte = options.from;
    if (options.to) where.date.lte = options.to;
  }

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where,
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}
