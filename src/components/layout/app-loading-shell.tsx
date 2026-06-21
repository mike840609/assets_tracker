import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLoadingShell({ children }: { children?: ReactNode }) {
  return (
    <div
      data-app-loading-shell="true"
      aria-hidden="true"
      className="flex min-h-full w-full flex-1 flex-col bg-background"
    >
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 md:hidden">
        <Skeleton className="h-6 w-36 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {children ?? (
          <div className="space-y-4">
            <div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>
              <Skeleton className="h-10 w-48 rounded-lg" />
            </div>
            <div className="skeleton-stagger" style={{ "--i": 1 } as React.CSSProperties}>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div
              className="skeleton-stagger grid grid-cols-2 gap-3"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <Skeleton className="col-span-2 h-32 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
