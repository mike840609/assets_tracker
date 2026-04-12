import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { LazyAllocationChart, LazyCurrencyExposureChart } from "@/components/dashboard/lazy-charts";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { getCachedNetWorthSummary, fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getAllExchangeRates } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { TrendChartSection } from "@/components/dashboard/trend-chart-section";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function DashboardContent({ userId }: { userId: string }) {
  // Warm the React per-render cache so getCachedNetWorthSummary can reuse
  // these queries on a cold unstable_cache miss.
  void fetchUserAccountsWithHoldings(userId);
  void getAllExchangeRates();

  // Phase 1: fetch settings (needed for baseCurrency) in parallel with
  // secondary data. The user existence check is unnecessary — the session
  // middleware already guarantees the user exists.
  const [settings, recentSnapshots, latestPrice] = await Promise.all([
    getOrCreateSettings(userId),
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 2,
      select: { date: true, netWorth: true, baseCurrency: true },
    }),
    prisma.priceCache.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const baseCurrency = settings.baseCurrency;

  // On a cache hit this is instant; on a cache miss the accounts and exchange-rate
  // queries inside it resolve from the React cache populated above.
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);

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

  const latestSnapshotDate =
    recentSnapshots[0]?.date?.toISOString().split("T")[0] ?? null;

  // Only use the previous value when it shares the same base currency to avoid
  // showing a delta computed in a different currency unit.
  const previousNetWorth =
    recentSnapshots.length >= 2 && recentSnapshots[1].baseCurrency === baseCurrency
      ? Number(recentSnapshots[1].netWorth)
      : undefined;

  const cardClass =
    "bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg";

  return (
    <>
      <DashboardActions
        baseCurrency={baseCurrency}
        lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
        lastSnapshotDate={latestSnapshotDate}
      />

      <NetWorthCard summary={summary} previousNetWorth={previousNetWorth} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Trend chart streams in independently — it fetches full snapshot history
            which is slower than the cached summary used by the sections above. */}
        <div className={`${cardClass} lg:col-span-2 xl:col-span-1`}>
          <Suspense
            fallback={
              <div className="h-[350px] animate-pulse bg-muted rounded-lg" />
            }
          >
            <TrendChartSection userId={userId} baseCurrency={baseCurrency} />
          </Suspense>
        </div>
        <div className={cardClass}>
          <LazyAllocationChart summary={summary} />
        </div>
        <div className={cardClass}>
          <LazyCurrencyExposureChart summary={summary} />
        </div>
      </div>

      <div className={cardClass}>
        <AccountsSummary summary={summary} />
      </div>
    </>
  );
}
