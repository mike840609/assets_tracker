"use client";

import { useMemo, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  Customized,
  useActiveTooltipCoordinate,
  useActiveTooltipDataPoints,
  useYAxisScale,
  usePlotArea,
} from "recharts";
import { useContainerSize } from "@/hooks/use-container-size";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";

type SnapshotData = {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

type ChartDataPoint = SnapshotData & { netWorthPct?: number };

function TrendTooltip({
  active,
  payload,
  label,
  baseCurrency,
  privacyMode,
  isPercentMode,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; stroke?: string }[];
  label?: string;
  baseCurrency: string;
  privacyMode: boolean;
  isPercentMode: boolean;
}) {
  if (!active || !payload?.length || !label) return null;

  const date = new Date(label);
  const formattedDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formatValue = (v: number) => {
    if (privacyMode) return "***";
    if (isPercentMode) return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
    return formatCurrency(v, baseCurrency);
  };

  return (
    <ChartTooltipContainer title={formattedDate}>
      {payload.map((entry, i) => (
        <ChartTooltipRow
          key={i}
          label={entry.name}
          value={formatValue(entry.value)}
          indicatorColor={entry.color || entry.stroke}
        />
      ))}
    </ChartTooltipContainer>
  );
}

function CrosshairLines() {
  const coordinate = useActiveTooltipCoordinate();
  const yScale = useYAxisScale();
  const dataPoints = useActiveTooltipDataPoints();
  const plotArea = usePlotArea();

  if (!coordinate || !yScale || !dataPoints?.[0] || !plotArea) return null;

  const x = coordinate.x;
  const dataPoint = dataPoints[0] as ChartDataPoint;
  const yValue = dataPoint.netWorthPct ?? dataPoint.netWorth;
  const y = yScale(yValue);
  if (y == null) return null;

  const stroke = "var(--muted-foreground)";
  return (
    <g pointerEvents="none">
      <line
        x1={x}
        y1={plotArea.y}
        x2={x}
        y2={plotArea.y + plotArea.height}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="4 3"
        strokeOpacity={0.5}
      />
      <line
        x1={plotArea.x}
        y1={y}
        x2={plotArea.x + plotArea.width}
        y2={y}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="4 3"
        strokeOpacity={0.5}
      />
    </g>
  );
}

const ranges: { label: string; days: number; ytd?: true }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "YTD", days: 0, ytd: true },
  { label: "1Y", days: 365 },
  { label: "All", days: Infinity },
];

export function TrendChart({
  snapshots,
  baseCurrency = "USD",
  hideRangeFilter = false,
}: {
  snapshots: SnapshotData[];
  baseCurrency?: string;
  hideRangeFilter?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useContainerSize(containerRef);
  const [range, setRange] = usePersistedRange<string>("trend-chart", "All");
  const [pctMode, setPctMode] = usePersistedRange<string>("trend-pct-mode", "off");
  const t = useTranslations("trendChart");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const shouldReduceMotion = useReducedMotion();
  const rangeFadeTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

  const selectedRange = ranges.find((r) => r.label === range)!;
  const isPercentMode = pctMode === "on";

  const xTickFormatter = useCallback((v: string) => {
    const d = new Date(v);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }, []);

  const yTickFormatter = useCallback(
    (v: number) => {
      if (privacyMode) return "";
      if (isPercentMode) return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
      return formatChartTick(v);
    },
    [privacyMode, isPercentMode],
  );

  const filtered = useMemo(() => {
    if (hideRangeFilter || selectedRange.days === Infinity) return snapshots;
    const cutoff = new Date();
    if (selectedRange.ytd) {
      cutoff.setMonth(0, 1);
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(cutoff.getDate() - selectedRange.days);
    }
    return snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [snapshots, selectedRange.days, selectedRange.ytd, hideRangeFilter]);

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!isPercentMode || filtered.length === 0) return filtered;
    const firstNetWorth = filtered[0].netWorth;
    if (firstNetWorth === 0) return filtered;
    return filtered.map((snapshot) => ({
      ...snapshot,
      netWorthPct: ((snapshot.netWorth - firstNetWorth) / Math.abs(firstNetWorth)) * 100,
    }));
  }, [filtered, isPercentMode]);

  const periodChange = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].netWorth;
    const last = filtered[filtered.length - 1].netWorth;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : null;
    return { delta, pct };
  }, [filtered]);

  return (
    <Card className="relative h-full flex flex-col pb-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2 px-4">
        <div className="flex flex-col gap-1 min-w-0">
          <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
          {periodChange && (
            <div
              aria-label={
                privacyMode
                  ? undefined
                  : `${t("seriesName")} change: ${periodChange.delta >= 0 ? "+" : ""}${formatCurrency(periodChange.delta, baseCurrency)}${periodChange.pct !== null ? ` (${periodChange.delta >= 0 ? "+" : ""}${periodChange.pct.toFixed(1)}%)` : ""}`
              }
              aria-hidden={privacyMode || undefined}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${
                periodChange.delta >= 0
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {privacyMode ? (
                "***"
              ) : (
                <>
                  {periodChange.delta >= 0 ? "+" : ""}
                  {formatCurrency(periodChange.delta, baseCurrency)}
                  {periodChange.pct !== null && (
                    <span className="text-[11px] opacity-70">
                      ({periodChange.delta >= 0 ? "+" : ""}
                      {periodChange.pct.toFixed(1)}%)
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {!hideRangeFilter && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
            {ranges.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                aria-pressed={range === r.label}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  range === r.label
                    ? "bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    : "text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                }`}
              >
                {r.label}
              </button>
            ))}
            <div className="mx-1 h-3 w-px bg-border" />
            <button
              onClick={() => setPctMode(isPercentMode ? "off" : "on")}
              aria-pressed={isPercentMode}
              title={t("pctToggleTitle")}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isPercentMode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              %
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-0 flex-1 flex flex-col">
        {filtered.length === 0 ? (
          <div className="flex-1 min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`relative flex-1 min-h-[200px] transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {containerWidth > 0 && containerHeight > 0 && (
              <motion.div
                key={range}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={rangeFadeTransition}
                style={{ width: containerWidth, height: containerHeight }}
              >
                <AreaChart
                  width={containerWidth}
                  height={containerHeight}
                  data={chartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                  {...crosshairHandlers}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    height={60}
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis width={42} tick={{ fontSize: 12 }} tickFormatter={yTickFormatter} />
                  <Tooltip
                    cursor={false}
                    content={
                      <TrendTooltip
                        baseCurrency={baseCurrency}
                        privacyMode={privacyMode}
                        isPercentMode={isPercentMode}
                      />
                    }
                  />
                  <Customized component={CrosshairLines} />
                  <Area
                    type="monotone"
                    dataKey={isPercentMode ? "netWorthPct" : "netWorth"}
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    name={t("seriesName")}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                </AreaChart>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
