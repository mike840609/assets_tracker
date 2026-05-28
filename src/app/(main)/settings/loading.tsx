import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-10 max-w-2xl pb-16">
      <Skeleton className="h-10 md:h-9 w-28 rounded-lg" />

      {/* Preferences section */}
      <div className="space-y-3 w-full">
        <Skeleton className="h-6 w-36" />
        <div className="rounded-lg border overflow-hidden">
          {/* Currency row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[200px]" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          {/* Language row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[200px]" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          {/* Density row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
          {/* Color schema row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-44" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="w-11 h-11 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Synchronization section */}
      <div className="space-y-3 w-full">
        <Skeleton className="h-6 w-40" />
        <div className="rounded-lg border overflow-hidden">
          {/* Sync prices row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-9 w-full sm:w-[150px]" />
          </div>
          {/* Sync rates row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            <Skeleton className="h-9 w-full sm:w-[150px]" />
          </div>
        </div>
      </div>

      {/* Data management */}
      <div className="space-y-3 w-full">
        <Skeleton className="h-6 w-40" />
        <div className="rounded-lg border overflow-hidden">
          {/* Export row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-9 w-full sm:w-[200px]" />
          </div>
          {/* Import row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-9 w-full sm:w-[200px]" />
          </div>
        </div>
      </div>

      {/* Install app card */}
      <div className="space-y-3 w-full">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="rounded-lg border overflow-hidden p-4 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-full" />
          </div>
          <div className="space-y-2 bg-muted/30 p-4 rounded-md">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-5/6" />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <section className="space-y-3 w-full border-t pt-10">
        <Skeleton className="h-6 w-28" />
        <div className="border border-destructive/20 bg-destructive/5 rounded-lg overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-10 w-full sm:w-[200px]" />
          </div>
        </div>
      </section>
    </div>
  );
}
