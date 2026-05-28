import { Skeleton } from "@/components/ui/skeleton";

export default function AccountDetailLoading() {
  return (
    <div className="md:flex md:gap-6 md:items-start">
      {/* Nav panel — desktop only, mirrors AccountsNavPanel (w-44 xl:w-52) */}
      <aside className="hidden md:flex flex-col w-44 xl:w-52 shrink-0 gap-2 pt-0.5">
        <Skeleton className="h-3 w-16 mx-2 mb-1" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
        <Skeleton className="h-3 w-20 mx-2 mt-3 mb-1" />
        {[...Array(2)].map((_, i) => (
          <Skeleton key={`l-${i}`} className="h-8 w-full rounded-lg" />
        ))}
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        {/* Header: back button + account name */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-10 md:h-9 w-48 rounded-lg" />
        </div>

        {/* Account summary card */}
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Holdings table */}
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
