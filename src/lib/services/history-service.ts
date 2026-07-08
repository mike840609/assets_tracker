import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import { getCachedNetWorthSummary } from "./net-worth-service";
import type { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type { MonthlyContribution } from "./analysis-service";

export interface NormalizedSnapshot {
  id: string;
  date: string;
  createdAt: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  label: string | null;
  note: string | null;
}

export interface SnapshotReconciliationWarning {
  difference: number;
  differencePercent: number;
  baseCurrency: string;
}

/** Default history window: last 90 days. Keeps the query fast for the dashboard. */
const DEFAULT_HISTORY_DAYS = 90;

const SNAPSHOT_SELECT = {
  id: true,
  date: true,
  createdAt: true,
  netWorth: true,
  totalAssets: true,
  totalLiabilities: true,
  baseCurrency: true,
  label: true,
  note: true,
} as const;

const RECONCILIATION_DRIFT_THRESHOLD = 0.05;

interface SnapshotRow {
  id: string;
  date: Date;
  createdAt: Date;
  netWorth: Decimal;
  totalAssets: Decimal;
  totalLiabilities: Decimal;
  baseCurrency: string;
  label: string | null;
  note: string | null;
}

/** Tie-break metadata for same-day snapshot dedupes. */
interface DedupeCandidate {
  matchesTarget: boolean;
  createdAt: Date;
}

/**
 * Deterministic same-day tie-break shared by both dedupe sites:
 * prefer a baseCurrency match with the target, then the greatest createdAt
 * (a later candidate wins on equal createdAt, so re-takes replace originals).
 */
function isBetterDuplicate(
  candidate: DedupeCandidate,
  existing: DedupeCandidate | undefined,
): boolean {
  if (!existing) return true;
  if (candidate.matchesTarget !== existing.matchesTarget) return candidate.matchesTarget;
  return candidate.createdAt >= existing.createdAt;
}

/**
 * Pure transformation: convert and dedupe raw snapshots into NormalizedSnapshot[].
 * If multiple snapshots exist for the same date (e.g. manual + cron, or a
 * currency change), prefers the one whose baseCurrency already matches the
 * target; among equal matches, keeps the one with the greatest createdAt.
 */
export function normalizeSnapshots(
  snapshots: SnapshotRow[],
  allRatesMap: Map<string, number>,
  targetBaseCurrency: string,
): NormalizedSnapshot[] {
  const normalizedMap = new Map<string, DedupeCandidate & { normalized: NormalizedSnapshot }>();

  for (const s of snapshots) {
    const dateStr = s.date.toISOString().split("T")[0];
    const rate = resolveRate(allRatesMap, s.baseCurrency, targetBaseCurrency) ?? 1;

    const normalized: NormalizedSnapshot = {
      id: s.id,
      date: dateStr,
      createdAt: s.createdAt.toISOString(),
      netWorth: Number(s.netWorth) * rate,
      totalAssets: Number(s.totalAssets) * rate,
      totalLiabilities: Number(s.totalLiabilities) * rate,
      baseCurrency: targetBaseCurrency,
      label: s.label,
      note: s.note,
    };

    const candidate: DedupeCandidate = {
      matchesTarget: s.baseCurrency === targetBaseCurrency,
      createdAt: s.createdAt,
    };
    if (isBetterDuplicate(candidate, normalizedMap.get(dateStr))) {
      normalizedMap.set(dateStr, { ...candidate, normalized });
    }
  }

  return Array.from(normalizedMap.values())
    .map((entry) => entry.normalized)
    .sort((a, b) => a.date.localeCompare(b.date));
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
  cacheTag("exchange-rates");
  cacheLife("hours");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - DEFAULT_HISTORY_DAYS);

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId, date: { gte: fromDate } },
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}

/**
 * Current-year history for the activity heatmap. Includes the latest snapshot
 * before Jan 1, when present, so the first visible day can compute its delta
 * the same way full-history views do.
 */
