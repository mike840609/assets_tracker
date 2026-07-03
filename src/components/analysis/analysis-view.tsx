"use client";

import { useMemo, useRef, useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDensity } from "@/components/layout/density-context";
import { cn } from "@/lib/utils";
import { HistoryView } from "@/components/history/history-view";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Card } from "@/components/ui/card";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import type {
  RawHistoryData,
  SnapshotBreakdown,
  AccountMonthlyContribution,
} from "@/lib/services/history-service";
import {
  aggregateMonthlyChange,
  computeKpis,
  fillMonthRange,
  buildCashFlowBuckets,
  aggregateCategoryHistory,
  computeTopMovers,
  computePerformanceAttribution,
  computeInvestmentReturn,
} from "@/lib/services/analysis-service";
import type { MonthlyContribution, CategoryDataPoint } from "@/lib/services/analysis-service";
import {
  LazyMonthlyChangeChart,
  LazyAssetsLiabilitiesChart,
  LazyCashFlowChart,
  LazyCategoryTrendChart,
  LazyAttributionChart,
} from "./lazy-analysis-charts";
import { KpiTiles } from "./kpi-tiles";
import { TopMoversList } from "./top-movers-list";
import { AnalysisEmptyState } from "./analysis-empty-state";

interface Props {
  snapshots: NormalizedSnapshot[];
  cashFlowData: MonthlyContribution[];
  rawHistory: RawHistoryData;
  accountCashFlow: AccountMonthlyContribution[];
  baseCurrency: string;
  locale: string;
  hasAccounts: boolean;
}

const ranges = [
  { label: "YTD", months: 0 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "All", months: Infinity },
] as const;

type RangeLabel = (typeof ranges)[number]["label"];

