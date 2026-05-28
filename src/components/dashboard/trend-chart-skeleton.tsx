import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TrendChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px]" />
      </CardContent>
      {/* Heatmap footer skeleton */}
      <div className="border-t border-border/40 px-4 pt-3 pb-4">
        <Skeleton className="h-3 w-48 mb-2 ml-6" />
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="w-4 h-[10px] rounded-sm" />
            ))}
          </div>
          <div className="flex flex-col gap-1 overflow-hidden">
            {[...Array(7)].map((_, row) => (
              <div key={row} className="flex gap-1">
                {[...Array(44)].map((_, col) => (
                  <Skeleton key={col} className="w-[10px] h-[10px] shrink-0 rounded-[2px]" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
