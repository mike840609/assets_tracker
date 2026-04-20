import "server-only";
import { cacheLife, cacheTag } from "next/cache";
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
 * Cache Components read of the default (last-90-day) normalized
 * history. Tagged both globally (`snapshots`, `net-worth`) and
 * per-user (`history:${userId}`) so cron snapshot + account mutations
 * can invalidate cleanly.
 */
export async function getNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  "use cache";
  cacheTag("snapshots");
  cacheTag("net-worth");
  cacheTag(`history:${userId}`);
  cacheLife("minutes");

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
 * Full history fetch for pages that need the complete history.
 * Uses `"use cache"` only when no custom range is supplied; a custom
 * range short-circuits to a raw DB call so the cache key isn't
 * polluted by arbitrary window selections.
 */
export async function getFullNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
  options?: { from?: Date; to?: Date }
): Promise<NormalizedSnapshot[]> {
  if (options?.from || options?.to) {
    return fetchFullHistoryRange(userId, targetBaseCurrency, options);
  }
  return fetchFullHistoryCached(userId, targetBaseCurrency);
}

async function fetchFullHistoryCached(
  userId: string,
  targetBaseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  "use cache";
  cacheTag("snapshots");
  cacheTag("net-worth");
  cacheTag(`history:${userId}`);
  cacheLife("minutes");

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}

async function fetchFullHistoryRange(
  userId: string,
  targetBaseCurrency: string,
  options: { from?: Date; to?: Date },
): Promise<NormalizedSnapshot[]> {
  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };
  where.date = {};
  if (options.from) where.date.gte = options.from;
  if (options.to) where.date.lte = options.to;

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where,
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}
