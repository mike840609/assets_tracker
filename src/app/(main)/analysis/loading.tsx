import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ChartSkeleton({ height }: { height: number }) {
  return (
    <Card>
      <div className="pb-2 px-2 sm:px-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="px-2 sm:px-4 pb-4">
        <Skeleton style={{ height }} />
      </div>
    </Card>
  );
}

export default function AnalysisLoading() {
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
        <div className="sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2 md:-mx-2 md:px-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="inline-flex gap-1 rounded-full p-1 ring-1 ring-border/50">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-10 sm:h-6 sm:w-9" />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Lead balance-sheet chart with integrated KPI rail */}
          <Card className="!py-0">
            <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
              <div className="min-w-0 py-4">
                <div className="pb-2 px-2 sm:px-4">
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="px-2 sm:px-4 pb-4">
                  <Skeleton style={{ height: 180 }} />
                </div>
              </div>
              <div className="min-w-0 border-t border-border/60 bg-muted/20 px-4 py-4 xl:border-t-0 xl:border-l xl:bg-muted/25">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-7 w-40 max-w-full" />
                  </div>
                  <div>
                    <Skeleton className="mb-1.5 h-3 w-32" />
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-3 border-t border-border/60 py-2"
                      >
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-20 max-w-full" />
                          {i !== 0 && <Skeleton className="h-3 w-12" />}
                        </div>
                        <Skeleton className="ml-auto h-5 w-28 max-w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Secondary charts — equal cards below the lead chart */}
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartSkeleton height={200} />
            <ChartSkeleton height={200} />
            <ChartSkeleton height={200} />
            <ChartSkeleton height={200} />
          </div>

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
