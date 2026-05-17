export default function SettingsLoading() {
  return (
    <div className="space-y-10 max-w-2xl pb-16">
      {/* Title + app philosophy blurb */}
      <div className="flex flex-col space-y-4">
        <div className="h-10 md:h-9 w-28 rounded-lg skeleton-shimmer" />
        <div className="bg-muted/50 p-4 rounded-lg border w-full space-y-2">
          <div className="h-4 w-32 rounded skeleton-shimmer" />
          <div className="h-3.5 w-full rounded skeleton-shimmer" />
          <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* Settings form */}
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded-md skeleton-shimmer" />
          </div>
        ))}
        <div className="h-9 w-24 rounded-md skeleton-shimmer" />
      </div>

      {/* Data management */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="h-3.5 w-full rounded skeleton-shimmer" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-md skeleton-shimmer" />
          <div className="h-9 w-28 rounded-md skeleton-shimmer" />
        </div>
      </div>

      {/* Install app card */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
        <div className="h-5 w-36 rounded skeleton-shimmer" />
        <div className="h-3.5 w-full rounded skeleton-shimmer" />
        <div className="h-9 w-32 rounded-md skeleton-shimmer" />
      </div>

      {/* Danger zone */}
      <section className="space-y-3 w-full border-t pt-10">
        <div className="h-5 w-28 rounded skeleton-shimmer" />
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-4 w-24 rounded skeleton-shimmer" />
            <div className="h-3.5 w-56 rounded skeleton-shimmer" />
          </div>
          <div className="h-10 w-full sm:w-[200px] rounded-md skeleton-shimmer" />
        </div>
      </section>
    </div>
  );
}
