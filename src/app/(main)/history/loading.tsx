export default function HistoryLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-9 w-56 rounded-lg bg-muted" />

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 w-8 rounded-md bg-muted/60" />
            ))}
          </div>
        </div>
        <div className="h-[250px] rounded-lg bg-muted/40" />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 w-8 rounded-md bg-muted/60" />
            ))}
          </div>
        </div>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
