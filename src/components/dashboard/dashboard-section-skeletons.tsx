import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCardSkeleton() {
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

export function NetWorthSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
      <Card className="col-span-2 rounded-2xl">
        <CardContent className="flex h-full flex-col justify-center p-4 sm:p-6">
          <div className="mb-1.5 flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-20 sm:h-4" />
          </div>
          <Skeleton className="mt-1 h-7 w-40 max-w-full sm:h-8" />
          <Skeleton className="mt-3 h-6 w-28 rounded-full" />
        </CardContent>
      </Card>
      {[0, 1].map((index) => (
        <Card key={index} className="col-span-1 rounded-2xl">
          <CardContent className="flex h-full flex-col justify-center p-4 sm:p-6">
            <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
              <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm sm:h-4 sm:w-4" />
              <Skeleton className="h-3.5 w-16 sm:h-4" />
            </div>
            <Skeleton className="mt-1 h-5 w-24 max-w-full sm:h-6" />
            <Skeleton className="mt-3 h-1.5 w-full rounded-full sm:mt-4" />
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

export function WatchlistCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
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

export function PortfolioHeatmapSkeleton() {
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
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ConcentrationCardSkeleton() {
  return (
    <Card data-testid="portfolio-concentration-skeleton">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-start lg:justify-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3 w-32 max-w-[70%]" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountsSummarySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-3">
        {[...Array(4)].map((_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    </div>
  );
}
