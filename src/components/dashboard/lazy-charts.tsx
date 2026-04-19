"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[320px] bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export const LazyTrendChart = dynamic(
  () => import("./trend-chart").then((m) => m.TrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyAllocationChart = dynamic(
  () => import("./allocation-chart").then((m) => m.AllocationChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyCurrencyExposureChart = dynamic(
  () => import("./currency-exposure-chart").then((m) => m.CurrencyExposureChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
