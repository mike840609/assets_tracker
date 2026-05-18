"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        <div className="bg-muted animate-pulse rounded" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export const LazyMonthlyChangeChart = dynamic(
  () => import("./monthly-change-chart").then((m) => m.MonthlyChangeChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyAssetsLiabilitiesChart = dynamic(
  () => import("./assets-liabilities-chart").then((m) => m.AssetsLiabilitiesChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyCashFlowChart = dynamic(
  () => import("./cashflow-chart").then((m) => m.CashFlowChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyCategoryTrendChart = dynamic(
  () => import("./category-trend-chart").then((m) => m.CategoryTrendChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyAttributionChart = dynamic(
  () => import("./attribution-chart").then((m) => m.AttributionChart),
  { loading: () => <ChartSkeleton height={200} /> },
);
