"use client";

import { useEffect, useState, startTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
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

  return (
    <div className="rounded-md border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 text-xs shadow-md space-y-1 min-w-[180px]">
      <div className="font-medium leading-tight">{item.accountName}</div>
      <div className="text-muted-foreground text-[11px]">{getCategoryLabel(item.category)}</div>
      <div className="border-t border-border/60 pt-1 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("attrCash")}</span>
          <span className="tabular-nums">
            {privacyMode
              ? "***"
              : `${cashSign}${formatCurrency(item.cashContribution, baseCurrency)}`}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("attrMarket")}</span>
          <span
            className={`tabular-nums ${
              item.marketPerformance >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
            }`}
          >
            {privacyMode
              ? "***"
              : `${mktSign}${formatCurrency(item.marketPerformance, baseCurrency)}`}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/60 pt-1">
          <span className="text-muted-foreground">{t("tooltipChange")}</span>
          <span
            className={`tabular-nums font-medium ${
              item.totalDelta >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
            }`}
          >
            {privacyMode ? "***" : `${totalSign}${formatCurrency(item.totalDelta, baseCurrency)}`}
          </span>
        </div>
      </div>
    </div>
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

export function AttributionChart({ items, baseCurrency }: Props) {
  const t = useTranslations("analysis");
  const tCat = useTranslations("categories");
  const { privacyMode } = usePrivacyMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const getCategoryLabel = (cat: string) =>
    tCat(cat as Parameters<typeof tCat>[0], { defaultValue: cat });

  const totalCash = items.reduce((s, i) => s + i.cashContribution, 0);
  const totalMarket = items.reduce((s, i) => s + i.marketPerformance, 0);
  const totalDelta = items.reduce((s, i) => s + i.totalDelta, 0);

  // Recharts vertical layout renders bottom-to-top, so reverse to put the
  // largest bar at the top of the chart.
  const chartData = [...items].reverse();

  const chartHeight = Math.max(200, chartData.length * 36 + 40);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("attribution")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("attributionSubtitle")}</p>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {items.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            {t("attributionNoData")}
          </div>
        ) : !mounted ? (
          <div style={{ height: chartHeight }} />
        ) : (
          <div
            className={`space-y-4 transition-[filter] duration-300 ${
              privacyMode ? "blur-sm pointer-events-none select-none" : ""
            }`}
          >
            <div role="img" aria-label={`${t("attribution")}, ${t("attributionSubtitle")}`}>
              <ResponsiveContainer width="100%" height={chartHeight}>
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
                  <Tooltip
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
                  <Bar dataKey="totalDelta" radius={[0, 4, 4, 0]}>
                    {chartData.map((item) => (
                      <Cell
                        key={item.accountId}
                        fill={item.totalDelta >= 0 ? "var(--chart-1)" : "var(--destructive)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
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
                    totalMarket >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
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
                    totalDelta >= 0 ? "text-[var(--chart-1)]" : "text-destructive"
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
    </Card>
  );
}
