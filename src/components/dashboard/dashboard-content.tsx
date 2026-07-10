import { Suspense, cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { LazyAllocationChart, LazyCurrencyExposureChart } from "@/components/dashboard/lazy-charts";
import { TrendChartSkeleton } from "@/components/dashboard/trend-chart-skeleton";
import { AccountsSummary } from "@/components/dashboard/accounts-summary";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import {
  getCachedNetWorthSummary,
  fetchUserAccountsWithHoldings,
} from "@/lib/services/net-worth-service";
import { getAllExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  getCurrentYearNormalizedHistory,
  getNormalizedHistory,
} from "@/lib/services/history-service";
import { HistoryHeatmap } from "@/components/history/history-heatmap";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { TrendChartSection } from "@/components/dashboard/trend-chart-section";
import { GoalsMilestoneCard } from "@/components/dashboard/goals-milestone-card";
import { ProjectionEntryCard } from "@/components/dashboard/projection-entry-card";
import { PortfolioHeatmap } from "@/components/analysis/portfolio-heatmap";
import { WatchlistCard } from "@/components/dashboard/watchlist-card";
import {
  ConcentrationCardSkeleton,
  WatchlistCardSkeleton,
} from "@/components/dashboard/dashboard-skeleton";
import { ConcentrationCard } from "./concentration-card";
import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardOnboarding } from "./dashboard-onboarding";
import { getCachedTrackedStocks } from "@/lib/services/stock-watch-service";
import { countActiveAccounts } from "@/lib/services/account-service";
import type { GoalWithProgress } from "@/lib/types";

/**
 * Cached previous-snapshot read — on the LCP critical path (NetWorthSection),
 * so it must not cost a live DB roundtrip per view. Snapshots are only written
 * by the cron and the data import, both of which revalidate `snapshots` /
 * `history:${userId}`. Returns a serialized shape (`"use cache"` can't carry
 * Prisma Decimal/Date).
 */
async function fetchPreviousSnapshotInner(userId: string) {
  "use cache";
  cacheTag("snapshots");
  cacheTag(`history:${userId}`);
  cacheLife("hours");
  const snapshot = await prisma.netWorthSnapshot.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { date: true, netWorth: true, baseCurrency: true, createdAt: true },
  });
  if (!snapshot) return null;
  return {
    date: snapshot.date.toISOString(),
    netWorth: Number(snapshot.netWorth),
    baseCurrency: snapshot.baseCurrency,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

const fetchPreviousSnapshot = cache(fetchPreviousSnapshotInner);

/**
 * Cached "prices last updated" read. Invalidated via the `prices` tag on
 * refresh paths; the client-side `clientRefreshAt` overlay in DashboardActions
 * covers refreshes that changed nothing.
 */
async function fetchLastPriceUpdate(): Promise<string | null> {
  "use cache";
  cacheTag("prices");
  cacheLife("hours");
  const latest = await prisma.priceCache.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return latest?.updatedAt.toISOString() ?? null;
}

/* ---------- Section skeleton helpers ---------- */

function NetWorthSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {/* Primary: Net Worth */}
      <Card className="col-span-2 rounded-2xl">
        <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-3.5 sm:h-4 w-20" />
          </div>
          <Skeleton className="h-7 sm:h-8 w-40 max-w-full mt-1" />
          <Skeleton className="h-6 w-28 rounded-full mt-3" />
        </CardContent>
      </Card>
      {/* Secondary: Assets + Liabilities */}
      {[0, 1].map((i) => (
        <Card key={i} className="col-span-1 rounded-2xl">
          <CardContent className="h-full p-4 sm:p-6 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-sm shrink-0" />
              <Skeleton className="h-3.5 sm:h-4 w-16" />
            </div>
            <Skeleton className="h-5 sm:h-6 w-24 max-w-full mt-1" />
            <Skeleton className="h-1.5 w-full rounded-full mt-3 sm:mt-4" />
            <div className="mt-1.5 flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px]" />
      </CardContent>
    </Card>
  );
}

function AccountsSummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-40 bg-muted animate-pulse rounded" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}

function PortfolioHeatmapSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-[240px] sm:h-[280px]" />
          <div className="hidden space-y-3 lg:block">
            <Skeleton className="h-24" />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [previousSnapshot, lastPriceUpdate] = await Promise.all([
    fetchPreviousSnapshot(userId),
    fetchLastPriceUpdate(),
  ]);

  return (
    <DashboardActions
      baseCurrency={baseCurrency}
      lastPriceUpdate={lastPriceUpdate}
      lastSnapshotDate={previousSnapshot?.createdAt ?? null}
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
      previousNetWorth = previousSnapshot.netWorth;
    } else {
      const rateMap = await getAllExchangeRates();
      const rate = resolveRate(rateMap, previousSnapshot.baseCurrency, baseCurrency);
      if (rate !== undefined) previousNetWorth = previousSnapshot.netWorth * rate;
    }
  }

  return (
    <NetWorthCard
      summary={summary}
      previousNetWorth={previousNetWorth}
      previousSnapshotDate={previousNetWorth !== undefined ? previousSnapshot?.date : undefined}
    />
  );
}

