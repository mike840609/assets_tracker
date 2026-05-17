export default function AnalysisLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-32 rounded-lg skeleton-shimmer" />

      {/* Range / density toolbar */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded skeleton-shimmer" />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-7 w-10 rounded-md skeleton-shimmer" />
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
        ))}
      </div>

      {/* Charts stack */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 bg-card p-6">
          <div className="h-5 w-40 rounded mb-4 skeleton-shimmer" />
          <div className="h-[280px] rounded-lg skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
