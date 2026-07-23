import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountsSummarySkeleton,
  ChartCardSkeleton,
  ConcentrationCardSkeleton,
  NetWorthSkeleton,
  PortfolioHeatmapSkeleton,
  WatchlistCardSkeleton,
} from "@/components/dashboard/dashboard-section-skeletons";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";

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

      <div data-testid="dashboard-portfolio-disclosure-skeleton" className="space-y-4 md:space-y-8">
        <Skeleton className="h-11 w-full rounded-xl md:hidden" />
        <div className="hidden space-y-4 md:block md:space-y-8">
          <div className="space-y-3 sm:space-y-6">
            <div
              data-testid="portfolio-overview-skeleton"
              className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12"
            >
              <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
                <ChartCardSkeleton />
                <ChartCardSkeleton />
              </div>
              <div className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:contain-size lg:[&>*]:min-h-0 lg:[&>*]:flex-1">
                <PortfolioHeatmapSkeleton />
              </div>
            </div>
            <ConcentrationCardSkeleton />
          </div>
          <AccountsSummarySkeleton />
        </div>
      </div>
    </div>
  );
}
