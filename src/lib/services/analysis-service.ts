import type {
  NormalizedSnapshot,
  SnapshotBreakdown,
  AccountMeta,
  AccountMonthlyContribution,
} from "./history-service";
import type { NetWorthSummary } from "@/lib/types";

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
    const deltaPct = startNetWorth === 0 ? null : (deltaNetWorth / Math.abs(startNetWorth)) * 100;

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
  // rangeStart/rangeEnd are constructed as UTC-midnight (`new Date(Date.UTC(...))`)
  // by callers, so read them back with UTC getters. Local getters would roll the
  // boundary back a month in any timezone west of UTC (#507), dropping the current
  // month and prepending a phantom empty one.
  const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
  const endKey = `${rangeEnd.getUTCFullYear()}-${String(rangeEnd.getUTCMonth() + 1).padStart(2, "0")}`;
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
  const ytdPct = baseline === 0 ? null : (ytdDelta / Math.abs(baseline)) * 100;

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
    const contrib = b.isEmpty ? 0 : (contribMap.get(b.monthKey) ?? 0);
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

/** One month's cumulative (running-total) decomposition of net-worth growth. */
export interface CumulativeGrowthPoint {
  /** "YYYY-MM" */
  monthKey: string;
  /** Human-readable label (carried from the source CashFlowBucket). */
  label: string;
  /** Running total of net cash deposited/withdrawn since the range start. */
  cumulativeContributions: number;
  /** Running total of market gains/losses since the range start. */
  cumulativeMarket: number;
  /** cumulativeContributions + cumulativeMarket. */
  cumulativeTotal: number;
  isEmpty?: boolean;
}

/**
 * Turn per-month cash-flow buckets into cumulative running totals, so a stacked
 * area can show how much of the range's net-worth growth came from saving vs.
 * the market. Empty (padded) months add zero, leaving the running totals flat.
 *
 * @param buckets  Output of buildCashFlowBuckets() (padded, sorted asc).
 */
