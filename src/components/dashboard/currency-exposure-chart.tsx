"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslations } from "next-intl";
import type { NetWorthSummary } from "@/lib/types";

const COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#3b82f6", "#10b981", 
  "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

export function CurrencyExposureChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("currencyExposure");
  useEffect(() => setMounted(true), []);

  const total = summary.currencyExposure.reduce((acc, curr) => acc + curr.value, 0);
  const data = summary.currencyExposure
    .map((exposure) => ({
      name: exposure.currency,
      value: Math.round(exposure.value * 100) / 100,
      percentage: total > 0 ? ((exposure.value / total) * 100).toFixed(1) : "0",
    }))
    .filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {t("noExposure")}
          </div>
        ) : !mounted ? (
          <div className="h-[250px]" />
        ) : (
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
              <Tooltip
                formatter={(value: any, name: any, props: any) => {
                  const formattedValue = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: summary.baseCurrency,
                  }).format(Number(value || 0));
                  const percentage = props?.payload?.percentage || "0";
                  return [`${formattedValue} (${percentage}%)`, name];
                }}
              />
              <Legend
                formatter={(value, entry: any) => {
                  const percentage = entry?.payload?.percentage;
                  return (
                    <span className="inline-flex items-baseline gap-1.5 ml-1 select-none">
                      <span className="font-medium text-foreground">{value}</span>
                      {percentage && (
                        <span className="text-sm font-normal text-muted-foreground tabular-nums">
                          {percentage}%
                        </span>
                      )}
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
