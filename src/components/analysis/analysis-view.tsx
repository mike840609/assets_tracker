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
import { computeDrawdownSeries } from "@/lib/services/analysis-service";
import type { InvestmentCostBasisSummary } from "@/lib/services/analysis-service";
import type { AnalysisPayloadMeta, AnalysisRangeSeries } from "@/lib/analysis-contract";
import {
  ANALYSIS_RANGES,
  ANALYSIS_RANGE_LABELS,
  getMessageKeyForRange,
  type RangeLabel,
} from "@/lib/analysis-range";
import {
  LazyAssetsLiabilitiesChart,
  LazyCashFlowChart,
  LazyCumulativeGrowthChart,
  LazyInvestmentCostBasisChart,
  LazyCategoryTrendChart,
  LazyAttributionChart,
  LazyReturnTrendChart,
  LazyDrawdownChart,
  ChartSkeleton,
} from "./lazy-analysis-charts";
import { KpiTiles } from "./kpi-tiles";
import { AnalysisEmptyState } from "./analysis-empty-state";

interface Props {
  /** Full normalized history — used by the mobile #history tab (HistoryView). */
  snapshots: NormalizedSnapshot[];
  /** The server sends the default range; other ranges load on demand. */
  seriesByRange: Partial<Record<RangeLabel, AnalysisRangeSeries>>;
  investmentCostBasis: InvestmentCostBasisSummary;
  meta: AnalysisPayloadMeta;
  baseCurrency: string;
  hasAccounts: boolean;
}

