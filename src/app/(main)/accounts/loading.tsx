import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <Skeleton className="h-10 md:h-9 w-32 rounded-lg" />
      </div>

      {/* Toolbar */}
      <div
        className="skeleton-stagger flex items-center justify-between"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        <div className="skeleton-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          <Skeleton className="h-5 w-16" />
        </div>

        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="skeleton-stagger rounded-xl border border-border/50 overflow-hidden"
            style={{ "--i": 3 + i } as React.CSSProperties}
          >
            <div className="px-5 py-4 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>

            <div className="px-4 py-4 space-y-3 bg-background/50">
              {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                <div key={j} className="rounded-lg border border-border/40 p-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  {i !== 0 && (
                    <div className="mt-3 space-y-2">
                      {[...Array(2)].map((_, k) => (
                        <div
                          key={k}
                          className="flex justify-between py-1.5 border-t border-border/30 first:border-0"
                        >
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3.5 w-16" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
