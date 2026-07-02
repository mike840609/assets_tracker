"use client";

import { memo, useEffect, useMemo, useState, startTransition } from "react";
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
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick, getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { CashFlowBucket } from "@/lib/services/analysis-service";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  buckets: CashFlowBucket[];
  baseCurrency: string;
}

interface TooltipPayload {
  payload: CashFlowBucket;
  dataKey: string;
  value: number;
  color: string;
}

function CashFlowTooltip({
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
  const b = payload[0].payload;

  if (b.isEmpty) {
    return (
      <ChartTooltipContainer title={b.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
      </ChartTooltipContainer>
    );
  }

  const contribSign = b.contributions >= 0 ? "+" : "";
  const marketSign = b.marketPerformance >= 0 ? "+" : "";
  const deltaSign = b.deltaNetWorth >= 0 ? "+" : "";

  return (
    <ChartTooltipContainer title={b.label}>
      <ChartTooltipRow
        label={t("seriesContributions")}
        value={
          privacyMode ? "***" : `${contribSign}${formatCurrency(b.contributions, baseCurrency)}`
        }
      />
      <ChartTooltipRow
        label={t("seriesMarket")}
        value={
          privacyMode ? "***" : `${marketSign}${formatCurrency(b.marketPerformance, baseCurrency)}`
        }
        valueClassName={
          b.marketPerformance >= 0 ? "text-[var(--gain-ink)]" : "text-[var(--loss-ink)]"
        }
      />
      <div className="pt-1.5 mt-1.5 border-t border-border/40">
        <ChartTooltipRow
          label={t("tooltipChange")}
          value={
            privacyMode ? "***" : `${deltaSign}${formatCurrency(b.deltaNetWorth, baseCurrency)}`
          }
          valueClassName={
            b.deltaNetWorth >= 0 ? "text-[var(--gain-ink)]" : "text-[var(--loss-ink)]"
          }
        />
      </div>
    </ChartTooltipContainer>
  );
}

const cashflowConfig = {} satisfies ChartConfig;

export const CashFlowChart = memo(function CashFlowChart({ buckets, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(buckets.length, density === "compact" ? 5 : 6);

  // Break the net-delta line on padded months instead of dragging it to zero.
  const chartData = useMemo(
    () => buckets.map((b) => ({ ...b, deltaLine: b.isEmpty ? null : b.deltaNetWorth })),
    [buckets],
  );

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("cashFlow")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("cashFlowSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {buckets.length === 0 ? (
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
                {t("tooltipChange")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("cashFlow")}, ${t("cashFlowSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={cashflowConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <ComposedChart
                  data={chartData}
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
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <CashFlowTooltip
                        baseCurrency={baseCurrency}
                        t={t}
                        privacyMode={privacyMode}
                      />
                    }
                  />
                  <Bar
                    dataKey="contributions"
                    name={t("seriesContributions")}
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {buckets.map((b) => (
                      <Cell
                        key={`contrib-${b.monthKey}`}
                        fill="var(--chart-3)"
                        opacity={b.isEmpty ? 0.2 : 0.85}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="marketPerformance"
                    name={t("seriesMarket")}
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {buckets.map((b) => (
                      <Cell
                        key={`market-${b.monthKey}`}
                        fill={
                          b.isEmpty
                            ? "var(--muted-foreground)"
                            : b.marketPerformance >= 0
                              ? "var(--gain)"
                              : "var(--loss)"
                        }
                        opacity={b.isEmpty ? 0.2 : 1}
                      />
                    ))}
                  </Bar>
                  {/* Net delta line — always shows the true monthly change, even in
                      mixed-sign months where the stacked bars don't sum visually. */}
                  <Line
                    type="monotone"
                    dataKey="deltaLine"
                    name={t("tooltipChange")}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={isAnimationActive}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("cashFlowNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
