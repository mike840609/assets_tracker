"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useDensity } from "@/components/layout/density-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import type { RawHistoryData, SnapshotBreakdown } from "@/lib/services/history-service";
import {
  aggregateMonthlyChange,
  computeKpis,
  fillMonthRange,
  buildCashFlowBuckets,
  aggregateCategoryHistory,
  computeTopMovers,
} from "@/lib/services/analysis-service";
import type { MonthlyContribution, CategoryDataPoint } from "@/lib/services/analysis-service";
import { MonthlyChangeChart } from "./monthly-change-chart";
import { AssetsLiabilitiesChart } from "./assets-liabilities-chart";
import { KpiTiles } from "./kpi-tiles";
import { CashFlowChart } from "./cashflow-chart";
import { CategoryTrendChart } from "./category-trend-chart";
import { TopMoversList } from "./top-movers-list";

interface Props {
  snapshots: NormalizedSnapshot[];
  cashFlowData: MonthlyContribution[];
  rawHistory: RawHistoryData;
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

export function AnalysisView({ snapshots, cashFlowData, rawHistory, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
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

  const hasData = snapshots.length > 0;

  const [mobileTab, setMobileTab] = useState<string>("overview");
  useEffect(() => {
    const saved = sessionStorage.getItem("analysis-mobile-tab");
    if (saved) setMobileTab(saved);
  }, []);
  const handleMobileTabChange = (val: string) => {
    if (!val) return;
    setMobileTab(val);
    sessionStorage.setItem("analysis-mobile-tab", val);
  };

  const gap = isCompact ? "space-y-3" : "space-y-6";
  const mt = isCompact ? "mt-3" : "mt-6";

  return (
    <div className="space-y-4">
      {/* Range selector + subtitle row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.label)}
              aria-pressed={range === r.label}
              className={`px-3 py-2 min-h-[44px] sm:px-2 sm:py-1 sm:min-h-0 text-xs rounded-md transition-colors ${
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
        <>
          {/* Mobile: two-tab layout */}
          <div className="md:hidden">
            <Tabs value={mobileTab} onValueChange={handleMobileTabChange}>
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">
                  {t("tabOverview")}
                </TabsTrigger>
                <TabsTrigger value="details" className="flex-1">
                  {t("tabDetails")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {mobileTab === "overview" ? (
              <div className={`${mt} ${gap}`}>
                <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
                <div className="premium-card">
                  <MonthlyChangeChart buckets={buckets} baseCurrency={baseCurrency} locale={locale} />
                </div>
                <div className="premium-card">
                  <AssetsLiabilitiesChart buckets={buckets} baseCurrency={baseCurrency} locale={locale} />
                </div>
              </div>
            ) : (
              <div className={`${mt} ${gap}`}>
                <div className="premium-card">
                  <CashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
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

          {/* Desktop: original stacked layout */}
          <div className={`hidden md:block ${gap}`}>
            <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
            <div className="premium-card">
              <MonthlyChangeChart buckets={buckets} baseCurrency={baseCurrency} locale={locale} />
            </div>
            <div className="premium-card">
              <AssetsLiabilitiesChart buckets={buckets} baseCurrency={baseCurrency} locale={locale} />
            </div>
            <div className="premium-card">
              <CashFlowChart buckets={cashFlowBuckets} baseCurrency={baseCurrency} />
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
        </>
      )}
    </div>
  );
}
