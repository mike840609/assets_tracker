export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-40 rounded-lg bg-muted" />
      </div>

      {/* Actions bar */}
      <div className="h-12 rounded-xl bg-muted/60" />

      {/* Net worth card */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-10 w-48 rounded-lg bg-muted" />
        <div className="flex gap-6">
          <div className="h-6 w-32 rounded bg-muted/60" />
          <div className="h-6 w-32 rounded bg-muted/60" />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <div className="h-4 w-28 rounded bg-muted mb-4" />
          <div className="h-48 rounded-lg bg-muted/40" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <div className="h-4 w-28 rounded bg-muted mb-4" />
          <div className="h-48 rounded-lg bg-muted/40" />
        </div>
      </div>

      {/* Accounts table */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
        <div className="h-4 w-28 rounded bg-muted" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex justify-between items-center py-3 border-b border-border/30 last:border-0">
            <div className="h-4 w-36 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
