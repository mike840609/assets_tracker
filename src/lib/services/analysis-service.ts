import type { NormalizedSnapshot, SnapshotBreakdown, AccountMeta } from "./history-service";
import type { IndexHistory } from "./benchmark-service";

/**
 * One month's worth of net-worth aggregation.
 * `endNetWorth` is the last snapshot within the month; `startNetWorth` is the
 * last snapshot of the previous month (or the first snapshot of this month if
 * no prior data exists). Deltas are end - start.
 */
export interface MonthlyBucket {
  /** YYYY-MM — stable sort/grouping key. */
  monthKey: string;
  /** ISO date of the end snapshot for this month (YYYY-MM-DD). */
  endDate: string;
  /** Net worth at the start of the month (last snapshot of prior month, or the first snapshot of this month if no prior data). */
  startNetWorth: number;
  /** Net worth at the last snapshot of the month. */
  endNetWorth: number;
  /** Total assets at the end of the month. */
  totalAssets: number;
  /** Total liabilities at the end of the month. */
  totalLiabilities: number;
  /** endNetWorth - startNetWorth (same currency as the normalized snapshots). */
  deltaNetWorth: number;
  /** Percent change vs. startNetWorth; null when startNetWorth is 0. */
  deltaPct: number | null;
  /** True when this month has no snapshot data and was synthesized to fill the range. */
  isEmpty?: boolean;
}

export interface AnalysisKpis {
  /** Month with the largest positive deltaNetWorth, or null when no buckets have deltas. */
  best: MonthlyBucket | null;
  /** Month with the largest negative deltaNetWorth, or null when no buckets have deltas. */
  worst: MonthlyBucket | null;
  /** Mean of deltaNetWorth across all buckets; 0 when no buckets. */
  avgMonthlyDelta: number;
  /** YTD growth = latest bucket endNetWorth - (last snapshot of prior year, or first snapshot of current year). */
  ytdDelta: number;
  /** Percent YTD growth, null when the YTD baseline is 0. */
  ytdPct: number | null;
}

/**
 * Aggregate a chronologically sorted snapshot series into one bucket per
 * calendar month. Months with no snapshots are omitted. The earliest bucket
 * has no prior-month baseline, so its delta is computed against its own first
 * snapshot (usually zero) — callers that want to hide "incomplete" first
 * buckets can filter them out.
 */
export function aggregateMonthlyChange(snapshots: NormalizedSnapshot[]): MonthlyBucket[] {
  if (snapshots.length === 0) return [];

  // Group snapshots by YYYY-MM. The input is already sorted ascending by date
  // (see history-service.normalizeSnapshots), so `last` ends up being the
  // actual month-end snapshot and `first` the month-start.
  const groups = new Map<string, { first: NormalizedSnapshot; last: NormalizedSnapshot }>();

  for (const s of snapshots) {
    const monthKey = s.date.slice(0, 7); // "YYYY-MM"
    const existing = groups.get(monthKey);
    if (!existing) {
      groups.set(monthKey, { first: s, last: s });
    } else {
      existing.last = s;
    }
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  const buckets: MonthlyBucket[] = [];

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const group = groups.get(key)!;
    const prevKey = sortedKeys[i - 1];
    const startNetWorth = prevKey ? groups.get(prevKey)!.last.netWorth : group.first.netWorth;
    const endNetWorth = group.last.netWorth;
    const deltaNetWorth = endNetWorth - startNetWorth;
    const deltaPct = startNetWorth === 0 ? null : (deltaNetWorth / startNetWorth) * 100;

    buckets.push({
      monthKey: key,
      endDate: group.last.date,
      startNetWorth,
      endNetWorth,
      totalAssets: group.last.totalAssets,
      totalLiabilities: group.last.totalLiabilities,
      deltaNetWorth,
      deltaPct,
      isEmpty: false,
    });
  }

  return buckets;
}

