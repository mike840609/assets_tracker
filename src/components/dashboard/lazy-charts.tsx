"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-32 skeleton-shimmer rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] skeleton-shimmer rounded" />
      </CardContent>
    </Card>
  );
}

export const LazyTrendChart = dynamic(() => import("./trend-chart").then((m) => m.TrendChart), {
  loading: () => <TrendChartSkeleton />,
});

export const LazyAllocationChart = dynamic(
  () => import("./allocation-chart").then((m) => m.AllocationChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyCurrencyExposureChart = dynamic(
  () => import("./currency-exposure-chart").then((m) => m.CurrencyExposureChart),
  { loading: () => <ChartSkeleton /> },
);