export function buildCumulativeGrowth(buckets: CashFlowBucket[]): CumulativeGrowthPoint[] {
  let contrib = 0;
  let market = 0;
  return buckets.map((b) => {
    contrib += b.contributions;
    market += b.marketPerformance;
    return {
      monthKey: b.monthKey,
      label: b.label,
      cumulativeContributions: contrib,
      cumulativeMarket: market,
      cumulativeTotal: contrib + market,
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

/** One point in the drawdown ("underwater") series. */
export interface DrawdownPoint {
  /** Snapshot date, ISO "YYYY-MM-DD". */
  date: string;
  /** Same as date — X-axis / tooltip label. */
  label: string;
  /** Percent below the running all-time peak (<= 0). */
  drawdownPct: number;
}

/**
 * Net-worth drawdown series: how far below the prior all-time peak each snapshot
 * sits, as a non-positive percentage.
 *
 * The running peak accumulates across the FULL input history, then only points on
 * or after `rangeStartIso` are returned — so a drawdown that began before the
 * visible window still renders truthfully (all-time peak, not window-local).
 *
 * @param snapshots  Full history, ascending by date.
 * @param rangeStartIso  Inclusive lower bound ("YYYY-MM-DD") for the returned slice.
 */
export function computeDrawdownSeries(
  snapshots: NormalizedSnapshot[],
  rangeStartIso: string,
): DrawdownPoint[] {
  let peak = 0;
  const out: DrawdownPoint[] = [];
  for (const s of snapshots) {
    if (s.netWorth > peak) peak = s.netWorth;
    if (s.date < rangeStartIso) continue;
    // ponytail: peak <= 0 (all-negative net worth) can't yield a meaningful ratio;
    // emit 0 rather than dividing by zero. Upgrade only if negative-net-worth
    // users ever need a signed drawdown.
    const drawdownPct = peak > 0 ? ((s.netWorth - peak) / peak) * 100 : 0;
    out.push({ date: s.date, label: s.date, drawdownPct });
  }
  return out;
}

// ---------------------------------------------------------------------------
// F11 — Performance attribution
// ---------------------------------------------------------------------------

/** Per-account attribution of net-worth change for a selected period. */
export interface AttributionItem {
  accountId: string;
  accountName: string;
  category: string;
  startValue: number;
  endValue: number;
  /** endValue − startValue */
  totalDelta: number;
  /** Net cash deposited / withdrawn to this account during the period. */
  cashContribution: number;
  /** totalDelta − cashContribution: value created/destroyed by market movement. */
  marketPerformance: number;
}

/**
 * Compute per-account performance attribution for a period.
 *
 * @param snapshots         Breakdown snapshots filtered to the selected range.
 * @param accounts          All user accounts (from getRawHistoryWithBreakdown).
 * @param accountCashFlows  Per-account monthly cash flows (from getAccountMonthlyCashFlow).
 * @param rangeStartMonthKey "YYYY-MM" — cash flows before this month are excluded.
 */
export function computePerformanceAttribution(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  rangeStartMonthKey: string,
): AttributionItem[] {
  if (snapshots.length < 2) return [];

  const startSnap = snapshots[0];
  const endSnap = snapshots[snapshots.length - 1];

  const cashByAccount = new Map<string, number>();
  for (const c of accountCashFlows) {
    if (c.monthKey >= rangeStartMonthKey) {
      cashByAccount.set(c.accountId, (cashByAccount.get(c.accountId) ?? 0) + c.contributions);
    }
  }

  return accounts
    .map((account) => {
      const startValue = startSnap.accountValues[account.id] ?? 0;
      const endValue = endSnap.accountValues[account.id] ?? 0;
      const totalDelta = endValue - startValue;
      const cashContribution = cashByAccount.get(account.id) ?? 0;
      const marketPerformance = totalDelta - cashContribution;
      return {
        accountId: account.id,
        accountName: account.name,
        category: account.category,
        startValue,
        endValue,
        totalDelta,
        cashContribution,
        marketPerformance,
      };
    })
    .filter((a) => a.totalDelta !== 0 || a.cashContribution !== 0)
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta))
    .slice(0, 10);
}

/** Account categories that count as "investments" for the portfolio return KPI. */
const INVESTMENT_CATEGORIES = new Set(["BROKERAGE", "CRYPTO_WALLET"]);

/**
 * Period return of the user's investment accounts (BROKERAGE + CRYPTO_WALLET)
 * over the selected range, as a fraction (0.072 = +7.2%).
 *
 * Simple Modified-Dietz approximation: contributions are assumed to arrive
 * mid-period, so they carry half weight in the denominator.
 * // ponytail: half-weight Dietz, upgrade to dated-flow Dietz/XIRR if it ever feels wrong
 *
 *   gain = Σ (endValue − startValue − cashContribution)
 *   base = Σ startValue + (Σ cashContribution) / 2
 *
 * Returns null when: fewer than 2 snapshots, no investment accounts, or base ≤ 0.
 *
 * @param snapshots          Breakdown snapshots filtered to the selected range.
 * @param accounts           All user accounts (from getRawHistoryWithBreakdown).
 * @param accountCashFlows   Per-account monthly cash flows (from getAccountMonthlyCashFlow).
 * @param rangeStartMonthKey "YYYY-MM" — cash flows before this month are excluded.
 */
export function computeInvestmentReturn(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  rangeStartMonthKey: string,
): number | null {
  if (snapshots.length < 2) return null;

  const investmentIds = new Set(
    accounts.filter((a) => INVESTMENT_CATEGORIES.has(a.category)).map((a) => a.id),
  );
  if (investmentIds.size === 0) return null;

  const startSnap = snapshots[0];
  const endSnap = snapshots[snapshots.length - 1];

  const cashByAccount = new Map<string, number>();
  for (const c of accountCashFlows) {
    if (c.monthKey >= rangeStartMonthKey && investmentIds.has(c.accountId)) {
      cashByAccount.set(c.accountId, (cashByAccount.get(c.accountId) ?? 0) + c.contributions);
    }
  }

  let gain = 0;
  let base = 0;
  for (const id of investmentIds) {
    const startValue = startSnap.accountValues[id] ?? 0;
    const endValue = endSnap.accountValues[id] ?? 0;
    const cash = cashByAccount.get(id) ?? 0;
    gain += endValue - startValue - cash;
    base += startValue + cash / 2;
  }

  return base > 0 ? gain / base : null;
}

/** One month of the investment return trend (bars = monthly, line = chained index). */
export interface ReturnTrendPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** Locale-formatted month label for the X axis. */
  label: string;
  /** Half-weight Dietz return for the month as a fraction; null when the month is empty or its base ≤ 0. */
  monthlyReturn: number | null;
  /** Π(1 + rᵢ) − 1 over non-null months so far; null until the first computable month, carried forward through gaps. */
  cumulativeReturn: number | null;
  /** True when the month has no snapshot data (synthesized to align the X axis). */
  isEmpty?: boolean;
}

/**
 * Monthly investment-return series over the selected range, one point per
 * entry in `monthKeys` (the shared month axis from the range's buckets).
 *
 * Same scope and math as computeInvestmentReturn, applied per month:
 * start = previous month-end investment value (first month: first snapshot
 * within that month), end = this month-end, cash at half weight.
 * // ponytail: chained monthly Dietz ≠ single-period KPI Dietz — expected, not reconciled
 *
 * @param snapshots        Breakdown snapshots filtered to the selected range, sorted ascending.
 * @param accounts         All user accounts (from getRawHistoryWithBreakdown).
 * @param accountCashFlows Per-account monthly cash flows (from getAccountMonthlyCashFlow).
 * @param monthKeys        Ordered "YYYY-MM" keys defining the X axis (from the range's buckets).
 */
export function computeInvestmentReturnSeries(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  monthKeys: string[],
  locale = "en-US",
): ReturnTrendPoint[] {
  if (snapshots.length < 2) return [];

  const investmentIds = new Set(
    accounts.filter((a) => INVESTMENT_CATEGORIES.has(a.category)).map((a) => a.id),
  );
  if (investmentIds.size === 0) return [];

  const investmentValue = (s: SnapshotBreakdown) => {
    let total = 0;
    for (const id of investmentIds) total += s.accountValues[id] ?? 0;
    return total;
  };

  const cashByMonth = new Map<string, number>();
  for (const c of accountCashFlows) {
    if (investmentIds.has(c.accountId)) {
      cashByMonth.set(c.monthKey, (cashByMonth.get(c.monthKey) ?? 0) + c.contributions);
    }
  }

  // Input is sorted ascending by date, so `last` set wins per month.
  const monthFirst = new Map<string, SnapshotBreakdown>();
  const monthLast = new Map<string, SnapshotBreakdown>();
  for (const s of snapshots) {
    const key = s.date.slice(0, 7);
    if (!monthFirst.has(key)) monthFirst.set(key, s);
    monthLast.set(key, s);
  }

  let prevEnd: number | null = null;
  let index: number | null = null;
  let pendingCash = 0;
  return monthKeys.map((monthKey) => {
    const label = formatMonthLabel(monthKey, locale);
    const endSnap = monthLast.get(monthKey);
    if (!endSnap) {
      if (prevEnd !== null) pendingCash += cashByMonth.get(monthKey) ?? 0;
      return { monthKey, label, monthlyReturn: null, cumulativeReturn: index, isEmpty: true };
    }
    const start = prevEnd ?? investmentValue(monthFirst.get(monthKey)!);
    const end = investmentValue(endSnap);
    const cash = (cashByMonth.get(monthKey) ?? 0) + pendingCash;
    pendingCash = 0;
    prevEnd = end;
    const base = start + cash / 2;
    if (base <= 0) {
      return { monthKey, label, monthlyReturn: null, cumulativeReturn: index };
    }
    const r = (end - start - cash) / base;
    index = index === null ? r : (1 + index) * (1 + r) - 1;
    return { monthKey, label, monthlyReturn: r, cumulativeReturn: index };
  });
}

// ---------------------------------------------------------------------------
// Portfolio concentration
// ---------------------------------------------------------------------------

/** One position in the concentration breakdown (share of total assets). */
export interface ConcentrationPosition {
  label: string;
  /** 0..100 — this holding's percent of total assets. */
  pct: number;
}

/** Point-in-time portfolio concentration. */
export interface ConcentrationResult {
  /** Up to 5 largest positions, descending by pct. */
  top: ConcentrationPosition[];
  /** Largest single position as a percent of total assets (0 when empty). */
  topHoldingPct: number;
  /** Herfindahl index — sum of squared holding weights (0..1). */
  hhi: number;
}

/**
 * Portfolio concentration from the current net-worth summary: each priced holding
 * across ASSET accounts as a share of total assets. Cash and liabilities are not
 * positions, so they never appear (but total assets remains the denominator).
 * Pure — no DB access.
 */
export function computeConcentration(summary: NetWorthSummary): ConcentrationResult {
  const totalAssets = summary.totalAssets;
  const valueByLabel = new Map<string, number>();

  if (totalAssets > 0) {
    for (const account of summary.accounts) {
      if (account.type !== "ASSET") continue;
      for (const h of account.holdings) {
        const value = h.marketValueInBaseCurrency ?? 0;
        if (value <= 0) continue;
        const label = h.name || h.symbol;
        valueByLabel.set(label, (valueByLabel.get(label) ?? 0) + value);
      }
    }
  }

  let hhi = 0;
  const positions: ConcentrationPosition[] = [];
  for (const [label, value] of valueByLabel) {
    const weight = value / totalAssets;
    hhi += weight * weight;
    positions.push({ label, pct: weight * 100 });
  }

  positions.sort((a, b) => b.pct - a.pct);
  return {
    top: positions.slice(0, 5),
    topHoldingPct: positions[0]?.pct ?? 0,
    hhi,
  };
}
