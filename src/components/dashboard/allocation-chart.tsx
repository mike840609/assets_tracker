"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { formatCurrency } from "@/lib/currencies";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { NetWorthSummary } from "@/lib/types";
import { createPieLegendFormatter } from "@/lib/chart-formatters";

function AllocationTooltip({
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
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

export function AllocationChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const isAnimationActive = useChartAnimation();
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const account of summary.accounts) {
      if (account.type !== "ASSET") continue;
      const cat = account.category;
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + account.totalValueInBaseCurrency);
    }
    const total = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    return Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        name: t(`categories.${category}`, { defaultValue: category }),
        value: Math.round(value * 100) / 100,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary.accounts, t]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("allocationChart.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {t("allocationChart.noAssets")}
          </div>
        ) : !mounted ? (
          <div className="h-[250px]" />
        ) : (
          <div className={`relative transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={isAnimationActive}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <AllocationTooltip
                      baseCurrency={summary.baseCurrency}
                      privacyMode={privacyMode}
                    />
                  }
                />
                <Legend formatter={createPieLegendFormatter()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
