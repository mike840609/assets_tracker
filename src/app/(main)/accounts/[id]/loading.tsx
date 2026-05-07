export default function AccountDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-muted/60" />
        <div className="h-8 w-48 rounded-lg bg-muted" />
      </div>

      {/* Account card */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted/60" />
            <div className="h-8 w-36 rounded-lg bg-muted" />
          </div>
          <div className="h-6 w-16 rounded-full bg-muted/60" />
        </div>

        {/* Holdings table */}
        <div className="mt-4 space-y-3">
          <div className="h-4 w-20 rounded bg-muted" />
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-3 border-b border-border/30 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-14 rounded bg-muted/50" />
                <div className="h-4 w-28 rounded bg-muted/40" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-muted/40" />
                <div className="h-4 w-20 rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
