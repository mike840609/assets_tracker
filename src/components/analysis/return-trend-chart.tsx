"use client";

import { memo, useEffect, useState, startTransition } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { ReturnTrendPoint } from "@/lib/services/analysis-service";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  points: ReturnTrendPoint[];
}

interface TooltipPayload {
  payload: ReturnTrendPoint;
}

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function ReturnTooltip({
  active,
  payload,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  t: (key: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  if (p.monthlyReturn === null) {
    return (
      <ChartTooltipContainer title={p.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
        {p.cumulativeReturn !== null && (
          <ChartTooltipRow
            label={t("seriesCumulativeReturn")}
            value={privacyMode ? "***" : formatPct(p.cumulativeReturn)}
            indicatorColor="var(--primary)"
          />
        )}
      </ChartTooltipContainer>
    );
  }

  return (
    <ChartTooltipContainer title={p.label}>
      <ChartTooltipRow
        label={t("seriesMonthlyReturn")}
        value={privacyMode ? "***" : formatPct(p.monthlyReturn)}
        indicatorColor={p.monthlyReturn >= 0 ? "var(--gain)" : "var(--loss)"}
        valueClassName={p.monthlyReturn >= 0 ? "text-[var(--gain-ink)]" : "text-[var(--loss-ink)]"}
      />
      {p.cumulativeReturn !== null && (
        <ChartTooltipRow
          label={t("seriesCumulativeReturn")}
          value={privacyMode ? "***" : formatPct(p.cumulativeReturn)}
          indicatorColor="var(--primary)"
        />
      )}
    </ChartTooltipContainer>
  );
}

const returnConfig = {} satisfies ChartConfig;

export const ReturnTrendChart = memo(function ReturnTrendChart({ points }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(points.length, density === "compact" ? 5 : 6);

  const hasData = points.some((p) => p.monthlyReturn !== null);

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("returnTrend")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("returnTrendSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {!hasData ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            className={`relative flex min-h-0 flex-1 flex-col transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <div className="mb-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--gain)" }}
                />
                {t("seriesMonthlyReturn")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                {t("seriesCumulativeReturn")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("returnTrend")}, ${t("returnTrendSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={returnConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <ComposedChart
                  data={points}
                  margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                  {...crosshairHandlers}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                  <XAxis
                    dataKey="label"
                    interval={xAxisInterval}
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => (privacyMode ? "" : `${Math.round(v * 100)}%`)}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                    content={<ReturnTooltip t={t} privacyMode={privacyMode} />}
                  />
                  <Bar
                    dataKey="monthlyReturn"
                    name={t("seriesMonthlyReturn")}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {points.map((p) => (
                      <Cell
                        key={p.monthKey}
                        fill={
                          p.monthlyReturn !== null && p.monthlyReturn < 0
                            ? "var(--loss)"
                            : "var(--gain)"
                        }
                        fillOpacity={0.75}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="cumulativeReturn"
                    name={t("seriesCumulativeReturn")}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={isAnimationActive}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("returnTrendNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
