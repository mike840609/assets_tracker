"use client";

import { useMemo, useCallback, useRef, type ReactNode } from "react";
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
  useXAxisScale,
  useYAxisScale,
  usePlotArea,
} from "recharts";
import { useContainerSize } from "@/hooks/use-container-size";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency, getCurrencySymbol } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePersistedRange } from "@/hooks/use-persisted-range";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { useActiveDate } from "@/components/history/active-day-context";
import { findChartPoint } from "@/components/dashboard/trend-chart-utils";

type SnapshotData = {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  label?: string | null;
  note?: string | null;
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

  const snapshot = payload[0] as
    | ({ payload?: ChartDataPoint } & {
        name: string;
        value: number;
        color?: string;
        stroke?: string;
      })
    | undefined;
  const snapshotLabel = privacyMode ? null : snapshot?.payload?.label;
  const snapshotNote = privacyMode ? null : snapshot?.payload?.note;

  const formatValue = (v: number) => {
    if (privacyMode) return "***";
    if (isPercentMode) return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
    return formatCurrency(v, baseCurrency);
  };

  return (
    <ChartTooltipContainer title={formattedDate}>
      {(snapshotLabel || snapshotNote) && (
        <div className="mb-2 border-b border-border/60 pb-2">
          {snapshotLabel && (
            <p className="max-w-56 truncate text-sm font-medium text-foreground">{snapshotLabel}</p>
          )}
          {snapshotNote && (
            <p className="mt-0.5 max-w-56 text-xs leading-snug text-muted-foreground">
              {snapshotNote}
            </p>
          )}
        </div>
      )}
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
  footer,
}: {
  snapshots: SnapshotData[];
  baseCurrency?: string;
  hideRangeFilter?: boolean;
  footer?: ReactNode;
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
  const currencySymbol = getCurrencySymbol(baseCurrency);

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

  // ponytail: inline so it closes over chartData — recharts 3.8 has no hook to
  // read the chart's data array inside a Customized child. Only this component
  // subscribes to the active day, so a hover repaints just the marker.
  const LinkedMarker = () => {
    const activeDate = useActiveDate();
    const xScale = useXAxisScale() as
      | (((value: string) => number | undefined) & { bandwidth?: () => number })
      | undefined;
    const yScale = useYAxisScale();
    const plotArea = usePlotArea();

    const point = findChartPoint(chartData, activeDate);
    if (!point || !xScale || !yScale || !plotArea) return null;

    const rawX = xScale(point.date);
    if (rawX == null) return null;
    const band = typeof xScale.bandwidth === "function" ? xScale.bandwidth() / 2 : 0;
    const x = rawX + band;

    const yValue = point.netWorthPct ?? point.netWorth;
    const y = yScale(yValue);
    if (y == null) return null;

    return (
      <g pointerEvents="none">
        <line
          x1={x}
          y1={plotArea.y}
          x2={x}
          y2={plotArea.y + plotArea.height}
          stroke="var(--primary)"
          strokeWidth={1}
          strokeDasharray="4 3"
          strokeOpacity={0.6}
        />
        <circle cx={x} cy={y} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
      </g>
    );
  };

  const periodChange = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].netWorth;
    const last = filtered[filtered.length - 1].netWorth;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : null;
    return { delta, pct };
  }, [filtered]);

  // Fit the Y-axis to the visible range (with breathing room) instead of
  // anchoring at zero. Net-worth series rarely approach zero, so a 0-based
  // axis spends most of the canvas on empty space and flattens the trend.
  // Percent mode already centers on its own baseline, so leave it to recharts.
  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (isPercentMode || filtered.length === 0) return undefined;
    let min = Infinity;
    let max = -Infinity;
    for (const s of filtered) {
      if (s.netWorth < min) min = s.netWorth;
      if (s.netWorth > max) max = s.netWorth;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    if (min === max) {
      const pad = Math.abs(min) * 0.05 || 1;
      return [min - pad, max + pad];
    }
    const pad = (max - min) * 0.18;
    return [min - pad, max + pad];
  }, [filtered, isPercentMode]);

  return (
    <Card className="relative h-full flex flex-col pb-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2 px-4">
        <div className="flex flex-col gap-1 min-w-0">
          <CardTitle className="text-foreground">{t("title")}</CardTitle>
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
                  ? "bg-[var(--gain)]/10 text-[var(--gain-ink)]"
                  : "bg-[var(--loss)]/10 text-[var(--loss-ink)]"
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
            <SegmentedControl
              variant="pill"
              size="xs"
              options={ranges.map((r) => ({ value: r.label, label: r.label }))}
              value={range}
              onValueChange={setRange}
              aria-label={t("title")}
              className="justify-end gap-0.5 p-0"
            />
            <div className="mx-1 h-3 w-px bg-border" />
            <SegmentedControl
              variant="pill"
              size="xs"
              options={[
                { value: "off", label: currencySymbol, title: t("absToggleTitle") },
                { value: "on", label: "%", title: t("pctToggleTitle") },
              ]}
              value={pctMode === "on" ? "on" : "off"}
              onValueChange={setPctMode}
              aria-label={t("valueModeLabel")}
              className="gap-0 bg-muted p-0.5"
              itemClassName="tabular-nums"
            />
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
                  <YAxis
                    width={42}
                    tick={{ fontSize: 12 }}
                    tickFormatter={yTickFormatter}
                    domain={yDomain ?? ["auto", "auto"]}
                  />
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
                  <Customized component={LinkedMarker} />
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
      {footer && <div className="border-t border-border/40 px-4 pt-3 pb-4">{footer}</div>}
    </Card>
  );
}
