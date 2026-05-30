import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>

      {/* Actions */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Net Worth Cards — mirror NetWorthCard internals (icon + label + value).
          No fixed height: content sizes the card just like the real card, so
          the text-shaped lines never overflow the box on mobile. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Primary: Net Worth */}
        <Card className="col-span-2 lg:col-span-1 rounded-2xl">
          <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2.5 mb-1.5">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-3.5 sm:h-4 w-20" />
            </div>
            <Skeleton className="h-7 sm:h-8 w-40 max-w-full mt-1" />
            <Skeleton className="h-6 w-28 rounded-full mt-3" />
          </CardContent>
        </Card>
        {/* Secondary: Assets + Liabilities */}
        {[0, 1].map((i) => (
          <Card key={i} className="col-span-1 rounded-2xl">
            <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-sm shrink-0" />
                <Skeleton className="h-3.5 sm:h-4 w-16" />
              </div>
              <Skeleton className="h-5 sm:h-6 w-24 max-w-full mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart + heatmap footer */}
      <TrendChartSkeleton />

      {/* Allocation + currency exposure charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
            <Skeleton className="h-[240px] sm:h-[280px]" />
            <div className="hidden space-y-3 lg:block">
              <Skeleton className="h-24" />
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts summary — matches AccountsSummarySkeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
