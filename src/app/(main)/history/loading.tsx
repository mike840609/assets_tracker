import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title row — matches LargeTitleHeading (text-4xl md:text-3xl) + meta */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Skeleton className="h-10 md:h-9 w-44 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      {/* Hero row — trend (8) + rail (4): summary over daily change */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 bg-card border border-border/50 rounded-xl shadow-sm">
          <div className="px-4 pt-4 pb-2 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[240px] rounded-lg" />
            <Skeleton className="h-[88px] rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:gap-6 lg:col-span-4">
          <div className="bg-card border border-border/50 rounded-xl shadow-sm">
            <div className="p-4 space-y-4">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 bg-card border border-border/50 rounded-xl shadow-sm">
            <div className="px-4 pt-4 pb-4 space-y-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-[180px] rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* History table card */}
      <div className="bg-card border border-border/50 rounded-xl p-1 card-gradient">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
