"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { NetWorthSummary } from "@/lib/types";
import { createPieTooltipFormatter, createPieLegendFormatter } from "@/lib/chart-formatters";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

export function AllocationChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  useEffect(() => setMounted(true), []);

  const assetAccounts = summary.accounts.filter((a) => a.type === "ASSET");

  const categoryMap = new Map<string, number>();
  for (const account of assetAccounts) {
    const cat = account.category;
    const current = categoryMap.get(cat) ?? 0;
    categoryMap.set(cat, current + account.totalValueInBaseCurrency);
  }

  const total = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
  const data = Array.from(categoryMap.entries())
    .map(([category, value]) => ({
      name: t(`categories.${category}`, { defaultValue: category }),
      value: Math.round(value * 100) / 100,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

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
          <div className="relative">
            {privacyMode && (
              <div className="absolute inset-0 backdrop-blur-sm bg-background/30 rounded-lg z-10" />
            )}
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
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={createPieTooltipFormatter(summary.baseCurrency)} />
                <Legend formatter={createPieLegendFormatter()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