/**
 * Allocation donut — asset composition by category.
 * Lives in the trend-row rail. Shares the cached summary (data-cache dedup).
 */
async function AllocationSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.accounts.length === 0) return null;

  return <LazyAllocationChart summary={summary} />;
}

/**
 * Currency exposure donut — value split by currency.
 * Pairs with the portfolio heatmap row. Shares the cached summary (data-cache dedup).
 */
async function CurrencySection({ userId, baseCurrency }: { userId: string; baseCurrency: string }) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.accounts.length === 0) return null;

  return <LazyCurrencyExposureChart summary={summary} />;
}

/**
 * Concentration card — largest positions as a share of total assets. Point-in-time
 * (no per-holding history exists in snapshots). Shares the cached summary.
 */
async function ConcentrationSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.totalAssets <= 0) return null;
  return <ConcentrationCard summary={summary} />;
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
  // No goals: the planning rail would otherwise be empty and Projections (a
  // sub-tab of /goals) would have no dashboard scent. Surface a projection entry
  // instead so the feature stays discoverable for goal-less users.
  if (goalsWithProgress.length === 0) return <ProjectionEntryCard />;

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
 * Trend chart + history heatmap — streams behind its Suspense boundary so the
 * dashboard shell never waits on snapshot history. getNormalizedHistory is
 * "use cache" with cacheLife("hours"), so the chart stays on the fast 90-day
 * window while the heatmap gets a year-to-date calendar window.
 */
async function TrendSection({ userId, baseCurrency }: { userId: string; baseCurrency: string }) {
  const [trendSnapshots, heatmapSnapshots, t] = await Promise.all([
    getNormalizedHistory(userId, baseCurrency),
    getCurrentYearNormalizedHistory(userId, baseCurrency),
    getTranslations("dashboard"),
  ]);

  return (
    <TrendChartSection
      baseCurrency={baseCurrency}
      snapshots={trendSnapshots}
      footer={
        <>
          <HistoryHeatmap snapshots={heatmapSnapshots} baseCurrency={baseCurrency} />
          {/* Mobile-only entry point — the trend chart is the preview; this
              names the History destination inline. Desktop uses the sidebar route. */}
          <Link
            href="/history"
            className="md:hidden mt-3 flex items-center justify-between gap-2 rounded-sm border-t border-border/40 pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {t("viewFullHistory")}
            </span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </>
      }
    />
  );
}

