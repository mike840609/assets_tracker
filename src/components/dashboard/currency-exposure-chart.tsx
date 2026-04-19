"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { NetWorthSummary } from "@/lib/types";
import { createPieTooltipFormatter, createPieLegendFormatter } from "@/lib/chart-formatters";

const COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#3b82f6", "#10b981",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("currencyExposure");
  const { privacyMode } = usePrivacyMode();
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[320px]">
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
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
