"use client";

import dynamic from "next/dynamic";
import { ChartCardSkeleton } from "@/components/dashboard/dashboard-section-skeletons";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

export const LazyTrendChart = dynamic(() => import("./trend-chart").then((m) => m.TrendChart), {
  loading: () => <TrendChartSkeleton />,
});

export const LazyAllocationChart = dynamic(
  () => import("./allocation-chart").then((m) => m.AllocationChart),
  { loading: () => <ChartCardSkeleton /> },
);

export const LazyCurrencyExposureChart = dynamic(
  () => import("./currency-exposure-chart").then((m) => m.CurrencyExposureChart),
  { loading: () => <ChartCardSkeleton /> },
);
