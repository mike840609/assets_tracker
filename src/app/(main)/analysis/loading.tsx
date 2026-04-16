export default function AnalysisLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-9 w-56 rounded-lg bg-muted" />

      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 w-10 rounded-md bg-muted/60" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/40" />
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="h-4 w-40 rounded bg-muted mb-4" />
        <div className="h-[280px] rounded-lg bg-muted/40" />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="h-4 w-40 rounded bg-muted mb-4" />
        <div className="h-[280px] rounded-lg bg-muted/40" />
      </div>
    </div>
  );
}
