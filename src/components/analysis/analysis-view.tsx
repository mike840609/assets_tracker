"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useDensity } from "@/components/layout/density-context";
import { cn } from "@/lib/utils";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { HistoryTable } from "@/components/history/history-table";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
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
  const latestSnapshotAt = snapshots.length > 0 ? snapshots[snapshots.length - 1]!.date : null;

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
      <div className="md:hidden flex border-b">
        {(["analysis", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              "pb-2 px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tNav(tab)}
          </button>
        ))}
      </div>

      {/* Analysis tab content — always visible on desktop, conditional on mobile */}
      <div className={activeTab === "history" ? "hidden md:block" : "block"}>
        {/* Sentinel: when this scrolls off-screen the range bar is stuck */}
        <div ref={sentinelRef} className="h-px -mt-px" aria-hidden />
        {/* Range selector — floats as a compact pill while scrolling */}
        <div className="sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2">
          <FreshnessBadge kind="snapshot" timestamp={latestSnapshotAt} mobileShort />
          <div
            className={cn(
              "inline-flex gap-1 rounded-full p-1 transition-[background-color,box-shadow,backdrop-filter]",
              isStuck &&
                "bg-background/80 dark:bg-card/80 backdrop-blur-md shadow-sm ring-1 ring-border/50",
            )}
          >
            {ranges.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRange(r.label)}
                aria-pressed={range === r.label}
                className={cn(
                  "px-3 py-2 sm:px-2 sm:py-1 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  range === r.label
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t(rangeLabelKey[r.label] as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
            {t("noData")}
          </div>
        ) : (
          <motion.div
            key={range}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={rangeFadeTransition}
            className={isCompact ? "space-y-3" : "space-y-6"}
          >
            <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
            <div className="premium-card">
              <LazyMonthlyChangeChart
                buckets={buckets}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </div>
            <div className="premium-card">
              <LazyAssetsLiabilitiesChart
                buckets={buckets}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </div>
            <div className="premium-card">
              <LazyCashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
            </div>
            <div className="premium-card">
              <LazyAttributionChart items={attributionItems} baseCurrency={baseCurrency} />
            </div>
            <div className="premium-card">
              <LazyCategoryTrendChart
                data={categoryHistory}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </div>
            <TopMoversList movers={topMovers} baseCurrency={baseCurrency} />
          </motion.div>
        )}
      </div>

      {/* History tab content — mobile only */}
      {activeTab === "history" && (
        <div className="md:hidden space-y-4">
          <TrendChart snapshots={snapshots} baseCurrency={baseCurrency} />
          <HistoryTable snapshots={snapshots} baseCurrency={baseCurrency} />
        </div>
      )}
    </div>
  );
}
