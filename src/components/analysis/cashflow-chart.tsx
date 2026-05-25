"use client";

import { useEffect, useState, startTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { formatChartTick } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
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
        valueClassName={b.marketPerformance >= 0 ? "text-[var(--chart-1)]" : "text-destructive"}
      />
      <div className="pt-1.5 mt-1.5 border-t border-border/40">
        <ChartTooltipRow
          label={t("tooltipChange")}
          value={
            privacyMode ? "***" : `${deltaSign}${formatCurrency(b.deltaNetWorth, baseCurrency)}`
          }
          valueClassName={b.deltaNetWorth >= 0 ? "text-[var(--chart-1)]" : "text-destructive"}
        />
      </div>
    </ChartTooltipContainer>
  );
}

export function CashFlowChart({ buckets, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("cashFlow")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("cashFlowSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {buckets.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noData")}
          </div>
        ) : !mounted ? (
          <div className="h-[280px]" />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-2)" }}
                />
                {t("seriesContributions")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-1)" }}
                />
                {t("seriesMarket")}
              </span>
            </div>
            <div role="img" aria-label={`${t("cashFlow")}, ${t("cashFlowSubtitle")}`}>
              <ResponsiveContainer
                width="100%"
                height={280}
                minWidth={0}
                initialDimension={{ width: 1, height: 280 }}
              >
                <BarChart
                  data={buckets}
                  margin={{ top: 10, right: 4, left: 0, bottom: 20 }}
                  {...crosshairHandlers}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <CashFlowTooltip
                        baseCurrency={baseCurrency}
                        t={t}
                        privacyMode={privacyMode}
                      />
                    }
                  />
                  {/* Contributions bar */}
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
                        fill="var(--chart-2)"
                        opacity={b.isEmpty ? 0.2 : 0.85}
                      />
                    ))}
                  </Bar>
                  {/* Market performance bar */}
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
                              ? "var(--chart-1)"
                              : "var(--destructive)"
                        }
                        opacity={b.isEmpty ? 0.2 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("cashFlowNote")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
