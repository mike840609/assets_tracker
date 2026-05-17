export default function ProjectionsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-40 rounded-lg skeleton-shimmer" />

      {/* KPI tiles */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
        ))}
      </div>

      {/* Projection chart */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="h-5 w-48 rounded mb-4 skeleton-shimmer" />
        <div className="h-[320px] rounded-lg skeleton-shimmer" />
      </div>

      {/* Inputs panel */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="h-5 w-40 rounded mb-2 skeleton-shimmer" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-28 rounded skeleton-shimmer" />
              <div className="h-10 rounded-md skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