export async function getCurrentYearNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
): Promise<NormalizedSnapshot[]> {
  "use cache";
  cacheTag("snapshots");
  cacheTag("net-worth");
  cacheTag(`history:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("hours");

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [currentYearRows, previousDateRow, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId, date: { gte: yearStart } },
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    prisma.netWorthSnapshot.findFirst({
      where: { userId, date: { lt: yearStart } },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
    getAllExchangeRates(),
  ]);

  const previousRows = previousDateRow
    ? await prisma.netWorthSnapshot.findMany({
        where: { userId, date: previousDateRow.date },
        select: SNAPSHOT_SELECT,
        orderBy: { createdAt: "asc" },
      })
    : [];

  return normalizeSnapshots([...previousRows, ...currentYearRows], allRatesMap, targetBaseCurrency);
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
  cacheTag("exchange-rates");
  cacheLife("hours");

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      select: SNAPSHOT_SELECT,
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
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency);
}

export async function getSnapshotReconciliationWarning(
  userId: string,
  targetBaseCurrency: string,
): Promise<SnapshotReconciliationWarning | null> {
  "use cache";
  cacheTag("snapshots");
  cacheTag("net-worth");
  cacheTag(`history:${userId}`);
  cacheTag(`net-worth:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("minutes");

  const [latestSnapshot, currentSummary, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      select: SNAPSHOT_SELECT,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getCachedNetWorthSummary(userId, targetBaseCurrency),
    getAllExchangeRates(),
  ]);

  if (!latestSnapshot) return null;

  const rate =
    resolveRate(allRatesMap, latestSnapshot.baseCurrency, targetBaseCurrency) ??
    (latestSnapshot.baseCurrency === targetBaseCurrency ? 1 : undefined);
  if (rate === undefined) return null;

  const snapshotNetWorth = Number(latestSnapshot.netWorth) * rate;
  const currentNetWorth = currentSummary.netWorth;
  const difference = currentNetWorth - snapshotNetWorth;
  const denominator = Math.max(Math.abs(snapshotNetWorth), 1);
  const differencePercent = Math.abs(difference) / denominator;

  if (differencePercent <= RECONCILIATION_DRIFT_THRESHOLD) return null;

  return {
    difference,
    differencePercent,
    baseCurrency: targetBaseCurrency,
  };
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
      select: { date: true, breakdown: true, baseCurrency: true, createdAt: true },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, category: true },
    }),
    getAllExchangeRates(),
  ]);

  // Dedupe by date (same tie-break as normalizeSnapshots): prefer the snapshot
  // whose baseCurrency matches the target, then the greatest createdAt.
  const dedupedMap = new Map<string, DedupeCandidate & { breakdown: unknown }>();
  for (const s of snapshotsRaw) {
    const dateStr = s.date.toISOString().split("T")[0];
    const candidate: DedupeCandidate = {
      matchesTarget: s.baseCurrency === targetBaseCurrency,
      createdAt: s.createdAt,
    };
    if (isBetterDuplicate(candidate, dedupedMap.get(dateStr))) {
      dedupedMap.set(dateStr, { ...candidate, breakdown: s.breakdown });
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

/** Net cash contribution for a single account in one calendar month. */
export interface AccountMonthlyContribution {
  accountId: string;
  /** "YYYY-MM" */
  monthKey: string;
  /** Net DEPOSIT − WITHDRAWAL in baseCurrency. */
  contributions: number;
}

/**
 * Like getMonthlyCashFlow but scoped per account, enabling F11 attribution math.
 * Returns one entry per (accountId, month) pair that has any cash activity.
 */
export async function getAccountMonthlyCashFlow(
  userId: string,
  baseCurrency: string,
): Promise<AccountMonthlyContribution[]> {
  "use cache";
  cacheTag(`accounts:${userId}`);
  cacheTag(`history:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("hours");

  const [accounts, allRatesMap, firstSnapshot] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, currency: true } }),
    getAllExchangeRates(),
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));

  // #509 — floor the transaction scan to the user's earliest snapshot instant,
  // exclusive. The first analysis bucket uses its own first snapshot as the
  // start baseline (see aggregateMonthlyChange), so any cash already present in
  // that snapshot — e.g. a same-month opening deposit — is baked into the
  // baseline. Counting such a pre-snapshot flow as a contribution double-counts
  // it: the first bucket then reports contributions ≈ the deposit and a phantom
  // marketPerformance ≈ −deposit that buildCumulativeGrowth carries across the
  // whole range. Flooring at the first snapshot's date with a strict `gt`
  // aligns the contribution window with that baseline, so only flows that
  // occurred AFTER the starting snapshot are attributed to the first bucket.
  // (Months before the first snapshot are unreachable by the analysis UI, so
  // this also preserves PE29's scan-narrowing intent.) The floor compares
  // against the effective date (occurrenceDate ?? createdAt) to match the
  // month-key bucketing below.
  const floor = firstSnapshot ? firstSnapshot.date : null;

  const transactions = await prisma.cashTransaction.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
      ...(floor
        ? {
            OR: [
              { occurrenceDate: { gt: floor } },
              { occurrenceDate: null, createdAt: { gt: floor } },
            ],
          }
        : {}),
    },
    select: { amount: true, type: true, createdAt: true, occurrenceDate: true, accountId: true },
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, number>();

  for (const tx of transactions) {
    // Bucket by when the cash flow actually happened (occurrenceDate), falling
    // back to createdAt for legacy rows that never recorded one (#498).
    const monthKey = (tx.occurrenceDate ?? tx.createdAt).toISOString().slice(0, 7);
    const key = `${tx.accountId}::${monthKey}`;
    const currency = accountCurrencyMap.get(tx.accountId) ?? "USD";
    const rate = resolveRate(allRatesMap, currency, baseCurrency) ?? 1;
    const amount = Number(tx.amount) * rate;
    const signed = tx.type === "DEPOSIT" ? amount : -amount;
    byKey.set(key, (byKey.get(key) ?? 0) + signed);
  }

  return Array.from(byKey.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, contributions]) => {
      const sep = key.indexOf("::");
      const accountId = key.slice(0, sep);
      const monthKey = key.slice(sep + 2);
      return { accountId, monthKey, contributions };
    });
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
  // Thin reduction over getAccountMonthlyCashFlow (cached with the same tags),
  // so callers needing both views share a single query fill instead of running
  // the identical accounts + cashTransaction scan twice.
  const perAccount = await getAccountMonthlyCashFlow(userId, baseCurrency);

  const byMonth = new Map<string, number>();
  for (const entry of perAccount) {
    byMonth.set(entry.monthKey, (byMonth.get(entry.monthKey) ?? 0) + entry.contributions);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, contributions]) => ({ monthKey, contributions }));
}
