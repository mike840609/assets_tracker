import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
      </div>

      {/* Actions skeleton */}
      <div className="h-10 w-full rounded-lg skeleton-shimmer" />

      {/* Net Worth Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 w-24 rounded mb-2 skeleton-shimmer" />
              <div className="h-8 w-36 rounded skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-5 w-32 rounded skeleton-shimmer" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] rounded skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accounts summary skeleton */}
      <Card>
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
  );
}
