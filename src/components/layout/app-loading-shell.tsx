import type { ReactNode } from "react";

export function AppLoadingShell({ children }: { children?: ReactNode }) {
  return (
    <div
      data-app-loading-shell="true"
      aria-hidden="true"
      className="flex min-h-full w-full flex-1 flex-col bg-background"
    >
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 md:hidden">
        <div className="h-6 w-36 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="size-10 animate-pulse rounded-md bg-muted" />
          <div className="size-10 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {children ?? (
          <div className="space-y-4">
            <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 h-32 animate-pulse rounded-2xl bg-muted" />
              <div className="h-28 animate-pulse rounded-2xl bg-muted" />
              <div className="h-28 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
