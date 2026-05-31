"use client";

import { useMemo, useRef, useState, useEffect } from "react";
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
import { PortfolioHeatmap } from "./portfolio-heatmap";
import { TopMoversList } from "./top-movers-list";
import type { NetWorthSummary } from "@/lib/types";

interface Props {
  snapshots: NormalizedSnapshot[];
  cashFlowData: MonthlyContribution[];
  rawHistory: RawHistoryData;
  accountCashFlow: AccountMonthlyContribution[];
  summary: NetWorthSummary;
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

export function AnalysisView({
  snapshots,
  cashFlowData,
  rawHistory,
  accountCashFlow,
  summary,
  baseCurrency,
  locale,
}: Props) {
  const t = useTranslations("analysis");
  const tNav = useTranslations("nav");
  const { density } = useDensity();
  const isCompact = density === "compact";
  const [range, setRange] = usePersistedRange<RangeLabel>("analysis-view", "YTD");
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
      const rangeEnd = new Date(Date.UTC(year, 11, 1));
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

  const [activeTab, setActiveTab] = useState<"analysis" | "history">("analysis");

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
        onValueChange={setActiveTab}
        className="md:hidden"
        aria-label={tNav("analysis")}
      />

      {/* Analysis tab content — always visible on desktop, conditional on mobile */}
      <div className={activeTab === "history" ? "hidden md:block" : "block"}>
        {/* Sentinel: when this scrolls off-screen the range bar is stuck */}
        <div ref={sentinelRef} className="h-px -mt-px" aria-hidden />
        {/* Range selector — floats as a compact pill while scrolling */}
        <div className="sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2">
          <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} mobileShort />
          <SegmentedControl
            variant="pill"
            size="sm"
            options={rangeOptions}
            value={range}
            onValueChange={setRange}
            aria-label={t("title")}
            className={cn(
              "transition-[background-color,box-shadow,backdrop-filter]",
              isStuck &&
                "bg-background/80 dark:bg-card/80 backdrop-blur-md shadow-sm ring-1 ring-border/50",
            )}
            itemClassName="px-3 py-2 sm:px-2 sm:py-1"
          />
        </div>

        {!hasData ? (
          <Card className="border border-dashed border-border/60 bg-card/50 ring-0 p-12 text-center text-sm text-muted-foreground">
            {t("noData")}
          </Card>
        ) : (
          <motion.div
            key={range}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={rangeFadeTransition}
            className={isCompact ? "space-y-3" : "space-y-6"}
          >
            <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
            <PortfolioHeatmap summary={summary} fillHeight />
            <Card size={isCompact ? "sm" : "default"}>
              <LazyMonthlyChangeChart
                buckets={buckets}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </Card>
            <Card size={isCompact ? "sm" : "default"}>
              <LazyAssetsLiabilitiesChart
                buckets={buckets}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </Card>
            <Card size={isCompact ? "sm" : "default"}>
              <LazyCashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
            </Card>
            <Card size={isCompact ? "sm" : "default"}>
              <LazyAttributionChart items={attributionItems} baseCurrency={baseCurrency} />
            </Card>
            <Card size={isCompact ? "sm" : "default"}>
              <LazyCategoryTrendChart
                data={categoryHistory}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </Card>
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