function MountedAnalysis({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div>{children}</div> : null;
}

function ChartSkeletonCard({ className, height }: { className?: string; height?: number }) {
  return (
    <Card size="sm" className={cn("h-full", className)}>
      <ChartSkeleton height={height} />
    </Card>
  );
}

type AnalysisSeriesResponse = { data?: AnalysisRangeSeries };

export function AnalysisView({
  snapshots,
  seriesByRange,
  investmentCostBasis,
  meta,
  baseCurrency,
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
    meta.defaultRange,
    ANALYSIS_RANGE_LABELS,
  );
  const [seriesCache, setSeriesCache] = useState(seriesByRange);
  const [failedRange, setFailedRange] = useState<RangeLabel | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [deferredSentinelNode, setDeferredSentinelNode] = useState<HTMLDivElement | null>(null);
  const [showDeferredCharts, setShowDeferredCharts] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const rangeFadeTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  const rangeOptions: SegmentedOption<RangeLabel>[] = ANALYSIS_RANGES.map((r) => ({
    value: r.label,
    label: t(r.messageKey),
  }));
  const activeRangeLabel = t(getMessageKeyForRange(range));

  // A stale sessionStorage label can never land here — usePersistedRange rejects
  // anything outside ANALYSIS_RANGE_LABELS. Missing non-default ranges are read
  // through the authenticated range endpoint below.
  const series = seriesCache[range];

  // Not precomputed per range: this is one scan over `snapshots`, which is
  // shipped in full for HistoryView anyway. Five server-side copies would cost
  // more payload than the scan costs here.
  const drawdownSeries = useMemo(
    () => (series ? computeDrawdownSeries(snapshots, series.rangeStartIso) : []),
    [snapshots, series],
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

  useEffect(() => {
    if (!hasData || series || range === meta.defaultRange) return;

    const controller = new AbortController();

    fetch(`/api/analysis/series?range=${encodeURIComponent(range)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as AnalysisSeriesResponse;
        if (!response.ok || !body?.data) throw new Error("analysis range request failed");
        setFailedRange(null);
        setSeriesCache((current) => ({ ...current, [range]: body.data }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailedRange(range);
      });

    return () => controller.abort();
  }, [hasData, meta.defaultRange, range, retryToken, series]);

  useEffect(() => {
    if (showDeferredCharts || !hasData || !series) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShowDeferredCharts(true));
      return () => cancelAnimationFrame(frame);
    }

    const sentinel = deferredSentinelNode;
    if (!sentinel) return;
    if (sentinel.getBoundingClientRect().top <= window.innerHeight + 800) {
      const frame = requestAnimationFrame(() => setShowDeferredCharts(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowDeferredCharts(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [deferredSentinelNode, hasData, series, showDeferredCharts]);

  const rangeLoadFailed = failedRange === range && !series;
  const rangeIsLoading = !series && !rangeLoadFailed && range !== meta.defaultRange;

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
            {!series ? (
              <div className={stackGapClass} aria-busy={rangeIsLoading}>
                <ChartSkeletonCard height={180} />
                {rangeLoadFailed && (
                  <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
                    <p className="text-destructive">{t("rangeLoadFailed")}</p>
                    <button
                      type="button"
                      className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        setFailedRange(null);
                        setRetryToken((value) => value + 1);
                      }}
                    >
                      {t("retry")}
                    </button>
                  </div>
                )}
                <div ref={setDeferredSentinelNode} className="h-px" aria-hidden />
                <div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>
                  <ChartSkeletonCard />
                  <ChartSkeletonCard />
                  <ChartSkeletonCard />
                  <ChartSkeletonCard />
                  <ChartSkeletonCard className="xl:col-span-2" />
                </div>
              </div>
            ) : (
              <>
                {/* Balance-sheet trend leads the analysis; KPI context stays as the info rail. */}
                <section aria-label={t("assetsVsLiabilities")} className="min-w-0">
                  <Card size="sm" className="h-full !py-0">
                    <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                      <div className="min-w-0 py-4 group-data-[size=sm]/card:py-3">
                        <LazyAssetsLiabilitiesChart
                          buckets={series.buckets}
                          baseCurrency={baseCurrency}
                        />
                      </div>
                      <div className="min-w-0 border-t border-border/60 bg-muted/20 px-4 py-4 xl:border-t-0 xl:border-l xl:bg-muted/25 group-data-[size=sm]/card:px-3 group-data-[size=sm]/card:py-3">
                        <KpiTiles
                          kpis={series.kpis}
                          baseCurrency={baseCurrency}
                          rangeLabel={activeRangeLabel}
                          investmentReturnPct={series.investmentReturnPct}
                        />
                      </div>
                    </div>
                  </Card>
                </section>

                <div ref={setDeferredSentinelNode} className="h-px" aria-hidden />

                {/* Secondary analysis is grouped by question: movement first, then composition.
                    On mobile the sections separate more than the charts within them (gridGapClass),
                    so each question reads as its own group; desktop keeps them tighter. */}
                <div className={isCompact ? "space-y-3" : "space-y-6 xl:space-y-4"}>
                  <section
                    aria-label={`${t("cashFlow")} / ${t("cumulativeGrowth")} / ${t("investmentCostBasis")} / ${t("returnTrend")}`}
                    className={isCompact ? "space-y-2" : "space-y-3"}
                  >
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                          {t("movementSectionTitle")}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {t("movementSectionSubtitle")}
                        </p>
                      </div>
                    </div>
                    <div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>
                      {showDeferredCharts ? (
                        <>
                          <Card size="sm" className="h-full">
                            <LazyCashFlowChart
                              buckets={series.cashFlowBuckets}
                              baseCurrency={baseCurrency}
                            />
                          </Card>
                          <Card size="sm" className="h-full">
                            <LazyCumulativeGrowthChart
                              points={series.cumulativeGrowth}
                              baseCurrency={baseCurrency}
                            />
                          </Card>
                          <Card size="sm" className="h-full">
                            <LazyInvestmentCostBasisChart
                              summary={investmentCostBasis}
                              baseCurrency={baseCurrency}
                            />
                          </Card>
                          <Card size="sm" className="h-full">
                            <LazyReturnTrendChart points={series.returnTrend} />
                          </Card>
                          <Card size="sm" className="h-full xl:col-span-2">
                            <LazyDrawdownChart points={drawdownSeries} />
                          </Card>
                        </>
                      ) : (
                        <>
                          <ChartSkeletonCard />
                          <ChartSkeletonCard />
                          <ChartSkeletonCard />
                          <ChartSkeletonCard />
                          <ChartSkeletonCard className="xl:col-span-2" />
                        </>
                      )}
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
                      {showDeferredCharts ? (
                        <>
                          <Card size="sm" className="h-full">
                            <LazyCategoryTrendChart
                              data={series.categoryHistory}
                              baseCurrency={baseCurrency}
                            />
                          </Card>
                          <Card size="sm" className="h-full">
                            <LazyAttributionChart
                              items={series.attributionItems}
                              baseCurrency={baseCurrency}
                            />
                          </Card>
                        </>
                      ) : (
                        <>
                          <ChartSkeletonCard />
                          <ChartSkeletonCard />
                        </>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </motion.div>
        )}
      </MountedAnalysis>

      {/* History tab content — mobile only */}
      {showHistory && <HistoryView snapshots={snapshots} baseCurrency={baseCurrency} />}
    </div>
  );
}
