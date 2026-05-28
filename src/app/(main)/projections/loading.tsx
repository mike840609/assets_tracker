import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectionsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 md:h-9 w-40 rounded-lg" />

      {/* KPI tiles */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Projection chart */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-[320px] rounded-lg" />
      </div>

      {/* Inputs panel */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-40 mb-2" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
