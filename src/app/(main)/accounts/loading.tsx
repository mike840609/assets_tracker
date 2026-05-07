export default function AccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-32 rounded-lg bg-muted" />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-muted/60" />
          <div className="h-4 w-20 rounded bg-muted/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-md bg-muted/60" />
          <div className="h-9 w-28 rounded-md bg-muted" />
        </div>
      </div>

      {/* Assets section */}
      <div className="space-y-3">
        <div className="h-5 w-16 rounded bg-green-200/50 dark:bg-green-800/30" />

        {/* Category sections */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
            {/* Category header */}
            <div className="px-5 py-4 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-muted/50" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 rounded bg-muted/60" />
                  <div className="h-3 w-32 rounded bg-muted/40" />
                </div>
              </div>
              <div className="h-4 w-20 rounded bg-muted/50" />
            </div>

            {/* Account cards */}
            <div className="px-4 py-4 space-y-3 bg-background/50">
              {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                <div key={j} className="rounded-lg border border-border/40 p-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-32 rounded bg-muted/50" />
                    <div className="h-6 w-24 rounded bg-muted/50" />
                  </div>
                  {i !== 0 && (
                    <div className="mt-3 space-y-2">
                      {[...Array(2)].map((_, k) => (
                        <div
                          key={k}
                          className="flex justify-between py-1.5 border-t border-border/30 first:border-0"
                        >
                          <div className="h-3.5 w-28 rounded bg-muted/40" />
                          <div className="h-3.5 w-16 rounded bg-muted/40" />
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
