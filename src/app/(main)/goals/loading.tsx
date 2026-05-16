export default function GoalsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted/60" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 rounded bg-muted/60" />
                <div className="h-8 w-16 rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/60" />
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-muted/60" />
              <div className="h-4 w-12 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
