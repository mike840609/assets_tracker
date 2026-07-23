import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      <header className="space-y-1">
        <Skeleton className="h-10 w-36 rounded-lg md:h-9" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-11 w-11 md:h-9 md:w-9" />
          <Skeleton className="h-11 w-20 md:h-9" />
          <Skeleton className="h-11 w-11 md:h-9 md:w-9" />
        </div>
        <Skeleton className="h-11 w-28 md:h-9" />
      </div>

      <div className="gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] md:items-start">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 p-4">
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 px-2 py-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="mx-auto h-3 w-7" />
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }).map((_, index) => (
              <div
                key={index}
                className="min-h-16 border-b border-r border-border/50 p-2 last:border-r-0 sm:min-h-20 md:min-h-24"
              >
                <Skeleton className="h-5 w-5 rounded-full" />
                {index % 4 === 0 && <Skeleton className="mt-2 h-2.5 w-full" />}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/50 bg-card p-4 md:mt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-9 w-9" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg bg-muted/30 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
