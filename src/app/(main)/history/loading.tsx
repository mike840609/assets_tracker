import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 md:h-9 w-28 rounded-lg" />

      {/* Trend chart card — matches TrendChart's own Card (no outer wrapper) */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm">
        <div className="px-4 pt-4 pb-2 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[240px] rounded-lg" />
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
