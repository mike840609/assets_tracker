import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-8 max-w-2xl lg:max-w-6xl pb-16">
      {/* Page title */}
      <Skeleton className="h-10 md:h-9 w-28 rounded-lg" />

      {/* 2×3 section grid — mirrors page.tsx layout exactly */}
      <div className="grid gap-8 lg:grid-cols-2 lg:auto-rows-min lg:items-start lg:gap-x-10 lg:gap-y-10">
        {/* Col 1 Row 1 — Preferences */}
        <div className="space-y-3 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-6 w-36" />
          <div className="rounded-xl border overflow-hidden">
            {/* Currency */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3.5 w-56" />
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[240px] rounded-lg" />
            </div>
            {/* Language */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[240px] rounded-lg" />
            </div>
            {/* Density */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3.5 w-44" />
              </div>
              <Skeleton className="h-9 w-full sm:w-40 rounded-lg" />
            </div>
            {/* Appearance / Theme */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-52" />
              </div>
              <Skeleton className="h-9 w-full sm:w-44 rounded-lg" />
            </div>
            {/* Color Schema */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="w-11 h-11 rounded-full" />
                ))}
              </div>
            </div>
            {/* Save footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-muted/20">
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-11 md:h-8 w-full sm:w-[150px] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Col 1 Row 2 — Synchronization */}
        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-xl border overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-64" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[150px] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Col 1 Row 3 — Version */}
        <div className="space-y-3 lg:col-start-1 lg:row-start-3">
          <Skeleton className="h-6 w-20" />
          <div className="rounded-xl border overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="rounded-md bg-muted/30 p-4 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
              <Skeleton className="h-4 w-28 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Col 2 Row 1 — Privacy & Security */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-6 w-44" />
          <div className="rounded-xl border overflow-hidden">
            {/* Summary row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b bg-muted/20 p-4">
              <div className="flex gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-5 w-28 rounded-full shrink-0" />
            </div>
            {/* Privacy mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="flex gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-52" />
                </div>
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[150px] rounded-lg" />
            </div>
            {/* Signed in */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="flex gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3.5 w-60" />
                </div>
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[150px] rounded-lg" />
            </div>
            {/* Export backup */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
              <div className="flex gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-56" />
                </div>
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[150px] rounded-lg" />
            </div>
            {/* Your data */}
            <div className="flex gap-3 p-4">
              <Skeleton className="size-8 rounded-lg shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3.5 w-72 max-w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Col 2 Row 2 — Data Management */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-2">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-xl border overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3.5 w-60" />
              </div>
              <Skeleton className="h-11 md:h-8 w-full sm:w-[200px] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Col 2 Row 3 — Add to Home Screen */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-3">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-xl border overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-44" />
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
        </div>
      </div>
    </div>
  );
}