async function WatchlistSection({ userId }: { userId: string }) {
  const stocks = await getCachedTrackedStocks(userId);

  return <WatchlistCard stocks={stocks} />;
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

/**
 * Portfolio composition heatmap.
 * Sits between current exposure and account detail as a visual bridge.
 */
async function PortfolioHeatmapSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  const hasAssets = summary.accounts.some(
    (account) => account.type === "ASSET" && account.totalValueInBaseCurrency > 0,
  );
  if (!hasAssets) return null;

  return <PortfolioHeatmap summary={summary} fillHeight />;
}

/* ---------- Orchestrator ---------- */

export async function DashboardContent({ userId }: { userId: string }) {
  // Settings are data-cached (30s TTL) — resolves near-instantly on cache hit
  const settingsP = getOrCreateSettings(userId);

  // Pre-warm React caches for the inner sections
  void fetchUserAccountsWithHoldings(userId);
  void getAllExchangeRates();

  // First paint waits only on settings + the account count — everything else
  // (including the snapshot history, now inside TrendSection) streams behind
  // its own Suspense boundary.
  const [settings, accountCount] = await Promise.all([
    settingsP,
    // Fast check: does this user have any active accounts?
    countActiveAccounts(userId),
  ]);
  const baseCurrency = settings.baseCurrency;

  if (accountCount === 0) {
    return <DashboardOnboarding />;
  }

  return (
    <>
      {/* Actions stream first — lightweight metadata, no summary needed */}
      <Suspense fallback={<div className="h-10 w-full bg-muted animate-pulse rounded-lg" />}>
        <DashboardActionsSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      {/* Net worth card — the LCP element, full-bleed headline above the grid */}
      <Suspense fallback={<NetWorthSkeleton />}>
        <NetWorthSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      {/* Tier 2 — "what changed": trend chart (8) + goals/watchlist rail (4).
          The rail is intentionally short (two cards) so the trend card, which
          stretches to match it, stays a compact height rather than ballooning
          to a three-card rail. Allocation moved to the donut row below. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-8 motion-slow fill-mode-both delay-75">
        <div className="min-w-0 lg:col-span-8">
          <Suspense fallback={<TrendChartSkeleton />}>
            <TrendSection userId={userId} baseCurrency={baseCurrency} />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4">
          <Suspense fallback={null}>
            <GoalsMilestoneSection userId={userId} baseCurrency={baseCurrency} />
          </Suspense>
          <Suspense fallback={<WatchlistCardSkeleton />}>
            <WatchlistSection userId={userId} />
          </Suspense>
        </div>
      </div>

      {/* Tier 3 — "what it's made of": a content-sized 8/4 overview row followed
          by a full-width concentration summary. Source order stays allocation →
          currency → portfolio → concentration for mobile and assistive technology. */}
      <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-10 motion-slow fill-mode-both delay-100">
        <div
          data-testid="portfolio-overview-row"
          className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12"
        >
          <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <Suspense fallback={<ChartCardSkeleton />}>
              <AllocationSection userId={userId} baseCurrency={baseCurrency} />
            </Suspense>
            <Suspense fallback={<ChartCardSkeleton />}>
              <CurrencySection userId={userId} baseCurrency={baseCurrency} />
            </Suspense>
          </div>
          <div className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:contain-size lg:[&>*]:min-h-0 lg:[&>*]:flex-1">
            <Suspense fallback={<PortfolioHeatmapSkeleton />}>
              <PortfolioHeatmapSection userId={userId} baseCurrency={baseCurrency} />
            </Suspense>
          </div>
        </div>
        <Suspense
          fallback={
            <div>
              <ConcentrationCardSkeleton />
            </div>
          }
        >
          <ConcentrationSection userId={userId} baseCurrency={baseCurrency} />
        </Suspense>
      </div>

      {/* Tier 4 — drill-in detail: full-width accounts summary */}
      <div className="animate-in fade-in slide-in-from-bottom-12 motion-slow fill-mode-both delay-150">
        <Suspense fallback={<AccountsSummarySkeleton />}>
          <AccountsSummarySection userId={userId} baseCurrency={baseCurrency} />
        </Suspense>
      </div>
    </>
  );
}
