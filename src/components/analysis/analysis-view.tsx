"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelpIcon } from "lucide-react";
import type { NormalizedSnapshot } from "@/lib/services/history-service";
import type { RawHistoryData, SnapshotBreakdown } from "@/lib/services/history-service";
import {
  aggregateMonthlyChange,
  computeKpis,
  fillMonthRange,
  buildCashFlowBuckets,
  aggregateCategoryHistory,
  computeTopMovers,
  getNormalizedBenchmarkSeries,
} from "@/lib/services/analysis-service";
import type {
  MonthlyContribution,
  CategoryDataPoint,
  BenchmarkSeriesPoint,
} from "@/lib/services/analysis-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  benchmarkEntries: Array<{
    symbol: string;
    labelKey: "benchmarkSP500" | "benchmarkNasdaq100";
    points: BenchmarkSeriesPoint[];
  }>;
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
  baseCurrency,
  locale,
  benchmarkEntries,
}: Props) {
  const t = useTranslations("analysis");
  const [range, setRange] = useState<RangeLabel>("YTD");
  const [selectedBenchmark, setSelectedBenchmark] = useState("^GSPC");

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

  const kpis = useMemo(
    () => computeKpis(buckets, snapshots),
    [buckets, snapshots]
  );

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
      const empty: CategoryDataPoint & Record<string, any> = { monthKey: b.monthKey };
      for (const acc of rawHistory.accounts) {
        empty[acc.category] = 0;
      }
      return empty as CategoryDataPoint;
    });
  }, [filteredRawSnapshots, rawHistory.accounts, buckets]);

  const topMovers = useMemo(
    () => computeTopMovers(filteredRawSnapshots, rawHistory.accounts),
    [filteredRawSnapshots, rawHistory.accounts]
  );

  const benchmarkData = useMemo(() => {
    const selected = benchmarkEntries.find((entry) => entry.symbol === selectedBenchmark);
    if (!selected) return [];
    const rangeEndIso = new Date(
      Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);

    const normalized = getNormalizedBenchmarkSeries(
      selected.points,
      rangeStartIso,
      rangeEndIso,
    );
    const byMonth = new Map<string, number>();
    for (const point of normalized) {
      byMonth.set(point.date.slice(0, 7), point.normalized);
    }

    return buckets.map((bucket) => ({
      monthKey: bucket.monthKey,
      value: byMonth.get(bucket.monthKey) ?? null,
    }));
  }, [benchmarkEntries, selectedBenchmark, rangeStartIso, rangeEnd, buckets]);

  const hasData = snapshots.length > 0;

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
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                range === r.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(rangeLabelKey[r.label] as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("benchmarkSelectorLabel")}</span>
          <Select value={selectedBenchmark} onValueChange={(value) => setSelectedBenchmark(value)}>
            <SelectTrigger className="h-8 min-w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {benchmarkEntries.map((entry) => (
                <SelectItem key={entry.symbol} value={entry.symbol}>
                  {t(entry.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <CircleHelpIcon className="size-3.5" />
            {t("benchmarkDisclaimerLabel")}
          </PopoverTrigger>
          <PopoverContent sideOffset={8} className="w-80 text-xs leading-relaxed text-muted-foreground">
            {t("benchmarkDisclaimerText")}
          </PopoverContent>
        </Popover>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {t("noData")}
        </div>
      ) : (
        <div className="space-y-6">
          <KpiTiles kpis={kpis} baseCurrency={baseCurrency} locale={locale} />
          <div className="premium-card">
            <MonthlyChangeChart
              buckets={buckets}
              baseCurrency={baseCurrency}
              locale={locale}
              benchmarkData={benchmarkData}
              benchmarkLabel={t(benchmarkEntries.find((entry) => entry.symbol === selectedBenchmark)?.labelKey ?? "benchmarkSP500")}
            />
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
      )}
    </div>
  );
}
