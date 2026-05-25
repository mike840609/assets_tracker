import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TrendChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-32 skeleton-shimmer rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] skeleton-shimmer rounded" />
      </CardContent>
      {/* Heatmap footer skeleton */}
      <div className="border-t border-border/40 px-4 pt-3 pb-4">
        <div className="h-3 w-48 skeleton-shimmer rounded mb-2 ml-6" />
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-4 h-[10px] skeleton-shimmer rounded-sm" />
            ))}
          </div>
          <div className="flex flex-col gap-1 overflow-hidden">
            {[...Array(7)].map((_, row) => (
              <div key={row} className="flex gap-1">
                {[...Array(44)].map((_, col) => (
                  <div
                    key={col}
                    className="w-[10px] h-[10px] shrink-0 skeleton-shimmer rounded-[2px]"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
