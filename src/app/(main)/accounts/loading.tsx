export default function AccountsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-32 rounded-lg skeleton-shimmer" />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded skeleton-shimmer" />
          <div className="h-4 w-20 rounded skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-md skeleton-shimmer" />
          <div className="h-9 w-28 rounded-md skeleton-shimmer" />
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        <div className="h-5 w-16 rounded skeleton-shimmer" />

        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded skeleton-shimmer" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 rounded skeleton-shimmer" />
                  <div className="h-3 w-32 rounded skeleton-shimmer" />
                </div>
              </div>
              <div className="h-4 w-20 rounded skeleton-shimmer" />
            </div>

            <div className="px-4 py-4 space-y-3 bg-background/50">
              {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                <div key={j} className="rounded-lg border border-border/40 p-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-32 rounded skeleton-shimmer" />
                    <div className="h-6 w-24 rounded skeleton-shimmer" />
                  </div>
                  {i !== 0 && (
                    <div className="mt-3 space-y-2">
                      {[...Array(2)].map((_, k) => (
                        <div
                          key={k}
                          className="flex justify-between py-1.5 border-t border-border/30 first:border-0"
                        >
                          <div className="h-3.5 w-28 rounded skeleton-shimmer" />
                          <div className="h-3.5 w-16 rounded skeleton-shimmer" />
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
