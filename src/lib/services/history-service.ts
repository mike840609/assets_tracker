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
  breakdown: true,
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
  breakdown: unknown;
  label: string | null;
  note: string | null;
}

export interface SnapshotAccountMeta {
  id: string;
  type: "ASSET" | "LIABILITY";
}

/** Tie-break metadata for same-day snapshot dedupes. */
export interface DedupeCandidate {
  matchesTarget: boolean;
  createdAt: Date;
}

/**
 * Deterministic same-day tie-break shared by all dedupe sites (normalize,
 * breakdown, and the data-import route): prefer a baseCurrency match with the
 * target, then the greatest createdAt (a later candidate wins on equal
 * createdAt, so re-takes replace originals).
 */
export function isBetterDuplicate(
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
  accounts: SnapshotAccountMeta[],
): NormalizedSnapshot[] {
  const normalizedMap = new Map<string, DedupeCandidate & { normalized: NormalizedSnapshot }>();
  const accountTypeMap = new Map(accounts.map((account) => [account.id, account.type]));

  for (const s of snapshots) {
    const dateStr = s.date.toISOString().split("T")[0];
    const breakdownTotals = normalizeBreakdown(
      s.breakdown,
      accountTypeMap,
      allRatesMap,
      targetBaseCurrency,
    );

    const normalized: NormalizedSnapshot = {
      id: s.id,
      date: dateStr,
      createdAt: s.createdAt.toISOString(),
      ...(breakdownTotals ?? normalizeLegacyAggregates(s, allRatesMap, targetBaseCurrency)),
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
 * Revalue a lossless breakdown only when every entry can be classified.
 *
 * Deleted accounts have no trustworthy sign: guessing ASSET or LIABILITY could
 * silently invert their contribution to net worth. A missing/malformed entry
 * therefore makes the whole breakdown unusable and preserves the snapshot's
 * signed aggregate relationship through the legacy conversion path.
 */
function normalizeBreakdown(
  breakdown: unknown,
  accountTypeMap: Map<string, SnapshotAccountMeta["type"]>,
  allRatesMap: Map<string, number>,
  targetBaseCurrency: string,
): Pick<NormalizedSnapshot, "netWorth" | "totalAssets" | "totalLiabilities"> | null {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return null;

  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const [accountId, rawEntry] of entries) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return null;

    const entry = rawEntry as { value?: unknown; currency?: unknown };
    const hasNumericValue =
      typeof entry.value === "number" ||
      (typeof entry.value === "string" && entry.value.trim().length > 0);
    const value = hasNumericValue ? Number(entry.value) : Number.NaN;
    const currency = typeof entry.currency === "string" ? entry.currency.trim() : "";
    const accountType = accountTypeMap.get(accountId);

    if (!Number.isFinite(value) || !currency || !accountType) return null;

    const rate = resolveRate(allRatesMap, currency, targetBaseCurrency) ?? 1;
    const convertedValue = value * rate;
    if (accountType === "ASSET") totalAssets += convertedValue;
    else totalLiabilities += convertedValue;
  }

  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
  };
}

function normalizeLegacyAggregates(
  snapshot: SnapshotRow,
  allRatesMap: Map<string, number>,
  targetBaseCurrency: string,
): Pick<NormalizedSnapshot, "netWorth" | "totalAssets" | "totalLiabilities"> {
  const rate = resolveRate(allRatesMap, snapshot.baseCurrency, targetBaseCurrency) ?? 1;
  return {
    netWorth: Number(snapshot.netWorth) * rate,
    totalAssets: Number(snapshot.totalAssets) * rate,
    totalLiabilities: Number(snapshot.totalLiabilities) * rate,
  };
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
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("hours");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - DEFAULT_HISTORY_DAYS);

  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId, date: { gte: fromDate } },
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency, accountsRaw);
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
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("hours");

  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency, accountsRaw);
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

  const [snapshotsRaw, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where,
      select: SNAPSHOT_SELECT,
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true },
    }),
    getAllExchangeRates(),
  ]);

  return normalizeSnapshots(snapshotsRaw, allRatesMap, targetBaseCurrency, accountsRaw);
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
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheTag("exchange-rates");
  cacheLife("minutes");

  const [latestSnapshot, currentSummary, accountsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      select: SNAPSHOT_SELECT,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getCachedNetWorthSummary(userId, targetBaseCurrency),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true },
    }),
    getAllExchangeRates(),
  ]);

  if (!latestSnapshot) return null;

  const snapshotNetWorth = normalizeSnapshots(
    [latestSnapshot],
    allRatesMap,
    targetBaseCurrency,
    accountsRaw,
  )[0].netWorth;
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
  type: "ASSET" | "LIABILITY";
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
      select: { id: true, name: true, category: true, type: true },
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

  const accounts: AccountMeta[] = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    type: a.type,
  }));

  return { snapshots, accounts };
}

