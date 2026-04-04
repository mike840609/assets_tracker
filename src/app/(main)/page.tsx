import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { getNetWorthSummary } from "@/lib/services/net-worth-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let settings = await prisma.setting.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.setting.create({ data: { userId, baseCurrency: "USD" } });
  }
  const baseCurrency = settings.baseCurrency;
  const summary = await getNetWorthSummary(userId, baseCurrency);
  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId, baseCurrency },
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
        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
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
        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
          <AllocationChart summary={summary} />
        </div>
      </div>

      <div className="animate-slide-in-bottom delay-300 duration-500 bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
        <AccountsSummary summary={summary} />
      </div>
    </div>
  );
}
