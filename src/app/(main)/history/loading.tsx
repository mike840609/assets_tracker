import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title row — matches LargeTitleHeading (text-4xl md:text-3xl) + meta */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Skeleton className="h-10 md:h-9 w-44 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      {/* Hero row — trend (8) + rail (4): summary over daily change.
          Trend card capped at 420px (lg) and row top-aligned, mirroring HistoryView. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 lg:h-[420px] bg-card border border-border/50 rounded-xl shadow-sm">
          <div className="flex h-full flex-col px-4 pt-4 pb-2 gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="flex-1 min-h-[200px] rounded-lg" />
            <Skeleton className="h-[88px] rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:gap-6 lg:col-span-4">
          <div className="bg-card border border-border/50 rounded-xl shadow-sm">
            <div className="p-4 space-y-4">
              <Skeleton className="h-5 w-24" />
              {/* Lead block: large current value + supporting line */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="h-px bg-border/60" />
              {/* Demoted secondary grid: 6 two-line stats + a full-width tally */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
                <div className="col-span-2 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 bg-card border border-border/50 rounded-xl shadow-sm">
            <div className="px-4 pt-4 pb-4 space-y-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-[130px] rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* History ledger: title row + a month-grouped card (mirrors HistoryTable) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3 w-28" />
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-border/40 last:border-b-0">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
