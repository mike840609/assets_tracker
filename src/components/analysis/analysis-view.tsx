"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useDensity } from "@/components/layout/density-context";
import { cn } from "@/lib/utils";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { HistoryTable } from "@/components/history/history-table";
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
import { MonthlyChangeChart } from "./monthly-change-chart";
import { AssetsLiabilitiesChart } from "./assets-liabilities-chart";
import { KpiTiles } from "./kpi-tiles";
import { CashFlowChart } from "./cashflow-chart";
import { CategoryTrendChart } from "./category-trend-chart";
import { TopMoversList } from "./top-movers-list";
import { AttributionChart } from "./attribution-chart";

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
        {/* Range selector + subtitle row — floats while scrolling */}
        <div
          className={`sticky top-0 z-40 -mx-4 md:-mx-6 px-4 md:px-6 py-2 backdrop-blur-md bg-background/80 dark:bg-card/80 flex items-center justify-between transition-[border-color,box-shadow] border-b ${isStuck ? "border-border/50 shadow-sm" : "border-transparent"}`}
        >
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRange(r.label)}
                aria-pressed={range === r.label}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r.label
                    ? "bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    : "text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                }`}
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
          <div className={isCompact ? "space-y-3" : "space-y-6"}>
            <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
            <div className="premium-card">
              <MonthlyChangeChart buckets={buckets} baseCurrency={baseCurrency} locale={locale} />
            </div>
            <div className="premium-card">
              <AssetsLiabilitiesChart
                buckets={buckets}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </div>
            <div className="premium-card">
              <CashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
            </div>
            <div className="premium-card">
              <AttributionChart items={attributionItems} baseCurrency={baseCurrency} />
            </div>
            <div className="premium-card">
              <CategoryTrendChart
                data={categoryHistory}
                baseCurrency={baseCurrency}
                locale={locale}
              />
            </div>
            <TopMoversList movers={topMovers} baseCurrency={baseCurrency} />
          </div>
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
