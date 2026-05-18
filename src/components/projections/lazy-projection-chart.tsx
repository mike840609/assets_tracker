"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";

function ChartSkeleton() {
  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="p-4">
        <div className="h-[320px] bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export const LazyProjectionChart = dynamic(
  () => import("./projection-chart").then((m) => m.ProjectionChart),
  { loading: () => <ChartSkeleton /> },
);