function rangeCutoff(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// First-visit default. YTD is the conventional choice, but it reads as a near-empty
// chart when there is little history or the year just started, so widen in those cases.
// A persisted user choice always wins over this (see usePersistedRange).
function pickDefaultRange(snapshots: NormalizedSnapshot[]): RangeLabel {
  if (snapshots.length === 0) return "YTD";
  const first = new Date(snapshots[0].date);
  const now = new Date();
  const historyMonths =
    (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1;
  if (historyMonths <= 6) return "All";
  if (now.getMonth() < 3) return "6M"; // Jan–Mar: YTD would be a thin 1–3 month slice
  return "YTD";
}

function MountedAnalysis({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div>{children}</div> : null;
}

export function AnalysisView({
  snapshots,
  cashFlowData,
  rawHistory,
  accountCashFlow,
  baseCurrency,
  locale,
  hasAccounts,
}: Props) {
  const t = useTranslations("analysis");
  const { density } = useDensity();
  const isMobile = useIsMobile();
  const isCompact = density === "compact";
  // On mobile the two charts in a section stack and read as one group, so the gap
  // between them stays tighter than the gap between sections (set below). Desktop
  // lays them side-by-side, where the wider gap matches the column rhythm.
  const gridGapClass = isCompact ? "gap-3" : "gap-4 xl:gap-6";
  const stackGapClass = isCompact ? "space-y-3" : "space-y-6";
  const [range, setRange] = usePersistedRange<RangeLabel>(
    "analysis-view",
    pickDefaultRange(snapshots),
  );
  const shouldReduceMotion = useReducedMotion();
  const rangeFadeTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  const rangeLabelKey: Record<RangeLabel, string> = {
    YTD: "rangeYTD",
    "6M": "range6M",
    "1Y": "range1Y",
    "2Y": "range2Y",
    All: "rangeAll",
  };

  const rangeOptions: SegmentedOption<RangeLabel>[] = ranges.map((r) => ({
    value: r.label,
    label: t(rangeLabelKey[r.label] as Parameters<typeof t>[0]),
  }));
  const activeRangeLabel = t(rangeLabelKey[range] as Parameters<typeof t>[0]);

  const { filteredSnapshots, rangeStart, rangeEnd, rangeStartIso } = useMemo(() => {
    const selected = ranges.find((r) => r.label === range)!;
    const now = new Date();

    if (selected.months === 0) {
      const year = now.getFullYear();
      const rangeStart = new Date(Date.UTC(year, 0, 1));
      // End at the current month, not December, so the axis doesn't pad half a
      // year of empty future months into the chart.
      const rangeEnd = new Date(Date.UTC(year, now.getMonth(), 1));
      const rangeStartIso = `${year}-01-01`;
      return {
        filteredSnapshots: snapshots.filter((s) => s.date >= rangeStartIso),
        rangeStart,
        rangeEnd,
        rangeStartIso,
      };
    }

    const rangeEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    if (selected.months === Infinity) {
      const firstDate = snapshots.length > 0 ? new Date(snapshots[0].date) : now;
      const rangeStart = new Date(Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), 1));
      return {
        filteredSnapshots: snapshots,
        rangeStart,
        rangeEnd,
        rangeStartIso: snapshots.length > 0 ? snapshots[0].date : "1970-01-01",
      };
    }

    const cutoff = rangeCutoff(selected.months);
    const rangeStartIso = cutoff.toISOString().split("T")[0];
    const rangeStart = new Date(Date.UTC(cutoff.getFullYear(), cutoff.getMonth(), 1));
    return {
      filteredSnapshots: snapshots.filter((s) => s.date >= rangeStartIso),
      rangeStart,
      rangeEnd,
      rangeStartIso,
    };
  }, [snapshots, range]);

  const buckets = useMemo(() => {
    const real = aggregateMonthlyChange(filteredSnapshots);
    return fillMonthRange(real, rangeStart, rangeEnd);
  }, [filteredSnapshots, rangeStart, rangeEnd]);

  const kpis = useMemo(() => computeKpis(buckets, snapshots), [buckets, snapshots]);

  // Cash flow: filter contributions to range, then merge with buckets
  const cashFlowBuckets = useMemo(() => {
    const filtered = cashFlowData.filter((c) => c.monthKey >= rangeStartIso.slice(0, 7));
    return buildCashFlowBuckets(buckets, filtered, locale);
  }, [cashFlowData, buckets, rangeStartIso, locale]);

  // Raw history filtered to range
  const filteredRawSnapshots = useMemo((): SnapshotBreakdown[] => {
    return rawHistory.snapshots.filter((s) => s.date >= rangeStartIso);
  }, [rawHistory.snapshots, rangeStartIso]);

  const categoryHistory = useMemo(() => {
    const real = aggregateCategoryHistory(filteredRawSnapshots, rawHistory.accounts);
    const byKey = new Map(real.map((c) => [c.monthKey, c]));
    return buckets.map((b) => {
      const existing = byKey.get(b.monthKey);
      if (existing) return existing;
      // Pad empty months with 0s for all categories to match the other charts' X-axis length
      const empty: CategoryDataPoint & Record<string, number | string> = { monthKey: b.monthKey };
      for (const acc of rawHistory.accounts) {
        empty[acc.category] = 0;
      }
      return empty as CategoryDataPoint;
    });
  }, [filteredRawSnapshots, rawHistory.accounts, buckets]);

  const topMovers = useMemo(
    () => computeTopMovers(filteredRawSnapshots, rawHistory.accounts),
    [filteredRawSnapshots, rawHistory.accounts],
  );

  const attributionItems = useMemo(
    () =>
      computePerformanceAttribution(
        filteredRawSnapshots,
        rawHistory.accounts,
        accountCashFlow,
        rangeStartIso.slice(0, 7),
      ),
    [filteredRawSnapshots, rawHistory.accounts, accountCashFlow, rangeStartIso],
  );

  const investmentReturnPct = useMemo(
    () =>
      computeInvestmentReturn(
        filteredRawSnapshots,
        rawHistory.accounts,
        accountCashFlow,
        rangeStartIso.slice(0, 7),
      ),
    [filteredRawSnapshots, rawHistory.accounts, accountCashFlow, rangeStartIso],
  );

  const hasData = snapshots.length > 0;
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;

  // Analysis no longer shows History as a peer tab; History has its own route and
  // the dashboard links there directly. The /analysis#history deep link still
  // renders the full history view (valid for shared/bookmarked URLs), and keeping
  // HistoryView imported + rendered here is also load-bearing: dropping it makes
  // Turbopack duplicate recharts across route bundles (~+150KB gzip), so this
  // reference must stay even though nothing in-app links to it.
  const hash = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    },
    () => window.location.hash,
    () => "",
  );
  const activeTab: "analysis" | "history" = hash === "#history" ? "history" : "analysis";
  const showAnalysis = !isMobile || activeTab === "analysis";
  const showHistory = isMobile && activeTab === "history";

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
      threshold: [1],
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      {/* Do not mount charts inside a display:none tab. Recharts measures its
          container on mount, so hidden lazy charts otherwise initialize at 0×0. */}
      <MountedAnalysis show={showAnalysis}>
        {/* Sentinel: when this scrolls off-screen the range bar is stuck */}
        <div ref={sentinelRef} className="h-px -mt-px" aria-hidden />
        {/* Range selector — floats as a compact pill while scrolling */}
        <div
          className={cn(
            "sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2",
            "md:-mx-2 md:px-2 md:transition-[background-color,box-shadow,backdrop-filter]",
            isStuck &&
              "bg-background/80 dark:bg-card/80 backdrop-blur-md shadow-sm ring-1 ring-border/50",
          )}
        >
          <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} mobileShort />
          <SegmentedControl
            variant="pill"
            size="sm"
            options={rangeOptions}
            value={range}
            onValueChange={setRange}
            aria-label={t("title")}
            className="flex-nowrap bg-background/80 dark:bg-card/70 ring-1 ring-border/50 backdrop-blur-md"
            itemClassName="px-2 py-1.5 sm:px-2 sm:py-1"
          />
        </div>

        {!hasData ? (
          <AnalysisEmptyState hasAccounts={hasAccounts} />
        ) : (
          <motion.div
            key={range}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={rangeFadeTransition}
            className={stackGapClass}
          >
            {/* Balance-sheet trend leads the analysis; KPI context stays as the info rail. */}
            <section aria-label={t("assetsVsLiabilities")} className="min-w-0">
              <Card size="sm" className="h-full !py-0">
                <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="min-w-0 py-4 group-data-[size=sm]/card:py-3">
                    <LazyAssetsLiabilitiesChart
                      buckets={buckets}
                      baseCurrency={baseCurrency}
                      locale={locale}
                    />
                  </div>
                  <div className="min-w-0 border-t border-border/60 bg-muted/20 px-4 py-4 xl:border-t-0 xl:border-l xl:bg-muted/25 group-data-[size=sm]/card:px-3 group-data-[size=sm]/card:py-3">
                    <KpiTiles
                      kpis={kpis}
                      baseCurrency={baseCurrency}
                      locale={locale}
                      rangeLabel={activeRangeLabel}
                      investmentReturnPct={investmentReturnPct}
                    />
                  </div>
                </div>
              </Card>
            </section>

            {/* Secondary analysis is grouped by question: movement first, then composition.
                On mobile the sections separate more than the charts within them (gridGapClass),
                so each question reads as its own group; desktop keeps them tighter. */}
            <div className={isCompact ? "space-y-3" : "space-y-6 xl:space-y-4"}>
              <section
                aria-label={`${t("monthlyChange")} / ${t("cashFlow")}`}
                className={isCompact ? "space-y-2" : "space-y-3"}
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {t("movementSectionTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground">{t("movementSectionSubtitle")}</p>
                  </div>
                </div>
                <div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>
                  <Card size="sm" className="h-full">
                    <LazyMonthlyChangeChart
                      buckets={buckets}
                      baseCurrency={baseCurrency}
                      locale={locale}
                    />
                  </Card>
                  <Card size="sm" className="h-full">
                    <LazyCashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
                  </Card>
                </div>
              </section>

              <section
                aria-label={`${t("categoryTrend")} / ${t("attribution")}`}
                className={isCompact ? "space-y-2" : "space-y-3"}
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {t("compositionSectionTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t("compositionSectionSubtitle")}
                    </p>
                  </div>
                </div>
                <div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>
                  <Card size="sm" className="h-full">
                    <LazyCategoryTrendChart
                      data={categoryHistory}
                      baseCurrency={baseCurrency}
                      locale={locale}
                    />
                  </Card>
                  <Card size="sm" className="h-full">
                    <LazyAttributionChart items={attributionItems} baseCurrency={baseCurrency} />
                  </Card>
                </div>
              </section>
            </div>

            {/* Per-account detail — full-width table reads best wide */}
            <TopMoversList movers={topMovers} baseCurrency={baseCurrency} />
          </motion.div>
        )}
      </MountedAnalysis>

      {/* History tab content — mobile only */}
      {showHistory && <HistoryView snapshots={snapshots} baseCurrency={baseCurrency} />}
    </div>
  );
}
