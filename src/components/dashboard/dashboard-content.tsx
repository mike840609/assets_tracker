import { Suspense, cache } from "react";
import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { LazyAllocationChart, LazyCurrencyExposureChart } from "@/components/dashboard/lazy-charts";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import {
  getCachedNetWorthSummary,
  fetchUserAccountsWithHoldings,
} from "@/lib/services/net-worth-service";
import { getAllExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { TrendChartSection } from "@/components/dashboard/trend-chart-section";
import { GoalsMilestoneCard } from "@/components/dashboard/goals-milestone-card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { GoalWithProgress } from "@/lib/types";

const fetchPreviousSnapshot = cache((userId: string) =>
  prisma.netWorthSnapshot.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { date: true, netWorth: true, baseCurrency: true, createdAt: true },
  }),
);

const SURFACE = "rounded-xl border border-border/40 bg-card p-4 sm:p-5";

/* ---------- Section skeleton helpers ---------- */

function NetWorthSkeleton() {
  return (
    <section className="py-5 sm:py-7 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted/60" />
      <div className="mt-2 h-12 sm:h-16 w-64 sm:w-80 rounded bg-muted/60" />
      <div className="mt-3 h-7 w-40 rounded-full bg-muted/60" />
      <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-2 gap-x-8 gap-y-3">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-muted/60" />
          <div className="h-7 w-28 rounded bg-muted/60" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-muted/60" />
          <div className="h-7 w-28 rounded bg-muted/60" />
        </div>
      </div>
    </section>
  );
}

function ChartsSkeleton() {
  return (
    <>
      {[...Array(2)].map((_, i) => (
        <section key={i} className={SURFACE}>
          <div className="h-5 w-32 bg-muted animate-pulse rounded mb-3" />
          <div className="h-[250px] bg-muted animate-pulse rounded" />
        </section>
      ))}
    </>
  );
}

function AccountsSummarySkeleton() {
  return (
    <section className={SURFACE}>
      <div className="h-5 w-40 bg-muted animate-pulse rounded mb-4" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    </section>
  );
}

/* ---------- Streaming section components ---------- */

/**
 * Actions bar — fetches lightweight metadata (latest price + snapshots).
 * Streams independently from the heavier net-worth computation.
 */
async function DashboardActionsSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const [previousSnapshot, latestPrice] = await Promise.all([
    fetchPreviousSnapshot(userId),
    prisma.priceCache.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const latestSnapshotDate = previousSnapshot?.createdAt?.toISOString() ?? null;

  return (
    <DashboardActions
      baseCurrency={baseCurrency}
      lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
      lastSnapshotDate={latestSnapshotDate}
    />
  );
}

/**
 * Net worth cards — the LCP element on the dashboard.
 * Fetches the cached summary and recent snapshots for the delta display.
 */
async function NetWorthSection({ userId, baseCurrency }: { userId: string; baseCurrency: string }) {
  const [summary, previousSnapshot] = await Promise.all([
    getCachedNetWorthSummary(userId, baseCurrency),
    fetchPreviousSnapshot(userId),
  ]);

  if (summary.accounts.length === 0) return null;

  let previousNetWorth: number | undefined;
  if (previousSnapshot) {
    if (previousSnapshot.baseCurrency === baseCurrency) {
      previousNetWorth = Number(previousSnapshot.netWorth);
    } else {
      const rateMap = await getAllExchangeRates();
      const rate = resolveRate(rateMap, previousSnapshot.baseCurrency, baseCurrency);
      if (rate !== undefined) previousNetWorth = Number(previousSnapshot.netWorth) * rate;
    }
  }

  return <NetWorthCard summary={summary} previousNetWorth={previousNetWorth} />;
}

/**
 * Allocation + currency exposure charts.
 * Shares the same cached summary as NetWorthSection (data-cache dedup).
 */
async function ChartsSection({ userId, baseCurrency }: { userId: string; baseCurrency: string }) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.accounts.length === 0) return null;

  return (
    <>
      <LazyAllocationChart summary={summary} />
      <LazyCurrencyExposureChart summary={summary} />
    </>
  );
}

