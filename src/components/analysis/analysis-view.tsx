"use client";

import { useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { usePersistedRange } from "@/hooks/use-persisted-range";
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

export function AnalysisView({
  snapshots,
  cashFlowData,
  rawHistory,
  accountCashFlow,
  baseCurrency,
  locale,
}: Props) {
  const t = useTranslations("analysis");
  const tNav = useTranslations("nav");
  const { density } = useDensity();
  const isCompact = density === "compact";
  // Keep side-by-side gaps equal to the vertical rhythm between stacked rows.
  const gridGapClass = isCompact ? "gap-3" : "gap-6";
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

  const tabOptions: SegmentedOption<"analysis" | "history">[] = [
    { value: "analysis", label: tNav("analysis") },
    { value: "history", label: tNav("history") },
  ];

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

  const hasData = snapshots.length > 0;
  const latestSnapshotAt = snapshots.at(-1)?.createdAt ?? null;

  // Deep link: the dashboard's "View full history" link points at /analysis#history
  // so the History sub-view opens directly. useSyncExternalStore reads the hash with
  // a server snapshot of "" so SSR and hydration agree (no mismatch), then the client
  // settles on the real hash. A manual tab switch sets `override`, which wins and
  // rewrites the hash so the URL stays shareable and Back is predictable.
  const hash = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    },
    () => window.location.hash,
    () => "",
  );
  const [override, setOverride] = useState<"analysis" | "history" | null>(null);
  const activeTab: "analysis" | "history" =
    override ?? (hash === "#history" ? "history" : "analysis");

  const handleTabChange = (tab: "analysis" | "history") => {
    setOverride(tab);
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", tab === "history" ? `${base}#history` : base);
  };

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
      {/* Mobile-only tab switcher */}
      <SegmentedControl
        variant="underline"
        options={tabOptions}
        value={activeTab}
        onValueChange={handleTabChange}
        className="md:hidden"
        aria-label={tNav("analysis")}
      />

      {/* Analysis tab content — always visible on desktop, conditional on mobile */}
      <div className={activeTab === "history" ? "hidden md:block" : "block"}>
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
            className="bg-background/80 dark:bg-card/70 ring-1 ring-border/50 backdrop-blur-md"
            itemClassName="px-3 py-2 sm:px-2 sm:py-1"
          />
        </div>

        {!hasData ? (
          <AnalysisEmptyState hasAccounts={rawHistory.accounts.length > 0} />
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
                <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch 2xl:grid-cols-[minmax(0,1fr)_18rem]">
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
                    />
                  </div>
                </div>
              </Card>
            </section>

            {/* Secondary analysis is grouped by question: movement first, then composition. */}
            <div className={isCompact ? "space-y-3" : "space-y-4"}>
              <section
                aria-label={`${t("monthlyChange")} / ${t("cashFlow")}`}
                className={cn("grid", gridGapClass, "xl:grid-cols-2")}
              >
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
              </section>

              <section
                aria-label={`${t("categoryTrend")} / ${t("attribution")}`}
                className={cn("grid", gridGapClass, "xl:grid-cols-2")}
              >
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
              </section>
            </div>

            {/* Per-account detail — full-width table reads best wide */}
            <TopMoversList movers={topMovers} baseCurrency={baseCurrency} />
          </motion.div>
        )}
      </div>

      {/* History tab content — mobile only */}
      {activeTab === "history" && (
        <HistoryView snapshots={snapshots} baseCurrency={baseCurrency} className="md:hidden" />
      )}
    </div>
  );
}
