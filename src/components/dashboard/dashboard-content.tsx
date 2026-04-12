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
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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

  // Empty state for new users with no accounts yet
  if (summary.accounts.length === 0) {
    const t = await getTranslations("dashboard");
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="rounded-full bg-primary/10 p-6">
          <svg
            className="h-12 w-12 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
            />
          </svg>
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-xl font-semibold">{t("emptyTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("emptyDescription")}</p>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          {t("emptyAction")}
        </Link>
      </div>
    );
  }

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
