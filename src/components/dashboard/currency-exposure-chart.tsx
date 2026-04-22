"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { NetWorthSummary } from "@/lib/types";
import { createPieLegendFormatter } from "@/lib/chart-formatters";

function ExposureTooltip({
  active,
  payload,
  baseCurrency,
  privacyMode,
}: {
  active?: boolean;
  payload?: any[];
  baseCurrency: string;
  privacyMode: boolean;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const percentage = entry.payload.percentage;

  return (
    <ChartTooltipContainer title={entry.name}>
      <ChartTooltipRow
        label="Value"
        value={
          privacyMode
            ? `${percentage}%`
            : `${formatCurrency(entry.value, baseCurrency)} (${percentage}%)`
        }
        indicatorColor={entry.fill || entry.color}
      />
    </ChartTooltipContainer>
  );
}

const COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#3b82f6", "#10b981",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        fillOpacity={0.95}
        stroke={fill}
        strokeWidth={2}
      />
    </g>
  );
}

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const t = useTranslations("currencyExposure");
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const total = summary.currencyExposure.reduce((acc, curr) => acc + curr.value, 0);
    return summary.currencyExposure
      .map((exposure) => ({
        name: exposure.currency,
        value: Math.round(exposure.value * 100) / 100,
        percentage: total > 0 ? ((exposure.value / total) * 100).toFixed(1) : "0",
      }))
      .filter((d) => d.value > 0);
  }, [summary.currencyExposure]);
  const totalValue = useMemo(
    () => data.reduce((acc, item) => acc + item.value, 0),
    [data]
  );
  const activeSlice = data[activeIndex] ?? data[0];

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
          </div>
        ) : !mounted ? (
          <div className="h-[250px]" />
        ) : (
          <div className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}>
            <ResponsiveContainer width="100%" height={285}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="46%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  activeIndex={activeIndex}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <text x="50%" y="42%" textAnchor="middle" className="fill-muted-foreground text-[12px]">
                  {t("title")}
                </text>
                <text x="50%" y="50%" textAnchor="middle" className="fill-foreground text-[16px] font-semibold">
                  {privacyMode ? "••••" : formatCurrency(totalValue, summary.baseCurrency)}
                </text>
                <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-[12px]">
                  {activeSlice ? `${activeSlice.name} · ${activeSlice.percentage}%` : ""}
                </text>
                <Tooltip
                  content={
                    <ExposureTooltip
                      baseCurrency={summary.baseCurrency}
                      privacyMode={privacyMode}
                    />
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={createPieLegendFormatter()}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