/**
 * Goals milestone card — shows the next active goal ranked by deadline, then progress.
 * Streams independently; a user with no goals gets nothing rendered.
 */
async function GoalsMilestoneSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const goalsWithProgress = await computeGoalsWithProgress(userId, baseCurrency);
  if (goalsWithProgress.length === 0) return null;

  // Prefer soonest deadline; fall back to highest progress
  const active = goalsWithProgress.filter((g) => !g.isCompleted);
  const withDeadline = active
    .filter((g) => g.goal.targetDate)
    .sort(
      (a, b) => new Date(a.goal.targetDate!).getTime() - new Date(b.goal.targetDate!).getTime(),
    );
  const byProgress = active
    .filter((g) => !g.goal.targetDate)
    .sort((a, b) => b.progressPercent - a.progressPercent);
  const featured: GoalWithProgress | null =
    withDeadline[0] ?? byProgress[0] ?? goalsWithProgress[0] ?? null;

  return (
    <GoalsMilestoneCard
      featured={featured}
      totalGoals={goalsWithProgress.length}
      baseCurrency={baseCurrency}
    />
  );
}

/**
 * Accounts summary table.
 * Shares the same cached summary (data-cache dedup).
 */
async function AccountsSummarySection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.accounts.length === 0) return null;

  return <AccountsSummary summary={summary} />;
}

/* ---------- Orchestrator ---------- */

export async function DashboardContent({ userId }: { userId: string }) {
  // Settings are data-cached (30s TTL) — resolves near-instantly on cache hit
  const settings = await getOrCreateSettings(userId);
  const baseCurrency = settings.baseCurrency;

  // Pre-warm React caches for the inner sections
  void fetchUserAccountsWithHoldings(userId);
  void getAllExchangeRates();

  // Fast check: does this user have any active accounts?
  const accountCount = await prisma.account.count({
    where: { userId, isActive: true },
  });

  if (accountCount === 0) {
    const t = await getTranslations("dashboard");
    return (
      <div className="flex flex-col items-center justify-center py-12 md:py-24 gap-4 md:gap-6 text-center animate-in fade-in zoom-in-95 motion-normal">
        <div className="rounded-full bg-primary/10 p-8 shadow-sm">
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
          <h3 className="text-2xl font-bold tracking-tight">{t("emptyTitle")}</h3>
          <p className="text-muted-foreground text-base">{t("emptyDescription")}</p>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:scale-105 transition-all"
        >
          {t("emptyAction")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Actions stream first — lightweight metadata, no summary needed */}
      <Suspense fallback={<div className="h-10 w-full bg-muted animate-pulse rounded-lg" />}>
        <DashboardActionsSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      {/* Net worth card — the LCP element, streams as soon as summary resolves */}
      <Suspense fallback={<NetWorthSkeleton />}>
        <NetWorthSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      {/* Goals milestone — next active goal, streams after net worth */}
      <Suspense fallback={null}>
        <GoalsMilestoneSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      {/* Charts grid — trend chart + allocation + currency exposure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 items-stretch animate-in fade-in slide-in-from-bottom-8 motion-slow fill-mode-both delay-75">
        <div className="lg:col-span-2 xl:col-span-1">
          <Suspense
            fallback={
              <div className={`${SURFACE} h-[350px] animate-pulse bg-muted`} aria-hidden="true" />
            }
          >
            <TrendChartSection userId={userId} baseCurrency={baseCurrency} />
          </Suspense>
        </div>
        <Suspense fallback={<ChartsSkeleton />}>
          <ChartsSection userId={userId} baseCurrency={baseCurrency} />
        </Suspense>
      </div>

      {/* Accounts summary table */}
      <div className="animate-in fade-in slide-in-from-bottom-12 motion-slow fill-mode-both delay-150">
        <Suspense fallback={<AccountsSummarySkeleton />}>
          <AccountsSummarySection userId={userId} baseCurrency={baseCurrency} />
        </Suspense>
      </div>
    </>
  );
}
