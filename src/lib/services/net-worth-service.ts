import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, getFreshExchangeRates, resolveRate } from "./exchange-rate-service";
import { serializeAccountWithHoldings } from "@/lib/types";
import { log } from "@/lib/logger";
import type {
  AccountWithValue,
  NetWorthSummary,
  HoldingWithPrice,
  SerializedAccountWithHoldings,
} from "@/lib/types";

/**
 * Structural account + holdings fetcher.
 * Uses the Next.js 16 `"use cache"` directive so the dashboard's
 * "list of accounts/holdings" shape — which rarely changes — is
 * served from the Cache Components layer while the downstream
 * net-worth computation (which multiplies by current prices) stays
 * dynamic. React cache() dedupes concurrent calls within a single
 * render.
 */
async function fetchUserAccountsWithHoldingsInner(
  userId: string,
): Promise<SerializedAccountWithHoldings[]> {
  "use cache";
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheLife("hours");
  return queryActiveAccountsWithHoldings(userId);
}

/** The uncached query behind the cached reader above; see the `fresh` path in
 * `computeNetWorthSummary` for why background jobs need it directly. */
async function queryActiveAccountsWithHoldings(
  userId: string,
): Promise<SerializedAccountWithHoldings[]> {
  const raw = await prisma.account.findMany({
    where: { userId, isActive: true },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return raw.map(serializeAccountWithHoldings);
}

export const fetchUserAccountsWithHoldings = cache(fetchUserAccountsWithHoldingsInner);

async function fetchUserArchivedAccountsWithHoldingsInner(
  userId: string,
): Promise<SerializedAccountWithHoldings[]> {
  "use cache";
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheLife("hours");
  const raw = await prisma.account.findMany({
    where: { userId, isActive: false },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return raw.map(serializeAccountWithHoldings);
}

export const fetchUserArchivedAccountsWithHoldings = cache(
  fetchUserArchivedAccountsWithHoldingsInner,
);

/** Price rows keyed by symbol, in whatever currency the provider quoted. */
type PriceMap = Record<string, { price: number; currency: string }>;

async function queryPriceMap(symbols: string[]): Promise<PriceMap> {
  if (symbols.length === 0) return {};
  const prices = await prisma.priceCache.findMany({
    where: { symbol: { in: [...new Set(symbols)] } },
    select: { symbol: true, price: true, currency: true },
  });
  return Object.fromEntries(
    prices.map((p) => [p.symbol, { price: Number(p.price), currency: p.currency }]),
  );
}

/**
 * Everything `computeNetWorthSummary` needs from the database for ONE user.
 * Pass it when a caller has already loaded these in bulk — see
 * `loadNetWorthInputsForUsers`.
 */
export type NetWorthInputs = {
  accounts: SerializedAccountWithHoldings[];
  ratesMap: Map<string, number>;
  priceMap: PriceMap;
};

/**
 * Bulk-load net-worth inputs for MANY users in a fixed number of queries
 * (two, plus one shared rate map), instead of three per user.
 *
 * The snapshot cron used to call `computeNetWorthSummary` once per user, so its
 * database round-trips grew linearly with the instance and ran with no
 * concurrency bound — the pool-exhaustion half of #641. Everything here is read
 * directly (no `"use cache"`), so the result is fresh by construction, which is
 * what the cron needs after it refreshes prices/FX (#640).
 *
 * `ratesMap` is passed in rather than fetched: it is global, so the caller loads
 * it once for the whole run instead of once per user or per page.
 */
export async function loadNetWorthInputsForUsers(
  userIds: string[],
  ratesMap: Map<string, number>,
): Promise<Map<string, NetWorthInputs>> {
  const byUser = new Map<string, NetWorthInputs>();
  if (userIds.length === 0) return byUser;

  const raw = await prisma.account.findMany({
    where: { userId: { in: userIds }, isActive: true },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    // Same ordering as the single-user query. Bucketing below preserves it
    // within each user, so per-user account order is unchanged.
    orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const accountsByUser = new Map<string, SerializedAccountWithHoldings[]>();
  for (const account of raw) {
    const list = accountsByUser.get(account.userId);
    if (list) list.push(serializeAccountWithHoldings(account));
    else accountsByUser.set(account.userId, [serializeAccountWithHoldings(account)]);
  }

  const priceMap = await queryPriceMap(
    raw.flatMap((account) => account.holdings.map((h) => h.symbol)),
  );

  // Users with no active accounts still get an entry, so callers snapshot them
  // (a zeroed row) exactly as the per-user path did.
  for (const userId of userIds) {
    byUser.set(userId, { accounts: accountsByUser.get(userId) ?? [], ratesMap, priceMap });
  }
  return byUser;
}

/**
 * Uncached net-worth computation.
 *
 * `fresh` swaps the two cached inputs (accounts/holdings and the FX map) for
 * direct DB reads. Background jobs that write and then read in the same run
 * must pass it: the snapshot cron refreshes prices/FX and materializes
 * recurring cash + DCA rows, then revalidates `accounts` / `exchange-rates` /
 * `net-worth` with `"max"` — stale-while-revalidate, so the cached readers hand
 * back pre-refresh values and the persisted row lands one cron cycle behind
 * (#640). Same reasoning as the direct price/FX reads in
 * `recurring-investment-service`. PriceCache below is already read directly, so
 * the price leg needs no switch. Render paths keep the cached readers.
 *
 * `preloaded` short-circuits all three reads for callers that already loaded
 * them in bulk (#641). It must carry fresh data, so pass it together with
 * `fresh` to keep the intent legible at the call site.
 */
export async function computeNetWorthSummary(
  userId: string,
  baseCurrency: string,
  opts: { fresh?: boolean; preloaded?: NetWorthInputs } = {},
): Promise<NetWorthSummary> {
  // Load accounts and exchange rates in parallel.
  // On the cached path both are React-cached, so if DashboardContent already
  // fired these calls without awaiting, we get the memoised results for free.
  const [accounts, allRatesMap] = opts.preloaded
    ? [opts.preloaded.accounts, opts.preloaded.ratesMap]
    : await Promise.all([
        opts.fresh
          ? queryActiveAccountsWithHoldings(userId)
          : fetchUserAccountsWithHoldings(userId),
        opts.fresh ? getFreshExchangeRates() : getAllExchangeRates(),
      ]);

  // Phase 2: fetch only the prices needed for this user's holdings
  const priceMap =
    opts.preloaded?.priceMap ??
    (await queryPriceMap(accounts.flatMap((a) => a.holdings.map((h) => h.symbol))));

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountsWithValue: AccountWithValue[] = [];

  for (const account of accounts) {
    const cashBalance = account.cashBalance;

    const holdingsWithPrice: HoldingWithPrice[] = account.holdings.map((h) => {
      const cached = priceMap[h.symbol];
      const currentPrice = cached?.price ?? null;
      const quantity = h.quantity;
      let multiplier = 1;
      if (h.assetType === "OPTION") {
        if (h.contractMultiplier == null) {
          // Legacy rows may predate server-derived multipliers; the OCC
          // standard 100 is assumed, which misprices non-standard contracts.
          log.warn("option.multiplier.defaulted", { symbol: h.symbol });
          multiplier = 100;
        } else {
          multiplier = h.contractMultiplier;
        }
      }
      const marketValue = currentPrice !== null ? currentPrice * quantity * multiplier : null;
      return {
        ...h,
        currentPrice,
        marketValue,
        marketValueInBaseCurrency: null,
      };
    });

    accountsWithValue.push({
      ...account,
      holdings: holdingsWithPrice,
      totalValue: 0,
      totalValueInBaseCurrency: 0,
      _cashBalance: cashBalance,
      _currency: account.currency,
    } as AccountWithValue & { _cashBalance: number; _currency: string });
  }

  // Render-time helper: read-only against ExchangeRate. Missing pairs fall
  // back to 1 (rates are warmed by the daily cron and on-write hooks).
  const warnedPairs = new Set<string>();
  // Memoize repeated pair lookups: the second pass resolves the same
  // (holding→base) and (holding→account) pairs once per currency combination,
  // not once per holding.
  const rateMemo = new Map<string, number>();
  function getRate(from: string, to: string): number {
    // Deliberate fast path: resolveRate opens with the same identity check, so
    // this only saves the call — keep the two in step if either changes.
    if (from === to) return 1;
    const memoKey = `${from}_${to}`;
    const memoized = rateMemo.get(memoKey);
    if (memoized !== undefined) return memoized;
    const resolved = resolveRate(allRatesMap, from, to);
    if (resolved !== undefined) {
      rateMemo.set(memoKey, resolved);
      return resolved;
    }
    if (!warnedPairs.has(memoKey)) {
      warnedPairs.add(memoKey);
      log.warn("rates.unresolved", { from, to, userId, baseCurrency });
    }
    // Memoize the fallback too: a miss is the most expensive path (resolveRate
    // exhausted direct, inverse and the USD cross before giving up), and
    // allRatesMap is fixed for this call, so the answer cannot change. The
    // warning is already deduped by warnedPairs and fires on the first miss,
    // above, so short-circuiting here suppresses nothing.
    rateMemo.set(memoKey, 1);
    return 1;
  }

  // Second pass: compute values using the complete rate map
  const exposureMap: Record<string, number> = {};

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const awv = accountsWithValue[i] as AccountWithValue & {
      _cashBalance: number;
      _currency: string;
    };
    const rate = getRate(account.currency, baseCurrency);
    const cashBalance = awv._cashBalance;

    let holdingsInBase = 0;
    let holdingsInAccountCurrency = 0;
    for (const h of awv.holdings) {
      if (h.marketValue !== null) {
        // The market value above was computed from the PriceCache's own price,
        // so its denomination — not the holding's stored currency — is the
        // truth for conversion. They usually agree, but for crypto pairs not
        // denominated in USD (e.g. BTC-EUR) the two can drift: the holding's
        // currency is inferred at creation time (search route), while the
        // cached price's currency reflects whatever the provider actually
        // quoted. Trusting priceMap here keeps price and denomination together.
        const holdingCurrency = priceMap[h.symbol]?.currency || h.currency || "USD";
        const holdingRateToBase = getRate(holdingCurrency, baseCurrency);
        const valueInBase = h.marketValue * holdingRateToBase;
        h.marketValueInBaseCurrency = valueInBase;
        holdingsInBase += valueInBase;
        const holdingRateToAccount = getRate(holdingCurrency, account.currency);
        holdingsInAccountCurrency += h.marketValue * holdingRateToAccount;

        if (account.type === "ASSET") {
          exposureMap[holdingCurrency] = (exposureMap[holdingCurrency] || 0) + valueInBase;
        }
      }
    }

    const cashInBase = cashBalance * rate;
    const totalValue = cashInBase + holdingsInBase;

    if (account.type === "ASSET" && cashBalance > 0) {
      exposureMap[account.currency] = (exposureMap[account.currency] || 0) + cashInBase;
    }

    awv.totalValue = cashBalance + holdingsInAccountCurrency;
    awv.totalValueInBaseCurrency = totalValue;

    // Clean up temporary fields
    delete (awv as AccountWithValue & { _cashBalance?: number; _currency?: string })._cashBalance;
    delete (awv as AccountWithValue & { _cashBalance?: number; _currency?: string })._currency;

    if (account.type === "ASSET") {
      totalAssets += totalValue;
    } else {
      totalLiabilities += totalValue;
    }
  }

  const currencyExposure = Object.entries(exposureMap)
    .map(([currency, value]) => ({ currency, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    baseCurrency,
    currencyExposure,
    accounts: accountsWithValue,
  };
}

/**
 * Cached version of net worth summary (`"use cache"`, "hours" profile —
 * freshness is driven by tag invalidation rather than the TTL, since every
 * mutation route revalidates `net-worth:${userId}` or `net-worth`).
 * Tagged both broadly (`net-worth`) and per-user (`net-worth:${userId}`)
 * so global invalidators (cron snapshot, price refresh) keep working
 * while per-user mutations (account/holding writes) can scope their
 * invalidation. React cache() dedupes per-render.
 */
async function getCachedNetWorthSummaryInner(
  userId: string,
  baseCurrency: string,
): Promise<NetWorthSummary> {
  "use cache";
  cacheTag("net-worth");
  cacheTag(`net-worth:${userId}`);
  cacheTag("exchange-rates");
  // computeNetWorthSummary reads PriceCache, so a price-only refresh
  // (watchlist stock, holdings write, cron) must be able to invalidate it.
  cacheTag("prices");
  // Defense-in-depth: the summary is computed FROM accounts/holdings, so an
  // accounts-tag invalidation must reach it even if a future mutation path
  // forgets to co-invalidate net-worth:{userId}.
  cacheTag("accounts");
  cacheTag(`accounts:${userId}`);
  cacheLife("hours");
  return computeNetWorthSummary(userId, baseCurrency);
}

export const getCachedNetWorthSummary = cache(getCachedNetWorthSummaryInner);
