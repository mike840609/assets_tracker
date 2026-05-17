export default function GoalsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-24 rounded-lg skeleton-shimmer" />

      <div className="space-y-4">
        {/* Mobile-only tab switcher */}
        <div className="md:hidden flex border-b gap-6 pb-2">
          <div className="h-4 w-12 rounded skeleton-shimmer" />
          <div className="h-4 w-20 rounded skeleton-shimmer" />
        </div>

        {/* Subtitle + Add button (from GoalsView) */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-48 rounded skeleton-shimmer" />
          <div className="h-9 w-28 rounded-md skeleton-shimmer" />
        </div>

        {/* Goal cards */}
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded skeleton-shimmer" />
                  <div className="h-4 w-24 rounded skeleton-shimmer" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-16 rounded skeleton-shimmer" />
                  <div className="h-8 w-16 rounded skeleton-shimmer" />
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full skeleton-shimmer" />
              <div className="flex justify-between">
                <div className="h-4 w-32 rounded skeleton-shimmer" />
                <div className="h-4 w-12 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
