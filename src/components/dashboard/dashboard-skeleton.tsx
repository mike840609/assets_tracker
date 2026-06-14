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

/** Net worth cards — mirrors NetWorthSkeleton in dashboard-content so the route
 *  skeleton and the streaming fallback are identical (no jump on reveal). */
function NetWorthSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {/* Primary: Net Worth — spans half the row, mirroring NetWorthCard's
          col-span-2 in a 4-col grid. */}
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
      {/* Secondary: Assets + Liabilities (with share bar + labels) */}
      {[0, 1].map((i) => (
        <Card key={i} className="col-span-1 rounded-2xl">
          <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-sm shrink-0" />
              <Skeleton className="h-3.5 sm:h-4 w-16" />
            </div>
            <Skeleton className="h-5 sm:h-6 w-24 max-w-full mt-1" />
            <Skeleton className="h-1.5 w-full rounded-full mt-3 sm:mt-4" />
            <div className="mt-1.5 flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Planning rail card — GoalsMilestoneCard / ProjectionEntryCard shape:
 *  header (icon + title + view-all) over a goal name, progress bar, and bounds. */
function GoalsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Watchlist rail card — header + three quote rows (symbol/name + change pill). */
function WatchlistCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-t border-border/50 py-2.5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-28 max-w-full" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Portfolio treemap — wide chart beside a desktop-only legend column. */
function PortfolioHeatmapSkeleton() {
  return (
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
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-10 w-48 rounded-lg md:h-9" />
      </div>

      {/* Actions bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Net worth cards */}
      <NetWorthSkeleton />

      {/* Tier 2 — trend chart + heatmap footer (8) beside the planning rail (4):
          goals/projection card over the watchlist card. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <TrendChartSkeleton />
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4">
          <GoalsCardSkeleton />
          <WatchlistCardSkeleton />
        </div>
      </div>

      {/* Tier 3 — portfolio treemap (8) beside the stacked allocation + currency
          donut rail (4). Source order puts the donuts first so the phone reading
          order (allocation → currency → treemap) is preserved; on desktop the
          col-start values place the treemap left and the donuts right. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
        <div className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1 [&>*]:min-h-0 [&>*]:flex-1">
          <PortfolioHeatmapSkeleton />
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
