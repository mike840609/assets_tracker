import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      <NetWorthCard summary={summary} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          snapshots={snapshots.map((s) => ({
            date: s.date.toISOString().split("T")[0],
            netWorth: Number(s.netWorth),
            totalAssets: Number(s.totalAssets),
            totalLiabilities: Number(s.totalLiabilities),
          }))}
        />
        <AllocationChart summary={summary} />
      </div>
      <AccountsSummary summary={summary} />
    </div>
  );
}
