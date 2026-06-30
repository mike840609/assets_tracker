import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Route skeleton for /stocks. Mirrors the real layout: a title + subtitle block
 * over the StockTrackerView shell (tracked-count toolbar that stacks on mobile,
 * then the watchlist rows). Each row card carries both the desktop single-row
 * grid and the mobile stacked layout so the skeleton→content swap never shifts.
 */
export default function StocksLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title block — matches LargeTitleHeading (text-4xl md:text-3xl) + subtitle */}
      <div>
        <Skeleton className="h-10 w-36 rounded-lg md:h-9" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      {/* StockTrackerView shell (space-y-4) */}
      <div className="space-y-4">
        {/* Toolbar — stacks on mobile, row on desktop (mirrors the view) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 flex-1 sm:flex-none" />
            <Skeleton className="h-9 w-24 flex-1 sm:flex-none" />
          </div>
        </div>

        {/* Watchlist rows */}
        <div className="space-y-3 md:space-y-2">
          {[0, 1, 2].map((item) => (
            <Card key={item} size="sm" className="md:py-2">
              <CardContent className="space-y-3 md:px-3">
                {/* Desktop single-row grid */}
                <div className="hidden items-center gap-5 md:grid md:grid-cols-[minmax(180px,1.5fr)_minmax(280px,1.3fr)_minmax(116px,auto)_1.75rem]">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-5 w-44 max-w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5 justify-self-end">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="h-7 w-7 justify-self-end" />
                </div>

                {/* Mobile stacked layout */}
                <div className="flex flex-col gap-3.5 md:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-40 max-w-full" />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Skeleton className="h-7 w-24 rounded-full" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-7 w-7 shrink-0" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