/** Net cash contribution for a single account in one calendar month. */
export interface AccountMonthlyContribution {
  accountId: string;
  /** "YYYY-MM" */
  monthKey: string;
  /** Net-worth impact in baseCurrency (liability balance changes are inverted). */
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
    prisma.account.findMany({
      where: { userId },
      select: { id: true, currency: true, type: true },
    }),
    getAllExchangeRates(),
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, createdAt: true },
    }),
  ]);

  const accountMetaMap = new Map(
    accounts.map((account) => [account.id, { currency: account.currency, type: account.type }]),
  );

  // #509 — floor the transaction scan to the user's earliest snapshot instant,
  // exclusive. The first analysis bucket uses its own first snapshot as the
  // start baseline (see aggregateMonthlyChange), so any cash already present in
  // that snapshot — e.g. a same-month opening deposit — is baked into the
  // baseline. Counting such a pre-snapshot flow as a contribution double-counts
  // it: the first bucket then reports contributions ≈ the deposit and a phantom
  // marketPerformance ≈ −deposit that buildCumulativeGrowth carries across the
  // whole range. Flooring at the first snapshot's createdAt with a strict `gt`
  // aligns the contribution window with that baseline, so only flows that
  // occurred AFTER the starting snapshot are attributed to the first bucket.
  // (Months before the first snapshot are unreachable by the analysis UI, so
  // this also preserves PE29's scan-narrowing intent.) Manual rows retain the
  // effective-date boundary (occurrenceDate ?? createdAt) from #509/#551.
  // Recurring rows instead use their durable materializedAt posting instant
  // because occurrenceDate is a business-day bucket that can be later than the
  // wall-clock snapshot; bucketing below still uses occurrenceDate.
  const floor = firstSnapshot ? (firstSnapshot.createdAt ?? firstSnapshot.date) : null;

  const transactions = await prisma.cashTransaction.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
      ...(floor
        ? {
            OR: [
              // Exact generated rows can be narrowed in SQL. Durable
              // provenance survives ON DELETE SET NULL.
              {
                materializedAtEstimated: false,
                materializedAt: { gt: floor },
              },
              // Estimated legacy rows need application-level handling because
              // their exact posting instant was never stored.
              {
                materializedAtEstimated: true,
                materializedAt: { not: null },
              },
              // Compatibility for a stale/pre-migration row. A deployed
              // migration backfills all still-linked rows into the branch
              // above; keeping this branch makes partial restores safe.
              { materializedAt: null, recurringId: { not: null } },
              // Manual/backdated flows preserve the #509/#551 effective-date
              // boundary.
              { materializedAt: null, recurringId: null, occurrenceDate: { gt: floor } },
              {
                materializedAt: null,
                recurringId: null,
                occurrenceDate: null,
                createdAt: { gt: floor },
              },
            ],
          }
        : {}),
    },
    select: {
      amount: true,
      type: true,
      createdAt: true,
      occurrenceDate: true,
      recurringId: true,
      materializedAt: true,
      materializedAtEstimated: true,
      accountId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, number>();

  for (const tx of transactions) {
    // materializedAt is both the durable generated-row marker and, for new
    // rows, the exact balance-change instant. It remains populated when rule
    // deletion nulls recurringId.
    //
    // Linked rows predating the migration carry an explicitly estimated
    // timestamp. When the estimate differs from occurrenceDate, it came from
    // the later rule-creation bound and can still prove an immediate backfill
    // happened after the baseline. Otherwise the exact failed-run/catch-up
    // instant is irretrievable, so retain the like-for-like business-day
    // fallback rather than pretending the estimate is exact.
    const isGenerated = tx.materializedAt !== null || tx.recurringId !== null;
    if (floor && firstSnapshot && isGenerated) {
      const hasUsefulPostingBound =
        tx.materializedAt !== null &&
        (!tx.materializedAtEstimated ||
          tx.occurrenceDate === null ||
          tx.materializedAt.getTime() !== tx.occurrenceDate.getTime());
      const isAfterBaseline = hasUsefulPostingBound
        ? tx.materializedAt!.getTime() > floor.getTime()
        : (tx.occurrenceDate ?? tx.createdAt).getTime() > firstSnapshot.date.getTime();
      if (!isAfterBaseline) continue;
    }

    // Bucket by when the cash flow actually happened (occurrenceDate), falling
    // back to createdAt for legacy rows that never recorded one (#498).
    const monthKey = (tx.occurrenceDate ?? tx.createdAt).toISOString().slice(0, 7);
    const key = `${tx.accountId}::${monthKey}`;
    const account = accountMetaMap.get(tx.accountId);
    const currency = account?.currency ?? "USD";
    const rate = resolveRate(allRatesMap, currency, baseCurrency) ?? 1;
    const amount = Number(tx.amount) * rate;
    const balanceDelta = tx.type === "DEPOSIT" ? amount : -amount;
    const signed = account?.type === "LIABILITY" ? -balanceDelta : balanceDelta;
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

/**
 * True when any of the user's snapshots was recorded under a different base
 * currency than the current one — meaning the history view converts those
 * rows at TODAY's rate, not the rate of their day. Drives a disclosure note.
 */
export async function hasForeignCurrencySnapshots(
  userId: string,
  targetBaseCurrency: string,
): Promise<boolean> {
  "use cache";
  cacheTag("snapshots");
  cacheTag(`history:${userId}`);
  cacheLife("minutes");

  // `baseCurrency != ?` is not seekable: a btree on (userId, baseCurrency) can
  // only seek the userId prefix, so Postgres would walk every snapshot the user
  // owns to prove the common negative. Since entries are sorted by baseCurrency
  // within a userId, the same answer falls out of two O(1) index seeks — if the
  // smallest and the largest baseCurrency both equal the target, everything
  // between them does too. Keep this shape; the obvious `not:` filter is slower.
  const [lowest, highest] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      select: { baseCurrency: true },
      orderBy: { baseCurrency: "asc" },
    }),
    prisma.netWorthSnapshot.findFirst({
      where: { userId },
      select: { baseCurrency: true },
      orderBy: { baseCurrency: "desc" },
    }),
  ]);

  if (!lowest || !highest) return false;
  return lowest.baseCurrency !== targetBaseCurrency || highest.baseCurrency !== targetBaseCurrency;
}
