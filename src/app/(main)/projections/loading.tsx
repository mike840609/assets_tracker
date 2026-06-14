import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route skeleton for /projections. Mirrors the real layout in
 * `ProjectionView`: header row (subtitle + value-lens control), the full-width
 * verdict band, the cockpit row (assumptions rail + projection chart), the
 * milestones timeline, and the collapsed "how it works" guide. Card chrome
 * matches `Card` (`rounded-xl bg-card ring-1 ring-foreground/10`) so the boxes
 * land in the same place once content streams in.
 */
export default function ProjectionsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 w-44 rounded-lg md:h-9" />

      <div className="space-y-4 lg:space-y-6">
        {/* Header row: subtitle + value-lens segmented control */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-64 max-w-full rounded" />
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Skeleton className="h-7 w-40 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>

        {/* Verdict band (full width) */}
        <div className="rounded-2xl bg-card py-5 ring-1 ring-foreground/10 sm:py-6">
          <div className="grid gap-6 px-5 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-8 w-3/4 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <div className="space-y-2 pt-1">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-10 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1.5 lg:border-l lg:border-border/60 lg:pl-6">
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="h-7 w-32 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          </div>
        </div>

        {/* Cockpit: assumptions rail + projection chart */}
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Assumptions rail (below the chart on mobile, left on desktop) */}
          <aside className="order-last lg:order-none">
            <div className="rounded-xl bg-card py-4 ring-1 ring-foreground/10">
              <div className="space-y-4 px-4">
                <Skeleton className="h-4 w-28 rounded" />
                <div className="space-y-5">
                  {/* 2 currency inputs */}
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`field-${i}`} className="space-y-1.5">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  ))}
                  {/* 3 sliders */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`slider-${i}`} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Skeleton className="h-3 w-24 rounded" />
                        <Skeleton className="h-3.5 w-10 rounded" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Chart */}
          <div className="min-w-0 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="space-y-4 px-4">
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="hidden h-3 w-48 rounded sm:block" />
              </div>
              <Skeleton className="h-[420px] w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Milestones timeline (full width) */}
        <div className="rounded-xl bg-card py-4 ring-1 ring-foreground/10">
          <div className="space-y-5 px-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-56 max-w-full rounded" />
            </div>
            <div className="flex pt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`ms-${i}`} className="flex flex-1 flex-col items-center gap-2 px-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3 w-12 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Collapsible guide (collapsed state) */}
        <div className="rounded-xl bg-muted/30 ring-1 ring-border/50">
          <div className="flex items-center justify-between px-6 py-4">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
