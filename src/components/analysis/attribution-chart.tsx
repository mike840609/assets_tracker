"use client";

import { useEffect, useState, startTransition } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { AttributionItem } from "@/lib/services/analysis-service";

interface Props {
  items: AttributionItem[];
  baseCurrency: string;
}

interface TooltipEntry {
  payload: AttributionItem;
}

function AttributionTooltip({
  active,
  payload,
  baseCurrency,
  t,
  getCategoryLabel,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  baseCurrency: string;
  t: (key: string) => string;
  getCategoryLabel: (cat: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const cashSign = item.cashContribution >= 0 ? "+" : "";
  const mktSign = item.marketPerformance >= 0 ? "+" : "";
  const totalSign = item.totalDelta >= 0 ? "+" : "";

  const titleNode = (
    <>
      <div className="leading-tight">{item.accountName}</div>
      <div className="font-normal text-muted-foreground text-[10px] leading-snug mt-0.5">
        {getCategoryLabel(item.category)}
      </div>
    </>
  );

  return (
    <ChartTooltipContainer title={titleNode} className="min-w-[180px]">
      <ChartTooltipRow
        label={t("attrCash")}
        value={
          privacyMode ? "***" : `${cashSign}${formatCurrency(item.cashContribution, baseCurrency)}`
        }
      />
      <ChartTooltipRow
        label={t("attrMarket")}
        value={
          privacyMode ? "***" : `${mktSign}${formatCurrency(item.marketPerformance, baseCurrency)}`
        }
        valueClassName={item.marketPerformance >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]"}
      />
      <div className="pt-1.5 mt-1.5 border-t border-border/40">
        <ChartTooltipRow
          label={t("tooltipChange")}
          value={
            privacyMode ? "***" : `${totalSign}${formatCurrency(item.totalDelta, baseCurrency)}`
          }
          valueClassName={item.totalDelta >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]"}
        />
      </div>
    </ChartTooltipContainer>
  );
}

const tickFormatter = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : String(Math.round(v));

const MAX_LABEL_LEN = 18;
const truncate = (s: string) =>
  s.length > MAX_LABEL_LEN ? s.slice(0, MAX_LABEL_LEN - 1) + "…" : s;

const attributionConfig = {} satisfies ChartConfig;

export function AttributionChart({ items, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const [mounted, setMounted] = useState(false);
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);

  const getCategoryLabel = (cat: string) =>
    tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat });

  const totalCash = items.reduce((s, i) => s + i.cashContribution, 0);
  const totalMarket = items.reduce((s, i) => s + i.marketPerformance, 0);
  const totalDelta = items.reduce((s, i) => s + i.totalDelta, 0);

  // Recharts vertical layout renders bottom-to-top, so reverse to put the
  // largest bar at the top of the chart.
  const chartData = [...items].reverse();

  const chartHeight = isCompact ? 180 : 200;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("attribution")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("attributionSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {items.length === 0 ? (
          <ChartEmptyState message={t("attributionNoData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            className={`flex min-h-0 flex-1 flex-col ${isCompact ? "gap-3" : "gap-4"} transition-[filter] duration-300 ${
              privacyMode ? "blur-sm pointer-events-none select-none" : ""
            }`}
            style={{ minHeight: chartHeight }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-2)" }}
                />
                {t("attrCash")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--gain)" }}
                />
                {t("attrMarket")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("attribution")}, ${t("attributionSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={attributionConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => (privacyMode ? "" : tickFormatter(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="accountName"
                    tick={{ fontSize: 12 }}
                    tickFormatter={truncate}
                    width={130}
                  />
                  <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1.5} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <AttributionTooltip
                        baseCurrency={baseCurrency}
                        t={t}
                        getCategoryLabel={getCategoryLabel}
                        privacyMode={privacyMode}
                      />
                    }
                  />
                  <Bar
                    dataKey="cashContribution"
                    name={t("attrCash")}
                    stackId="split"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {chartData.map((item) => (
                      <Cell
                        key={`cash-${item.accountId}`}
                        fill="var(--chart-2)"
                        opacity={Math.abs(item.cashContribution) > 0 ? 0.85 : 0.25}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="marketPerformance"
                    name={t("attrMarket")}
                    stackId="split"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {chartData.map((item) => (
                      <Cell
                        key={`market-${item.accountId}`}
                        fill={item.marketPerformance >= 0 ? "var(--gain)" : "var(--loss)"}
                        opacity={Math.abs(item.marketPerformance) > 0 ? 1 : 0.25}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* Summary row */}
            <div
              className={`grid grid-cols-3 gap-2 rounded-lg bg-muted/40 text-xs ${
                isCompact ? "px-2.5 py-1.5" : "px-3 py-2"
              }`}
            >
              <div>
                <div className="text-muted-foreground">{t("attrCash")}</div>
                <div className="tabular-nums font-medium mt-0.5">
                  {totalCash >= 0 ? "+" : ""}
                  {formatCurrency(totalCash, baseCurrency)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("attrMarket")}</div>
                <div
                  className={`tabular-nums font-medium mt-0.5 ${
                    totalMarket >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]"
                  }`}
                >
                  {totalMarket >= 0 ? "+" : ""}
                  {formatCurrency(totalMarket, baseCurrency)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("tooltipChange")}</div>
                <div
                  className={`tabular-nums font-medium mt-0.5 ${
                    totalDelta >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]"
                  }`}
                >
                  {totalDelta >= 0 ? "+" : ""}
                  {formatCurrency(totalDelta, baseCurrency)}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">{t("attributionNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
}
