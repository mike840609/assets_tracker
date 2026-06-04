"use client";

import { useEffect, useState, startTransition } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { MonthlyBucket } from "@/lib/services/analysis-service";
import { formatMonthLabel } from "@/lib/services/analysis-service";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  buckets: MonthlyBucket[];
  baseCurrency: string;
  locale: string;
}

interface TooltipPayload {
  payload: MonthlyBucket & { label: string };
}

function ChangeTooltip({
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

  const pct = b.deltaPct === null ? "—" : `${b.deltaPct >= 0 ? "+" : ""}${b.deltaPct.toFixed(1)}%`;
  const sign = b.deltaNetWorth >= 0 ? "+" : "";

  return (
    <ChartTooltipContainer title={b.label}>
      {!privacyMode && (
        <>
          <ChartTooltipRow
            label={t("tooltipStart")}
            value={formatCurrency(b.startNetWorth, baseCurrency)}
          />
          <ChartTooltipRow
            label={t("tooltipEnd")}
            value={formatCurrency(b.endNetWorth, baseCurrency)}
          />
        </>
      )}
      <div className={!privacyMode ? "pt-1.5 mt-1.5 border-t border-border/40" : undefined}>
        <ChartTooltipRow
          label={t("tooltipChange")}
          value={
            privacyMode ? pct : `${sign}${formatCurrency(b.deltaNetWorth, baseCurrency)} (${pct})`
          }
          valueClassName={b.deltaNetWorth >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]"}
        />
      </div>
    </ChartTooltipContainer>
  );
}

const monthlyChangeConfig = {} satisfies ChartConfig;

export function MonthlyChangeChart({ buckets, baseCurrency, locale }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const data = buckets.map((b) => ({ ...b, label: formatMonthLabel(b.monthKey, locale) }));

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("monthlyChange")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("monthlyChangeSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {data.length === 0 ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            role="img"
            aria-label={`${t("monthlyChange")}, ${t("monthlyChangeSubtitle")}`}
            aria-hidden={privacyMode || undefined}
            className={`relative min-h-0 flex-1 transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <ChartContainer
              config={monthlyChangeConfig}
              className="w-full"
              style={{ height: "100%" }}
              initialDimension={{ width: 1, height: chartHeight }}
            >
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                {...crosshairHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
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
                    <ChangeTooltip baseCurrency={baseCurrency} t={t} privacyMode={privacyMode} />
                  }
                />
                <Bar
                  dataKey="deltaNetWorth"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.monthKey}
                      fill={
                        entry.isEmpty
                          ? "var(--muted-foreground)"
                          : entry.deltaNetWorth >= 0
                            ? "var(--gain)"
                            : "var(--loss)"
                      }
                      opacity={entry.isEmpty ? 0.3 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </>
  );
}
