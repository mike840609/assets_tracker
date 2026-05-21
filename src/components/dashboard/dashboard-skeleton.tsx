const SURFACE = "rounded-xl border border-border/40 bg-card p-4 sm:p-5";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
      </div>

      {/* Actions */}
      <div className="h-10 w-full rounded-lg skeleton-shimmer" />

      {/* Net Worth hero — matches NetWorthSkeleton in dashboard-content.tsx */}
      <section className="py-5 sm:py-7">
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <div className="mt-2 h-12 sm:h-16 w-64 sm:w-80 rounded skeleton-shimmer" />
        <div className="mt-3 h-7 w-40 rounded-full skeleton-shimmer" />
        <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-2 gap-x-8 gap-y-3">
          <div className="space-y-2">
            <div className="h-3 w-16 rounded skeleton-shimmer" />
            <div className="h-7 w-28 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 rounded skeleton-shimmer" />
            <div className="h-7 w-28 rounded skeleton-shimmer" />
          </div>
        </div>
      </section>

      {/* Charts — 1st = trend (taller, lg col-span-2 xl col-span-1), 2nd + 3rd = h-250 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 items-stretch">
        <section className={`${SURFACE} lg:col-span-2 xl:col-span-1`}>
          <div className="h-5 w-32 rounded skeleton-shimmer mb-3" />
          <div className="h-[350px] rounded skeleton-shimmer" />
        </section>
        {[0, 1].map((i) => (
          <section key={i} className={SURFACE}>
            <div className="h-5 w-32 rounded skeleton-shimmer mb-3" />
            <div className="h-[250px] rounded skeleton-shimmer" />
          </section>
        ))}
      </div>

      {/* Accounts summary — matches AccountsSummarySkeleton */}
      <section className={SURFACE}>
        <div className="h-5 w-40 rounded skeleton-shimmer mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded skeleton-shimmer" />
          ))}
        </div>
      </section>
    </div>
  );
}
