"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PerformanceSummaryCards } from "./performance-summary";
import { useTranslations } from "next-intl";
import type { PerformanceData } from "@/lib/performance-utils";

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

const LazyPerformanceChart = dynamic(
  () =>
    import("./performance-chart").then((m) => m.PerformanceChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

type PeriodMode = "monthly" | "yearly";

export function PerformanceContent({
  monthlyData,
  yearlyData,
  baseCurrency,
}: {
  monthlyData: PerformanceData;
  yearlyData: PerformanceData;
  baseCurrency: string;
}) {
  const t = useTranslations("performance");
  const [mode, setMode] = useState<PeriodMode>("monthly");

  const activeData = mode === "monthly" ? monthlyData : yearlyData;

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex gap-1">
        {(["monthly", "yearly"] as PeriodMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t(m)}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <PerformanceSummaryCards summary={activeData.summary} />

      {/* Bar chart */}
      <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
        <LazyPerformanceChart
          periods={activeData.periods}
          baseCurrency={baseCurrency}
        />
      </div>
    </div>
  );
}
