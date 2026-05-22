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

      {/* Preferences section */}
      <div className="space-y-3 w-full">
        <div className="h-6 w-36 rounded skeleton-shimmer" />
        <div className="rounded-lg border overflow-hidden">
          {/* Currency row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-[200px] rounded-md skeleton-shimmer" />
              <div className="h-9 w-16 rounded-md skeleton-shimmer" />
            </div>
          </div>
          {/* Language row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <div className="h-4 w-24 rounded skeleton-shimmer" />
              <div className="h-3.5 w-48 rounded skeleton-shimmer" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-[200px] rounded-md skeleton-shimmer" />
              <div className="h-9 w-16 rounded-md skeleton-shimmer" />
            </div>
          </div>
          {/* Density row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <div className="h-4 w-20 rounded skeleton-shimmer" />
              <div className="h-3.5 w-40 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-40 rounded-lg skeleton-shimmer" />
          </div>
          {/* Color schema row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <div className="h-4 w-24 rounded skeleton-shimmer" />
              <div className="h-3.5 w-44 rounded skeleton-shimmer" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-10 h-10 rounded-full skeleton-shimmer" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Synchronization section */}
      <div className="space-y-3 w-full">
        <div className="h-6 w-40 rounded skeleton-shimmer" />
        <div className="rounded-lg border overflow-hidden">
          {/* Sync prices row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-3.5 w-56 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-full sm:w-[150px] rounded-md skeleton-shimmer" />
          </div>
          {/* Sync rates row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <div className="h-4 w-36 rounded skeleton-shimmer" />
              <div className="h-3.5 w-52 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-full sm:w-[150px] rounded-md skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Data management */}
      <div className="space-y-3 w-full">
        <div className="h-6 w-40 rounded skeleton-shimmer" />
        <div className="rounded-lg border overflow-hidden">
          {/* Export row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <div className="h-4 w-20 rounded skeleton-shimmer" />
              <div className="h-3.5 w-64 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-full sm:w-[200px] rounded-md skeleton-shimmer" />
          </div>
          {/* Import row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <div className="h-4 w-20 rounded skeleton-shimmer" />
              <div className="h-3.5 w-64 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-full sm:w-[200px] rounded-md skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Install app card */}
      <div className="space-y-3 w-full">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded skeleton-shimmer" />
          <div className="h-6 w-36 rounded skeleton-shimmer" />
        </div>
        <div className="rounded-lg border overflow-hidden p-4 space-y-4">
          <div className="space-y-1">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            <div className="h-3.5 w-full rounded skeleton-shimmer" />
          </div>
          <div className="space-y-2 bg-muted/30 p-4 rounded-md">
            <div className="h-3.5 w-4/5 rounded skeleton-shimmer" />
            <div className="h-3.5 w-full rounded skeleton-shimmer" />
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <section className="space-y-3 w-full border-t pt-10">
        <div className="h-6 w-28 rounded skeleton-shimmer" />
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded skeleton-shimmer" />
              <div className="h-3.5 w-56 rounded skeleton-shimmer" />
            </div>
            <div className="h-10 w-full sm:w-[200px] rounded-md skeleton-shimmer" />
          </div>
        </div>
      </section>
    </div>
  );
}
