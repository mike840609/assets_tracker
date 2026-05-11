import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import type { Decimal } from "@/generated/prisma/runtime/library";
import type { MonthlyContribution } from "./analysis-service";

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

interface SnapshotRow {
  id: string;
  date: Date;
  netWorth: Decimal;
  totalAssets: Decimal;
  totalLiabilities: Decimal;
  baseCurrency: string;
}

/**
 * Pure transformation: convert and dedupe raw snapshots into NormalizedSnapshot[].
 * If multiple snapshots exist for the same date (e.g. from a currency change),
 * prefers the one whose baseCurrency already matches the target, otherwise the latest seen.
 */
function normalizeSnapshots(
  snapshots: SnapshotRow[],
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
      select: {
        id: true,
        date: true,
        netWorth: true,
        totalAssets: true,
        totalLiabilities: true,
        baseCurrency: true,
      },
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
  options?: { from?: Date; to?: Date },
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
      select: {
        id: true,
        date: true,
        netWorth: true,
        totalAssets: true,
        totalLiabilities: true,
        baseCurrency: true,
      },
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

// ---------------------------------------------------------------------------
// Phase 2: raw history with breakdown + account metadata
// ---------------------------------------------------------------------------

/**
 * One snapshot's worth of per-account values, all converted to the target
 * base currency using current exchange rates (v1 known drift).
 */
export interface SnapshotBreakdown {
  /** "YYYY-MM-DD" */
  date: string;
  /** accountId → value in baseCurrency */
  accountValues: Record<string, number>;
}

/** Minimal account metadata needed for category/mover computations. */
export interface AccountMeta {
  id: string;
  name: string;
  category: string;
}

export interface RawHistoryData {
  /** Sorted ascending by date, one entry per calendar day (deduped). */
  snapshots: SnapshotBreakdown[];
  /** All accounts belonging to the user (including inactive, to cover old snapshots). */
  accounts: AccountMeta[];
}

/**
 * Fetch raw NetWorthSnapshot breakdown data + account metadata for a user.
 * breakdown.value is in each account's own currency; this function converts
 * every entry to targetBaseCurrency using current exchange rates.
 *
 * NOTE (v1 drift): exchange rates used are today's rates, not historical rates
 * at the time each snapshot was taken. This is acceptable for v1 visualisation.
 */
export async function getRawHistoryWithBreakdown(
  userId: string,
  targetBaseCurrency: string,
): Promise<RawHistoryData> {
  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      select: { date: true, breakdown: true, baseCurrency: true },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, category: true },
    }),
    getAllExchangeRates(),
  ]);

  // Dedupe by date (same pattern as normalizeSnapshots): prefer the snapshot
  // whose baseCurrency matches the target; otherwise keep the last one seen.
  const dedupedMap = new Map<string, { breakdown: unknown; baseCurrency: string }>();
  for (const s of snapshotsRaw) {
    const dateStr = s.date.toISOString().split("T")[0];
    const existing = dedupedMap.get(dateStr);
    if (!existing || s.baseCurrency === targetBaseCurrency) {
      dedupedMap.set(dateStr, { breakdown: s.breakdown, baseCurrency: s.baseCurrency });
    }
  }

  const snapshots: SnapshotBreakdown[] = Array.from(dedupedMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { breakdown }]) => {
      const accountValues: Record<string, number> = {};

      if (breakdown && typeof breakdown === "object" && !Array.isArray(breakdown)) {
        const raw = breakdown as Record<string, { value?: unknown; currency?: unknown }>;
        for (const [accountId, entry] of Object.entries(raw)) {
          const value = typeof entry?.value === "number" ? entry.value : Number(entry?.value ?? 0);
          const currency = typeof entry?.currency === "string" ? entry.currency : "USD";
          const rate = resolveRate(allRatesMap, currency, targetBaseCurrency) ?? 1;
          accountValues[accountId] = value * rate;
        }
      }

      return { date, accountValues };
    });

  const accounts: AccountMeta[] = (
    accountsRaw as { id: string; name: string; category: string }[]
  ).map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
  }));

  return { snapshots, accounts };
}

/**
 * Aggregate CashTransaction (DEPOSIT/WITHDRAWAL) records into per-month net
 * contribution amounts, converted to baseCurrency at current rates (v1 drift).
 *
 * EDIT-type transactions are excluded — they represent balance corrections,
 * not real cash flows.
 */
export async function getMonthlyCashFlow(
  userId: string,
  baseCurrency: string,
): Promise<MonthlyContribution[]> {
  const [transactions, allRatesMap] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: {
        account: { userId },
        type: { in: ["DEPOSIT", "WITHDRAWAL"] },
      },
      include: { account: { select: { currency: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  const byMonth = new Map<string, number>();

  for (const tx of transactions) {
    const monthKey = tx.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    const rate = resolveRate(allRatesMap, tx.account.currency, baseCurrency) ?? 1;
    const amount = Number(tx.amount) * rate;
    const signed = tx.type === "DEPOSIT" ? amount : -amount;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + signed);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, contributions]) => ({ monthKey, contributions }));
}
