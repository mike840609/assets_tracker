"use client";

import { useMemo, useCallback, useRef } from "react";
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

function TrendTooltip({
  active,
  payload,
  label,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; stroke?: string }[];
  label?: string;
  baseCurrency: string;
  privacyMode: boolean;
}) {
  if (!active || !payload?.length || !label) return null;

  const date = new Date(label);
  const formattedDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <ChartTooltipContainer title={formattedDate}>
      {payload.map((entry, i) => (
        <ChartTooltipRow
          key={i}
          label={entry.name}
          value={privacyMode ? "***" : formatCurrency(entry.value, baseCurrency)}
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
  const y = yScale((dataPoints[0] as SnapshotData).netWorth);
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

const ranges = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
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
  const t = useTranslations("trendChart");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const { handlers: crosshairHandlers } = useChartCrosshair();

  const selectedRange = ranges.find((r) => r.label === range)!;

  const xTickFormatter = useCallback((v: string) => {
    const d = new Date(v);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }, []);

  const yTickFormatter = useCallback(
    (v: number) =>
      privacyMode
        ? ""
        : v >= 1000000
          ? `${(v / 1000000).toFixed(1)}M`
          : v >= 1000
            ? `${(v / 1000).toFixed(0)}K`
            : v.toString(),
    [privacyMode],
  );

  const filtered = useMemo(() => {
    if (hideRangeFilter || selectedRange.days === Infinity) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedRange.days);
    return snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [snapshots, selectedRange.days, hideRangeFilter]);

  const periodChange = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].netWorth;
    const last = filtered[filtered.length - 1].netWorth;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : null;
    return { delta, pct };
  }, [filtered]);

  return (
    <Card className="border-0 bg-transparent shadow-none h-full flex flex-col pb-0">
      <CardHeader className="flex flex-row items-start justify-between pb-2 px-2 sm:px-4">
        <div>
          <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
          {periodChange && (
            <div
              className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${
                periodChange.delta >= 0
                  ? "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-950/50 text-destructive"
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
          <div className="flex gap-1">
            {ranges.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                aria-pressed={range === r.label}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r.label
                    ? "bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    : "text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-0 flex-1 flex flex-col">
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
              <AreaChart
                width={containerWidth}
                height={containerHeight}
                data={filtered}
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
                  content={<TrendTooltip baseCurrency={baseCurrency} privacyMode={privacyMode} />}
                />
                <Customized component={CrosshairLines} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={t("seriesName")}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                />
              </AreaChart>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
