"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { useDensity } from "@/components/layout/density-context";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { formatChartTick } from "@/lib/chart-formatters";
import { formatCurrency } from "@/lib/currencies";
import type { InvestmentCostBasisSummary } from "@/lib/services/analysis-service";

interface Props {
  summary: InvestmentCostBasisSummary;
  baseCurrency: string;
}

interface CostBasisBar {
  key: "marketValue" | "costBasis";
  label: string;
  value: number;
  color: string;
}

interface TooltipPayload {
  payload: CostBasisBar;
}

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function CostBasisTooltip({
  active,
  payload,
  summary,
  baseCurrency,
  privacyMode,
  t,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  summary: InvestmentCostBasisSummary;
  baseCurrency: string;
  privacyMode?: boolean;
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const gainClass =
    summary.unrealizedGain == null || summary.unrealizedGain >= 0
      ? "text-[var(--gain-ink)]"
      : "text-[var(--loss-ink)]";

  return (
    <ChartTooltipContainer title={t("investmentCostBasis")}>
      <ChartTooltipRow
        label={t("seriesMarketValue")}
        value={privacyMode ? "***" : formatCurrency(summary.marketValue, baseCurrency)}
        indicatorColor="var(--primary)"
      />
      <ChartTooltipRow
        label={t("seriesCostBasis")}
        value={privacyMode ? "***" : formatCurrency(summary.costBasis, baseCurrency)}
        indicatorColor="var(--chart-3)"
      />
      {summary.unrealizedGain !== null && (
        <div className="pt-1.5 mt-1.5 border-t border-border/40">
          <ChartTooltipRow
            label={t("unrealizedGain")}
            value={
              privacyMode
                ? "***"
                : `${summary.unrealizedGain >= 0 ? "+" : ""}${formatCurrency(summary.unrealizedGain, baseCurrency)}`
            }
            valueClassName={gainClass}
          />
          {summary.unrealizedGainPct !== null && (
            <ChartTooltipRow
              label={t("unrealizedGainPct")}
              value={privacyMode ? "***" : formatPct(summary.unrealizedGainPct)}
              valueClassName={gainClass}
            />
          )}
        </div>
      )}
    </ChartTooltipContainer>
  );
}

const costBasisConfig = {} satisfies ChartConfig;

export const InvestmentCostBasisChart = memo(function InvestmentCostBasisChart({
  summary,
  baseCurrency,
}: Props) {
  const t = useTranslations("analysis");
  const { density } = useDensity();
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const chartHeight = density === "compact" ? 180 : 200;
  const points: CostBasisBar[] = [
    {
      key: "marketValue",
      label: t("seriesMarketValue"),
      value: summary.marketValue,
      color: "var(--primary)",
    },
    {
      key: "costBasis",
      label: t("seriesCostBasis"),
      value: summary.costBasis,
      color: "var(--chart-3)",
    },
  ];

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("investmentCostBasis")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("investmentCostBasisSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {summary.pricedHoldingCount === 0 ? (
          <ChartEmptyState message={t("costBasisNoData")} hint={t("emptyHint")} />
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
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary" />
                {t("seriesMarketValue")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-3)" }}
                />
                {t("seriesCostBasis")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("investmentCostBasis")}, ${t("investmentCostBasisSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={costBasisConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <CostBasisTooltip
                        summary={summary}
                        baseCurrency={baseCurrency}
                        privacyMode={privacyMode}
                        t={t}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {points.map((point) => (
                      <Cell key={point.key} fill={point.color} fillOpacity={0.82} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            {summary.costedHoldingCount < summary.pricedHoldingCount && (
              <p className="mt-2 text-[11px] text-muted-foreground">{t("costBasisPartialNote")}</p>
            )}
          </div>
        )}
      </CardContent>
    </>
  );
});
