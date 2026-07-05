"use client";

import dynamic from "next/dynamic";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDensity } from "@/components/layout/density-context";

function ChartSkeleton({ height = 200 }: { height?: number }) {
  const { density } = useDensity();
  const skeletonHeight = density === "compact" ? Math.max(140, height - 20) : height;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <Skeleton className="h-5 w-40 max-w-full" />
        {/* Subtitle line — every analysis chart header has one (e.g. monthlyChangeSubtitle) */}
        <Skeleton className="mt-1.5 h-3 w-52 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        <Skeleton className="min-h-0 flex-1" style={{ minHeight: skeletonHeight }} />
      </CardContent>
    </>
  );
}

export const LazyAssetsLiabilitiesChart = dynamic(
  () => import("./assets-liabilities-chart").then((m) => m.AssetsLiabilitiesChart),
  { loading: () => <ChartSkeleton height={180} /> },
);

export const LazyCashFlowChart = dynamic(
  () => import("./cashflow-chart").then((m) => m.CashFlowChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyCumulativeGrowthChart = dynamic(
  () => import("./cumulative-growth-chart").then((m) => m.CumulativeGrowthChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyCategoryTrendChart = dynamic(
  () => import("./category-trend-chart").then((m) => m.CategoryTrendChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyAttributionChart = dynamic(
  () => import("./attribution-chart").then((m) => m.AttributionChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyReturnTrendChart = dynamic(
  () => import("./return-trend-chart").then((m) => m.ReturnTrendChart),
  { loading: () => <ChartSkeleton /> },
);

export const LazyDrawdownChart = dynamic(
  () => import("./drawdown-chart").then((m) => m.DrawdownChart),
  { loading: () => <ChartSkeleton /> },
);
