import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalysisLoading() {
  const chartHeights = [280, 280, 280, 200, 280];

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 md:h-9 w-32 rounded-lg" />

      <div className="space-y-4">
        {/* Mobile-only tab switcher */}
        <div className="md:hidden flex border-b">
          <div className="h-8 w-24 border-b-2 border-primary px-4 pb-2">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="h-8 w-24 px-4 pb-2">
            <Skeleton className="h-4 w-14" />
          </div>
        </div>

        {/* Sticky freshness + range selector */}
        <div className="sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="inline-flex gap-1 rounded-full p-1">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-10 sm:h-6 sm:w-9" />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* KPI tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} size="sm">
                <div className="px-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-36" />
                  {i < 2 && <Skeleton className="h-3 w-20" />}
                </div>
              </Card>
            ))}
          </div>

          {/* Charts stack — mirrors the shadcn Card + lazy chart skeletons */}
          {chartHeights.map((height, i) => (
            <Card key={i}>
              <div className="pb-2 px-2 sm:px-4">
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="px-2 sm:px-4 pb-4">
                <Skeleton style={{ height }} />
              </div>
            </Card>
          ))}

          {/* Top movers list — card with horizontally scrollable table rows */}
          <Card>
            <div className="px-6 pt-2 pb-2">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <div className="px-6 pb-2 overflow-hidden">
              <div className="min-w-[520px] space-y-3">
                <div className="grid grid-cols-[1fr_5rem_5rem_6rem] gap-4 border-b border-border/60 pb-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-3" />
                  ))}
                </div>
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_5rem_5rem_6rem] items-center gap-4 border-b border-border/40 pb-3 last:border-0"
                  >
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4" />
                    <Skeleton className="h-4" />
                    <Skeleton className="ml-auto h-6 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