/**
 * Pad a MonthlyBucket array so that every calendar month from rangeStart to
 * rangeEnd appears. Months with no data are represented with isEmpty:true and
 * all numeric fields set to 0.
 *
 * @param buckets   Output of aggregateMonthlyChange(), already sorted asc.
 * @param rangeStart  First month to show (day/time ignored).
 * @param rangeEnd    Last month to show (day/time ignored).
 */
export function fillMonthRange(
  buckets: MonthlyBucket[],
  rangeStart: Date,
  rangeEnd: Date,
): MonthlyBucket[] {
  const byKey = new Map(buckets.map((b) => [b.monthKey, b]));
  const result: MonthlyBucket[] = [];
  const cursor = new Date(Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), 1));
  const endKey = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}`;
  while (true) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    result.push(
      byKey.get(monthKey) ?? {
        monthKey,
        endDate: monthKey,
        startNetWorth: 0,
        endNetWorth: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        deltaNetWorth: 0,
        deltaPct: null,
        isEmpty: true,
      },
    );
    if (monthKey === endKey) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

/**
 * Compute KPI summary statistics from the full snapshot series.
 *
 * We pass both the buckets and the raw snapshots because YTD requires the
 * last snapshot of the prior year (which isn't necessarily inside the selected
 * bucket range).
 */
export function computeKpis(
  buckets: MonthlyBucket[],
  snapshots: NormalizedSnapshot[],
): AnalysisKpis {
  const realBuckets = buckets.filter((b) => !b.isEmpty);
  if (realBuckets.length === 0) {
    return {
      best: null,
      worst: null,
      avgMonthlyDelta: 0,
      ytdDelta: 0,
      ytdPct: null,
    };
  }

  let best: MonthlyBucket | null = null;
  let worst: MonthlyBucket | null = null;
  let sum = 0;
  for (const b of realBuckets) {
    sum += b.deltaNetWorth;
    if (!best || b.deltaNetWorth > best.deltaNetWorth) best = b;
    if (!worst || b.deltaNetWorth < worst.deltaNetWorth) worst = b;
  }
  const avgMonthlyDelta = sum / realBuckets.length;

  // YTD: prefer the last snapshot from the prior year as the baseline;
  // otherwise fall back to the first snapshot of the current year.
  const latest = snapshots[snapshots.length - 1];
  const currentYear = latest.date.slice(0, 4);
  const priorYearSnapshots = snapshots.filter((s) => s.date.slice(0, 4) < currentYear);
  const currentYearSnapshots = snapshots.filter((s) => s.date.slice(0, 4) === currentYear);

  const baseline =
    priorYearSnapshots[priorYearSnapshots.length - 1]?.netWorth ??
    currentYearSnapshots[0]?.netWorth ??
    0;
  const ytdDelta = latest.netWorth - baseline;
  const ytdPct = baseline === 0 ? null : (ytdDelta / baseline) * 100;

  return { best, worst, avgMonthlyDelta, ytdDelta, ytdPct };
}

/**
 * Format a "YYYY-MM" key into a short localized month label (e.g. "Apr 2026").
 * Falls back to the raw key if the locale/formatter is unavailable.
 */
export function formatMonthLabel(monthKey: string, locale = "en-US"): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return monthKey;
  try {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(d);
  } catch {
    return monthKey;
  }
}

// ---------------------------------------------------------------------------
// Phase 2 types
// ---------------------------------------------------------------------------

/** Net cash contribution (DEPOSIT − WITHDRAWAL) for one calendar month. */
export interface MonthlyContribution {
  /** "YYYY-MM" */
  monthKey: string;
  /** Net deposits in baseCurrency (positive = net deposit, negative = net withdrawal). */
  contributions: number;
}

/**
 * One month's worth of cash-flow decomposition.
 * Combines contribution data with the matching MonthlyBucket delta.
 */
export interface CashFlowBucket {
  /** "YYYY-MM" */
  monthKey: string;
  /** Human-readable label (set by the caller via formatMonthLabel). */
  label: string;
  /** Net cash deposits/withdrawals in baseCurrency. */
  contributions: number;
  /** deltaNetWorth − contributions: value created/destroyed by market movement. */
  marketPerformance: number;
  /** Raw net-worth change for the month (from MonthlyBucket). */
  deltaNetWorth: number;
  /** True when no snapshot data exists for this month. */
  isEmpty?: boolean;
}

/**
 * One data point in the category trend series.
 * Keys beyond "monthKey" are AccountCategory enum values → total value in baseCurrency.
 */
export interface CategoryDataPoint {
  /** "YYYY-MM" */
  monthKey: string;
  [category: string]: number | string;
}

/**
 * One data point in the benchmark comparison series.
 * `netWorth` and each index symbol hold a % return value (e.g. 12.5 = +12.5 %)
 * relative to the first data point in the selected range. null means no data
 * for that month (Recharts renders a gap in the line).
 */
export interface BenchmarkPoint {
  /** "YYYY-MM" */
  monthKey: string;
  /** Formatted label, e.g. "Apr 2026". */
  label: string;
  /** % return of net worth from range start, or null if no snapshot. */
  netWorth: number | null;
  /** % return of ^GSPC from range start, or null if no data. */
  "^GSPC": number | null;
  /** % return of ^IXIC from range start, or null if no data. */
  "^IXIC": number | null;
  /** % return of ^RUT from range start, or null if no data. */
  "^RUT": number | null;
}

/** One account's value change over the selected period. */
export interface TopMover {
  accountId: string;
  accountName: string;
  category: string;
  startValue: number;
  endValue: number;
  absoluteChange: number;
  percentChange: number | null;
}

// ---------------------------------------------------------------------------
// Phase 2 pure functions (no DB access)
// ---------------------------------------------------------------------------

/**
 * Merge MonthlyBucket deltas with per-month cash contributions to produce
 * CashFlowBucket array suitable for the stacked cash-flow chart.
 *
 * @param buckets  Output of fillMonthRange() (padded, sorted asc).
 * @param contributions  Output of getMonthlyCashFlow() from history-service.ts.
 * @param locale   For formatMonthLabel.
 */
export function buildCashFlowBuckets(
  buckets: MonthlyBucket[],
  contributions: MonthlyContribution[],
  locale: string,
): CashFlowBucket[] {
  const contribMap = new Map(contributions.map((c) => [c.monthKey, c.contributions]));

  return buckets.map((b) => {
    const contrib = contribMap.get(b.monthKey) ?? 0;
    return {
      monthKey: b.monthKey,
      label: formatMonthLabel(b.monthKey, locale),
      contributions: contrib,
      marketPerformance: b.deltaNetWorth - contrib,
      deltaNetWorth: b.deltaNetWorth,
      isEmpty: b.isEmpty,
    };
  });
}

/**
 * Aggregate snapshot breakdown data into one CategoryDataPoint per calendar
 * month. Uses the last snapshot of each month (same convention as
 * aggregateMonthlyChange). Missing categories default to 0.
 *
 * @param snapshots  From getRawHistoryWithBreakdown().snapshots, filtered to range.
 * @param accounts   From getRawHistoryWithBreakdown().accounts.
 */
export function aggregateCategoryHistory(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
): CategoryDataPoint[] {
  if (snapshots.length === 0) return [];

  // Keep last snapshot per month (input sorted asc → last write wins).
  const byMonth = new Map<string, SnapshotBreakdown>();
  for (const s of snapshots) {
    byMonth.set(s.date.slice(0, 7), s);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, snap]) => {
      const point: CategoryDataPoint = { monthKey };
      for (const account of accounts) {
        const val = snap.accountValues[account.id] ?? 0;
        point[account.category] = Number(point[account.category] ?? 0) + val;
      }
      return point;
    });
}

/**
 * Return the top 10 accounts ranked by absolute value change between the
 * first and last snapshot in the (already-filtered) snapshots array.
 *
 * @param snapshots  From getRawHistoryWithBreakdown().snapshots, filtered to range.
 * @param accounts   From getRawHistoryWithBreakdown().accounts.
 */
export function computeTopMovers(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
): TopMover[] {
  if (snapshots.length < 2) return [];

  const startSnap = snapshots[0];
  const endSnap = snapshots[snapshots.length - 1];

  return accounts
    .map((a) => {
      const startValue = startSnap.accountValues[a.id] ?? 0;
      const endValue = endSnap.accountValues[a.id] ?? 0;
      const absoluteChange = endValue - startValue;
      const percentChange = startValue === 0 ? null : (absoluteChange / startValue) * 100;
      return {
        accountId: a.id,
        accountName: a.name,
        category: a.category,
        startValue,
        endValue,
        absoluteChange,
        percentChange,
      };
    })
    .filter((m) => m.startValue !== 0 || m.endValue !== 0)
    .sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange))
    .slice(0, 10);
}

/**
 * Build a normalized % return series for net worth and each index, aligned by
 * calendar month. Every series is independently rebased to 0 % at its first
 * data point on or after `rangeStartIso`.
 *
 * The output covers exactly the months spanned by `buckets` (already padded by
 * fillMonthRange), so the X-axis stays consistent with the other charts.
 *
 * @param buckets        Output of fillMonthRange() for the selected range.
 * @param snapshots      Filtered NormalizedSnapshot[] for the selected range.
 * @param indexHistory   Output of getIndexHistory().
 * @param rangeStartIso  First date of the selected range ("YYYY-MM-DD").
 * @param locale         For formatMonthLabel.
 */
export function buildBenchmarkSeries(
  buckets: MonthlyBucket[],
  snapshots: NormalizedSnapshot[],
  indexHistory: IndexHistory[],
  rangeStartIso: string,
  locale: string,
): BenchmarkPoint[] {
  if (buckets.length === 0) return [];

  // Build a map of monthKey → last net worth value in that month
  const nwByMonth = new Map<string, number>();
  for (const s of snapshots) {
    nwByMonth.set(s.date.slice(0, 7), s.netWorth);
  }

  // For each index, build a monthKey → close price map
  const indexByMonth = new Map<string, Map<string, number>>();
  for (const idx of indexHistory) {
    const m = new Map<string, number>();
    for (const pt of idx.data) {
      m.set(pt.date.slice(0, 7), pt.close);
    }
    indexByMonth.set(idx.symbol, m);
  }

  // Find base values (first available on or after rangeStartIso) for each series
  const rangeStartMonth = rangeStartIso.slice(0, 7);
  const monthKeys = buckets.map((b) => b.monthKey).sort();

  const findBase = (valueMap: Map<string, number>): number | null => {
    for (const mk of monthKeys) {
      if (mk >= rangeStartMonth) {
        const v = valueMap.get(mk);
        if (v != null && v !== 0) return v;
      }
    }
    return null;
  };

  const nwBase = findBase(nwByMonth);
  const indexBases = new Map<string, number | null>();
  for (const idx of indexHistory) {
    indexBases.set(idx.symbol, findBase(indexByMonth.get(idx.symbol) ?? new Map()));
  }

  const pct = (value: number | undefined | null, base: number | null): number | null => {
    if (value == null || base == null || base === 0) return null;
    return ((value - base) / base) * 100;
  };

  const symbols = ["^GSPC", "^IXIC", "^RUT"] as const;

  return buckets.map((b) => ({
    monthKey: b.monthKey,
    label: formatMonthLabel(b.monthKey, locale),
    netWorth: pct(nwByMonth.get(b.monthKey), nwBase),
    "^GSPC": pct(indexByMonth.get("^GSPC")?.get(b.monthKey), indexBases.get("^GSPC") ?? null),
    "^IXIC": pct(indexByMonth.get("^IXIC")?.get(b.monthKey), indexBases.get("^IXIC") ?? null),
    "^RUT": pct(indexByMonth.get("^RUT")?.get(b.monthKey), indexBases.get("^RUT") ?? null),
    // Satisfy the index-signature constraint; the four named keys above cover all symbols
    ...Object.fromEntries(
      symbols.filter((s) => !["^GSPC", "^IXIC", "^RUT"].includes(s)).map((s) => [s, null]),
    ),
  }));
}
