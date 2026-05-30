"use client";

import dynamic from "next/dynamic";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDensity } from "@/components/layout/density-context";

function ChartSkeleton({ height = 280 }: { height?: number }) {
  const { density } = useDensity();
  const skeletonHeight = density === "compact" ? Math.max(180, height - 40) : height;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        <Skeleton style={{ height: skeletonHeight }} />
      </CardContent>
    </>
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
