import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px]" />
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>

      {/* Actions */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Net Worth Cards — full-bleed headline; mirror NetWorthCard internals
          (icon + label + value). No fixed height: content sizes the card like
          the real card so the text-shaped lines never overflow on mobile. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Primary: Net Worth — spans half the row on desktop, mirroring
            NetWorthCard's col-span-2 in a 4-col grid so loading.tsx doesn't
            snap from equal thirds to hero+two-narrow on reveal. */}
        <Card className="col-span-2 rounded-2xl">
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

      {/* Tier 2 — trend chart + heatmap footer (8) alongside the allocation rail (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <TrendChartSkeleton />
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4">
          {/* Allocation donut lives in the desktop rail only */}
          <div className="hidden lg:block">
            <ChartCardSkeleton />
          </div>
        </div>
      </div>

      {/* Mobile-only — the two donuts sit together below the lg breakpoint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      {/* Tier 3 — portfolio heatmap (8) alongside the currency donut (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        <div className="min-w-0 lg:col-span-8">
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
        </div>
        {/* Currency donut lives in the desktop rail only */}
        <div className="hidden min-w-0 lg:col-span-4 lg:block">
          <ChartCardSkeleton />
        </div>
      </div>

      {/* Tier 4 — accounts summary (matches AccountsSummarySkeleton) */}
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
