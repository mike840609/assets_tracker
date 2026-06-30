import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Route skeleton for /accounts. Mirrors the real layout: the page title over the
 * AccountsList shell (net-worth headline + actions, the portfolio heatmap card,
 * then the desktop table / mobile grouped lists). Holding both the lg table and
 * the mobile list keeps the skeleton→content swap from shifting at any width.
 */
export default function AccountsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 w-32 rounded-lg md:h-9" />

      {/* AccountsList shell (space-y-6 md:space-y-8) */}
      <div className="space-y-6 md:space-y-8">
        {/* Net-worth headline + actions */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:border-b md:border-border/60 md:pb-6">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-48 rounded-lg md:h-10" />
          </div>
          <div className="flex items-center gap-2">
            {/* Add Holding + Manage are desktop-only; Add Account always shows */}
            <Skeleton className="hidden h-9 w-28 md:block" />
            <Skeleton className="hidden h-9 w-32 md:block" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Portfolio heatmap card (treemap + desktop legend column) */}
        <Card>
          <CardHeader className="pb-0">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
              <Skeleton className="h-[240px] sm:h-[280px]" />
              <div className="hidden space-y-2 lg:block">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border lg:block">
          <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-3">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-3" style={{ flex: i === 0 ? 2 : 1 }} />
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0"
            >
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-4" style={{ flex: j === 0 ? 2 : 1 }} />
              ))}
            </div>
          ))}
        </div>

        {/* Mobile summary strip + quick actions + grouped lists */}
        <div className="lg:hidden">
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/50 p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24 max-w-full" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
          </div>

          <div className="space-y-6">
            {[0, 1].map((section) => (
              <div key={section}>
                <Skeleton className="mb-3 h-3 w-16" />
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl border">
                  {[...Array(section === 0 ? 3 : 1)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
