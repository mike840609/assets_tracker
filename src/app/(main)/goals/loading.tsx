import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <Skeleton className="h-10 md:h-9 w-24 rounded-lg" />

      <div className="space-y-4">
        {/* Mobile-only tab switcher — mirrors GoalsView's underline tabs */}
        <div className="md:hidden flex border-b">
          <div className="px-4 pb-2 -mb-px border-b-2 border-primary">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="px-4 pb-2">
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="px-4 pb-2">
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Subtitle + Add button (size="sm" → h-7) */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>

          {/* Goal cards — mirror GoalCard (icon + title, square actions, progress, meta) */}
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border border-border/50 bg-card shadow-sm rounded-xl">
                <CardContent className="p-5 space-y-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="space-y-1.5 min-w-0">
                        <Skeleton className="h-4 w-40 max-w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Skeleton className="h-9 w-9 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </div>

                  {/* Progress section */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-2.5 w-full rounded-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>

                  {/* Metadata row */}
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
