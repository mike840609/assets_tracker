import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
      </div>

      {/* Actions */}
      <div className="h-10 w-full rounded-lg skeleton-shimmer" />

      {/* Net Worth Cards — matches NetWorthSkeleton in dashboard-content.tsx */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <Card className="col-span-2 lg:col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
        <Card className="col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
        <Card className="col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
      </div>

      {/* Trend chart + heatmap footer */}
      <TrendChartSkeleton />

      {/* Allocation + currency exposure charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-5 w-32 rounded skeleton-shimmer" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] rounded skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accounts summary — matches AccountsSummarySkeleton */}
      <div className="space-y-3">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
