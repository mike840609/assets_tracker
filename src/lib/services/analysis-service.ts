import type { NormalizedSnapshot } from "./history-service";

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
export function aggregateMonthlyChange(
  snapshots: NormalizedSnapshot[]
): MonthlyBucket[] {
  if (snapshots.length === 0) return [];

  // Group snapshots by YYYY-MM. The input is already sorted ascending by date
  // (see history-service.normalizeSnapshots), so `last` ends up being the
  // actual month-end snapshot and `first` the month-start.
  const groups = new Map<
    string,
    { first: NormalizedSnapshot; last: NormalizedSnapshot }
  >();

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
    const startNetWorth = prevKey
      ? groups.get(prevKey)!.last.netWorth
      : group.first.netWorth;
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
  rangeEnd: Date
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
      }
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
  snapshots: NormalizedSnapshot[]
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
