import { Card, CardContent, CardHeader } from "@/components/ui/card";

const CARD_CLASS = "premium-card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
      </div>

      {/* Actions */}
      <div className="h-10 w-full rounded-lg skeleton-shimmer" />

      {/* Net Worth Cards — matches NetWorthSkeleton in dashboard-content.tsx */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <Card className="col-span-2 lg:col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
        <Card className="col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
        <Card className="col-span-1 rounded-2xl h-[126px]">
          <CardContent className="h-full rounded-2xl skeleton-shimmer" />
        </Card>
      </div>

      {/* Charts — 1st = trend (taller, lg col-span-2 xl col-span-1), 2nd + 3rd = h-250 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 items-stretch">
        <div className={`${CARD_CLASS} lg:col-span-2 xl:col-span-1`}>
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="pb-2">
              <div className="h-5 w-32 rounded skeleton-shimmer" />
            </CardHeader>
            <CardContent>
              <div className="h-[350px] rounded skeleton-shimmer" />
            </CardContent>
          </Card>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className={CARD_CLASS}>
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="pb-2">
                <div className="h-5 w-32 rounded skeleton-shimmer" />
              </CardHeader>
              <CardContent>
                <div className="h-[250px] rounded skeleton-shimmer" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Accounts summary — matches AccountsSummarySkeleton */}
      <div className={CARD_CLASS}>
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader>
            <div className="h-5 w-40 rounded skeleton-shimmer" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 rounded skeleton-shimmer" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
