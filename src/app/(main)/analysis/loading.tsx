export default function AnalysisLoading() {
  const chartHeights = [280, 280, 280, 200, 280];

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-32 rounded-lg skeleton-shimmer" />

      <div className="space-y-4">
        {/* Mobile-only tab switcher */}
        <div className="md:hidden flex border-b">
          <div className="h-8 w-24 border-b-2 border-primary px-4 pb-2">
            <div className="h-4 w-16 rounded skeleton-shimmer" />
          </div>
          <div className="h-8 w-24 px-4 pb-2">
            <div className="h-4 w-14 rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Sticky freshness + range selector */}
        <div className="sticky top-[env(safe-area-inset-top)] md:top-0 z-40 flex items-center justify-between gap-2 py-2">
          <div className="h-5 w-24 rounded-full skeleton-shimmer" />
          <div className="inline-flex gap-1 rounded-full p-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-10 rounded-md skeleton-shimmer sm:h-6 sm:w-9" />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* KPI tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
                <div className="h-3 w-24 rounded skeleton-shimmer" />
                <div className="h-7 w-36 rounded skeleton-shimmer" />
                {i < 2 && <div className="h-3 w-20 rounded skeleton-shimmer" />}
              </div>
            ))}
          </div>

          {/* Charts stack — mirrors premium-card + lazy chart skeletons */}
          {chartHeights.map((height, i) => (
            <div key={i} className="premium-card">
              <div className="border-0 bg-transparent shadow-none">
                <div className="pb-2 px-2 sm:px-4 pt-4">
                  <div className="h-5 w-40 rounded skeleton-shimmer" />
                </div>
                <div className="px-2 sm:px-4 pb-4">
                  <div className="rounded skeleton-shimmer" style={{ height }} />
                </div>
              </div>
            </div>
          ))}

          {/* Top movers list — card with horizontally scrollable table rows */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="px-6 pt-6 pb-2">
              <div className="h-5 w-32 rounded mb-2 skeleton-shimmer" />
              <div className="h-3 w-56 max-w-full rounded skeleton-shimmer" />
            </div>
            <div className="px-6 pb-6 overflow-hidden">
              <div className="min-w-[520px] space-y-3">
                <div className="grid grid-cols-[1fr_5rem_5rem_6rem] gap-4 border-b border-border/60 pb-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-3 rounded skeleton-shimmer" />
                  ))}
                </div>
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_5rem_5rem_6rem] items-center gap-4 border-b border-border/40 pb-3 last:border-0"
                  >
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded skeleton-shimmer" />
                      <div className="h-3 w-20 rounded skeleton-shimmer" />
                    </div>
                    <div className="h-4 rounded skeleton-shimmer" />
                    <div className="h-4 rounded skeleton-shimmer" />
                    <div className="ml-auto h-6 w-24 rounded-md skeleton-shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
