import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { LazyTrendChart, LazyAllocationChart } from "@/components/dashboard/lazy-charts";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { getNetWorthSummary } from "@/lib/services/net-worth-service";
import { redirect } from "next/navigation";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getNormalizedHistory } from "@/lib/services/history-service";
import { LazyCurrencyExposureChart } from "@/components/dashboard/lazy-charts";

export async function DashboardContent({ userId }: { userId: string }) {
  const [dbUser, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getOrCreateSettings(userId),
  ]);

  if (!dbUser) redirect("/api/auth/signout");

  const baseCurrency = settings.baseCurrency;

  const [summary, snapshots, latestPrice] = await Promise.all([
    getNetWorthSummary(userId, baseCurrency),
    getNormalizedHistory(userId, baseCurrency),
    prisma.priceCache.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <>
      <DashboardActions
        baseCurrency={baseCurrency}
        lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
        lastSnapshotDate={latestSnapshot?.date ?? null}
      />

      <NetWorthCard summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg lg:col-span-2 xl:col-span-1">
          <LazyTrendChart
            baseCurrency={baseCurrency}
            snapshots={snapshots}
          />
        </div>
        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
          <LazyAllocationChart summary={summary} />
        </div>
        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
          <LazyCurrencyExposureChart summary={summary} />
        </div>
      </div>

      <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
        <AccountsSummary summary={summary} />
      </div>
    </>
  );
}
