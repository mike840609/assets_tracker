"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick, getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { CumulativeGrowthPoint } from "@/lib/services/analysis-service";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  points: CumulativeGrowthPoint[];
  baseCurrency: string;
}

interface TooltipPayload {
  payload: CumulativeGrowthPoint;
}

function GrowthTooltip({
  active,
  payload,
  baseCurrency,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  baseCurrency: string;
  t: (key: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  if (p.isEmpty) {
    return (
      <ChartTooltipContainer title={p.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
      </ChartTooltipContainer>
    );
  }

  const sign = (n: number) => (n >= 0 ? "+" : "");

  return (
    <ChartTooltipContainer title={p.label}>
      <ChartTooltipRow
        label={t("seriesContributions")}
        value={
          privacyMode
            ? "***"
            : `${sign(p.cumulativeContributions)}${formatCurrency(p.cumulativeContributions, baseCurrency)}`
        }
        indicatorColor="var(--chart-3)"
      />
      <ChartTooltipRow
        label={t("seriesMarket")}
        value={
          privacyMode
            ? "***"
            : `${sign(p.cumulativeMarket)}${formatCurrency(p.cumulativeMarket, baseCurrency)}`
        }
        indicatorColor="var(--gain)"
        valueClassName={
          p.cumulativeMarket >= 0 ? "text-[var(--gain-ink)]" : "text-[var(--loss-ink)]"
        }
      />
      <div className="pt-1.5 mt-1.5 border-t border-border/40">
        <ChartTooltipRow
          label={t("total")}
          value={
            privacyMode
              ? "***"
              : `${sign(p.cumulativeTotal)}${formatCurrency(p.cumulativeTotal, baseCurrency)}`
          }
          indicatorColor="var(--primary)"
        />
      </div>
    </ChartTooltipContainer>
  );
}

const growthConfig = {} satisfies ChartConfig;

export const CumulativeGrowthChart = memo(function CumulativeGrowthChart({
  points,
  baseCurrency,
}: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(points.length, density === "compact" ? 5 : 6);

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("cumulativeGrowth")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("cumulativeGrowthSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {points.length === 0 ? (
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
                  style={{ background: "var(--chart-3)" }}
                />
                {t("seriesContributions")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--gain)" }}
                />
                {t("seriesMarket")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                {t("total")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("cumulativeGrowth")}, ${t("cumulativeGrowthSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={growthConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <ComposedChart
                  data={points}
                  stackOffset="sign"
                  margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                  {...crosshairHandlers}
                >
                  <defs>
                    <linearGradient id="cg-contrib" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.25} />
                    </linearGradient>
                    <linearGradient id="cg-market" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gain)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--gain)" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                    content={
                      <GrowthTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeContributions"
                    name={t("seriesContributions")}
                    stackId="g"
                    stroke="var(--chart-3)"
                    strokeWidth={1.5}
                    fill="url(#cg-contrib)"
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeMarket"
                    name={t("seriesMarket")}
                    stackId="g"
                    stroke="var(--gain)"
                    strokeWidth={1.5}
                    fill="url(#cg-market)"
                    isAnimationActive={isAnimationActive}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeTotal"
                    name={t("total")}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    isAnimationActive={isAnimationActive}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("cumulativeGrowthNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
