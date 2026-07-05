"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { DrawdownPoint } from "@/lib/services/analysis-service";

interface Props {
  points: DrawdownPoint[];
}

interface TooltipPayload {
  payload: DrawdownPoint;
}

function DrawdownTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipContainer title={p.label}>
      <ChartTooltipRow
        label={t("drawdown")}
        value={`${p.drawdownPct.toFixed(1)}%`}
        indicatorColor="var(--loss)"
        valueClassName={p.drawdownPct < 0 ? "text-[var(--loss-ink)]" : undefined}
      />
    </ChartTooltipContainer>
  );
}

const drawdownConfig = {} satisfies ChartConfig;

export const DrawdownChart = memo(function DrawdownChart({ points }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(points.length, density === "compact" ? 5 : 6);
  const maxDrawdown = points.length ? Math.min(...points.map((p) => p.drawdownPct)) : 0;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium text-foreground">{t("drawdown")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("drawdownSubtitle")}</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">{t("maxDrawdown")}</div>
            <div className="text-sm font-semibold tabular-nums text-[var(--loss-ink)]">
              {privacyMode ? "***" : `${maxDrawdown.toFixed(1)}%`}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {points.length === 0 ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            role="img"
            aria-label={`${t("drawdown")}, ${t("drawdownSubtitle")}`}
            className={`relative flex min-h-0 flex-1 flex-col transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <ChartContainer
              config={drawdownConfig}
              className="w-full"
              style={{ height: "100%" }}
              initialDimension={{ width: 1, height: chartHeight }}
            >
              <AreaChart
                data={points}
                margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                {...crosshairHandlers}
              >
                <defs>
                  <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.4} />
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
                  width={44}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (privacyMode ? "" : `${Math.round(v)}%`)}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                  content={<DrawdownTooltip t={t} />}
                />
                <Area
                  type="monotone"
                  dataKey="drawdownPct"
                  name={t("drawdown")}
                  stroke="var(--loss)"
                  strokeWidth={1.5}
                  fill="url(#dd-fill)"
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                />
              </AreaChart>
            </ChartContainer>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("drawdownNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
