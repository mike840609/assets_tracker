"use client";

import dynamic from "next/dynamic";

// The chart renders directly inside the parent CardContent (no card of its own)
// at the height ProjectionView passes (420). Match both so the chunk-load swap
// doesn't add padding or jump the row.
function ChartSkeleton() {
  return <div className="h-[420px] w-full animate-pulse rounded-lg bg-muted" />;
}

export const LazyProjectionChart = dynamic(
  () => import("./projection-chart").then((m) => m.ProjectionChart),
  { loading: () => <ChartSkeleton /> },
);
