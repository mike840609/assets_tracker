import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function StocksLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} size="sm">
            <CardContent className="space-y-3">
              <div className="flex justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-7 w-7" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {[0, 1, 2, 3].map((cell) => (
                  <Skeleton key={cell} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
