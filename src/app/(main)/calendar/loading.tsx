import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
        <section className="min-w-0">
          <Skeleton className="mb-3 h-7 w-36" />
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="px-1 py-2">
                  <Skeleton className="mx-auto h-3 w-7" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: 6 }).map((_, weekIndex) => (
                <div key={weekIndex} className="contents">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const index = weekIndex * 7 + dayIndex;
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "min-w-0",
                          dayIndex !== 6 && "border-r",
                          weekIndex !== 5 && "border-b",
                        )}
                      >
                        <div className="flex min-h-16 w-full flex-col items-center gap-1 px-1.5 py-2 text-center sm:min-h-20 sm:items-start sm:text-left">
                          <Skeleton className="size-6 rounded-full" />
                          {index % 4 === 0 && <Skeleton className="mt-auto h-3 w-8 rounded-full" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

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
