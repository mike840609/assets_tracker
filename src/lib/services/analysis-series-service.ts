import "server-only";
import {
  ANALYSIS_RANGES,
  getMonthsForRange,
  resolveAnalysisRange,
  type RangeLabel,
} from "@/lib/analysis-range";
import {
  aggregateMonthlyChange,
  fillMonthRange,
  computeKpis,
  buildCashFlowBuckets,
  buildCumulativeGrowth,
  aggregateCategoryHistory,
  computePerformanceAttribution,
  computeInvestmentReturn,
  computeInvestmentReturnSeries,
  addFirstAppearanceContributions,
  type CategoryDataPoint,
} from "@/lib/services/analysis-service";
import type {
  NormalizedSnapshot,
  RawHistoryData,
  AccountMonthlyContribution,
} from "@/lib/services/history-service";
import type { AnalysisRangeSeries } from "@/lib/analysis-contract";

/**
 * Replicates the former client-side AnalysisView useMemo chain exactly, per
 * range, minus the drawdown series — that one is a plain scan over
 * `snapshots`, which the client receives in full anyway, so precomputing it
 * five times would ship the same points over and over.
 *
 * All inputs are the FULL datasets; range filtering happens inside
 * resolveAnalysisRange. `now` freezes at cache-fill time — accepted staleness
 * (same class as the rest of the cached payload). Pass one shared `now` for
 * the whole fill so every range resolves against the same instant.
 */
/** "YYYY-MM" of the month after an ISO date's month. */
function nextMonthKey(isoDate: string): string {
  const d = new Date(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)), 1));
  return d.toISOString().slice(0, 7);
}

export function computeAnalysisRangeSeries(
  snapshots: NormalizedSnapshot[],
  rawHistory: RawHistoryData,
  recordedCashFlow: AccountMonthlyContribution[],
  rangeLabel: RangeLabel,
  now = new Date(),
): AnalysisRangeSeries {
  const { filteredSnapshots, rangeStart, rangeEnd, rangeStartIso } = resolveAnalysisRange(
    snapshots,
    getMonthsForRange(rangeLabel),
    now,
  );
  const rangeStartMonthKey = rangeStartIso.slice(0, 7);

  // The last snapshot before the range is every range-level baseline, so the
  // first month's change runs from the prior month-end, not from mid-month.
  const withBaseline = <T extends { date: string }>(all: T[], inRange: T[]) => {
    const baseline = all.filter((s) => s.date < rangeStartIso).at(-1);
    return baseline ? [baseline, ...inRange] : inRange;
  };

  const buckets = fillMonthRange(
    aggregateMonthlyChange(withBaseline(snapshots, filteredSnapshots)),
    rangeStart,
    rangeEnd,
  );
  const kpis = computeKpis(buckets, snapshots, rangeEnd.toISOString().slice(0, 7));

  // Cash counts from the month after the baseline: with a sparse history the
  // baseline can sit months before the range, and that gap's cash is part of
  // the first range month's change.
  const baselineDate = snapshots.filter((s) => s.date < rangeStartIso).at(-1)?.date;
  const flowStartMonthKey = baselineDate ? nextMonthKey(baselineDate) : rangeStartMonthKey;

  const accountCashFlow = addFirstAppearanceContributions(
    rawHistory.snapshots,
    rawHistory.accounts,
    recordedCashFlow,
  );
  const cashByMonth = new Map<string, number>();
  for (const c of accountCashFlow) {
    if (c.monthKey < flowStartMonthKey) continue;
    const key = c.monthKey < rangeStartMonthKey ? rangeStartMonthKey : c.monthKey;
    cashByMonth.set(key, (cashByMonth.get(key) ?? 0) + c.contributions);
  }
  const cashFlowBuckets = buildCashFlowBuckets(
    buckets,
    Array.from(cashByMonth, ([monthKey, contributions]) => ({ monthKey, contributions })),
  );
  const cumulativeGrowth = buildCumulativeGrowth(cashFlowBuckets);

  const filteredRawSnapshots = rawHistory.snapshots.filter((s) => s.date >= rangeStartIso);
  const rangeRawSnapshots = withBaseline(rawHistory.snapshots, filteredRawSnapshots);
  const hasUnattributedAccounts = rawHistory.unattributedDates.some(
    (date) => date >= rangeStartIso,
  );

  const realCategory = aggregateCategoryHistory(filteredRawSnapshots, rawHistory.accounts);
  const categoryByKey = new Map(realCategory.map((c) => [c.monthKey, c]));
  const categoryHistory = buckets.map((b) => {
    const existing = categoryByKey.get(b.monthKey);
    if (existing) return existing;
    return { monthKey: b.monthKey } as CategoryDataPoint;
  });

  const attributionItems = computePerformanceAttribution(
    rangeRawSnapshots,
    rawHistory.accounts,
    accountCashFlow,
    flowStartMonthKey,
  );
  const investmentReturnPct = computeInvestmentReturn(
    rangeRawSnapshots,
    rawHistory.accounts,
    accountCashFlow,
    flowStartMonthKey,
  );
  const returnTrend = computeInvestmentReturnSeries(
    rangeRawSnapshots,
    rawHistory.accounts,
    accountCashFlow,
    buckets.map((b) => b.monthKey),
  );

  return {
    buckets,
    kpis,
    cashFlowBuckets,
    cumulativeGrowth,
    categoryHistory,
    attributionItems,
    investmentReturnPct,
    returnTrend,
    rangeStartIso,
    hasUnattributedAccounts,
  };
}

export function computeAllRangeSeries(
  snapshots: NormalizedSnapshot[],
  rawHistory: RawHistoryData,
  accountCashFlow: AccountMonthlyContribution[],
  now = new Date(),
): Record<RangeLabel, AnalysisRangeSeries> {
  const result = {} as Record<RangeLabel, AnalysisRangeSeries>;
  for (const { label } of ANALYSIS_RANGES) {
    result[label] = computeAnalysisRangeSeries(snapshots, rawHistory, accountCashFlow, label, now);
  }
  return result;
}
