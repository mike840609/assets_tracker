"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { NetWorthSummary } from "@/lib/types";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

const CATEGORY_LABELS: Record<string, string> = {
  BANK: "Bank",
  BROKERAGE: "Brokerage",
  CRYPTO_WALLET: "Crypto",
  PROPERTY: "Property",
  VEHICLE: "Vehicle",
  CREDIT_CARD: "Credit Card",
  LOAN: "Loan",
  MORTGAGE: "Mortgage",
  OTHER: "Other",
};

export function AllocationChart({ summary }: { summary: NetWorthSummary }) {
  const [mounted, setMounted] = useState(false);
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
      name: CATEGORY_LABELS[category] ?? category,
      value: Math.round(value * 100) / 100,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            No assets to display.
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
