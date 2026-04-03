import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { getNetWorthSummary } from "@/lib/services/net-worth-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await prisma.setting.findFirst();
  const baseCurrency = settings?.baseCurrency ?? "USD";
  const summary = await getNetWorthSummary(baseCurrency);
  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { baseCurrency },
    orderBy: { date: "asc" },
  });

  // Get latest price update timestamp
  const latestPrice = await prisma.priceCache.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  // Get latest snapshot date
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-slide-in-bottom">
          Dashboard
        </h2>
      </div>

      <div className="animate-slide-in-bottom delay-50">
        <DashboardActions
          baseCurrency={baseCurrency}
          lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
          lastSnapshotDate={latestSnapshot?.date?.toISOString() ?? null}
        />
      </div>
      
      <div className="animate-slide-in-bottom delay-100">
        <NetWorthCard summary={summary} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-in-bottom delay-200 duration-500">
        <div className="glass rounded-xl p-1 card-gradient transition-all hover:shadow-lg">
          <TrendChart
            baseCurrency={baseCurrency}
            snapshots={snapshots.map((s) => ({
              date: s.date.toISOString().split("T")[0],
              netWorth: Number(s.netWorth),
              totalAssets: Number(s.totalAssets),
              totalLiabilities: Number(s.totalLiabilities),
            }))}
          />
        </div>
        <div className="glass rounded-xl p-1 card-gradient transition-all hover:shadow-lg">
          <AllocationChart summary={summary} />
        </div>
      </div>
      
      <div className="animate-slide-in-bottom delay-300 duration-500 glass rounded-xl p-1 card-gradient transition-all hover:shadow-lg">
        <AccountsSummary summary={summary} />
      </div>
    </div>
  );
}
