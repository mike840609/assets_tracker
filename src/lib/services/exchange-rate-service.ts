import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FX_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log, withTiming } from "@/lib/logger";

export type RefreshRatesResult = {
  updated: number;
  /** Persisted rows whose rate changed compared with the previous value. */
  changed: number;
  /** True when the base currency's rates were fresh and no fetch happened. */
  skippedFresh: boolean;
  /** When the rates become stale again; null unless skippedFresh. */
  nextRefreshAt: string | null;
  /**
   * True when the external fetch returned nothing and the call was NOT
   * skipped-fresh — i.e. an actual failure/timeout, distinguishable from
   * "rates were fresh, nothing to do". Read paths keep serving cached
   * (possibly stale) rates; the UI should surface this.
   */
  fetchFailed: boolean;
};

/** How long to wait (ms) before giving up on external rate APIs */
const RATE_FETCH_TIMEOUT_MS = 1200;

/**
 * Currencies the Frankfurter API (ECB reference rates) can serve as a base.
 * Anything outside this set (e.g. TWD) returns a guaranteed 404, so we skip
 * the primary source entirely for those bases and go straight to the
 * er-api fallback — saving a wasted round-trip on every refresh. The ECB
 * list changes only rarely; if it grows, an unsupported base simply keeps
 * using the fallback until added here.
 */
const FRANKFURTER_CURRENCIES = new Set([
  "AUD",
  "BGN",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "USD",
  "ZAR",
]);

// In-process memo of the last successful refresh per base currency, so the
// staleness check costs no DB read (same warm-instance pattern as
// lib/rate-limit.ts). Cold starts simply refresh once and re-prime it.
const lastRateRefreshAt = new Map<string, number>();

function decimalChangedAtDbScale(current: unknown, next: number): boolean {
  const currentNumber = Number(current);
  return (
    !Number.isFinite(currentNumber) ||
    !Number.isFinite(next) ||
    currentNumber.toFixed(8) !== next.toFixed(8)
  );
}

async function getPersistedFreshRefreshAt(baseCurrency: string): Promise<Date | null> {
  const result = await prisma.exchangeRate.aggregate({
    where: { fromCurrency: baseCurrency },
    _max: { updatedAt: true },
  });
  const refreshedAt = result._max.updatedAt;
  if (!refreshedAt || Date.now() - refreshedAt.getTime() >= FX_REFRESH_TTL_MS) return null;
  return refreshedAt;
}

/**
 * Cache Components read of all exchange rates.
 * Returns a plain object (`"use cache"` compatible). Invalidated by
 * the `exchange-rates` tag on refresh + cron snapshot.
 */
async function getCachedExchangeRates(): Promise<Record<string, number>> {
  "use cache";
  cacheTag("exchange-rates");
  cacheLife("hours");
  const rates = await prisma.exchangeRate.findMany({
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });
  const map: Record<string, number> = {};
  for (const r of rates) {
    map[`${r.fromCurrency}_${r.toCurrency}`] = Number(r.rate);
  }
  return map;
}

/**
 * Cache Components read of the most recent ExchangeRate write (max
 * `updatedAt` across the table), as an ISO string — null when the table is
 * empty. Backs the user-facing "FX rates as of …" / stale-rates signal.
 * Kept separate from `getAllExchangeRates` so its many callers keep their
 * `Map<string, number>` shape.
 */
export async function getExchangeRatesFreshness(): Promise<string | null> {
  "use cache";
  cacheTag("exchange-rates");
  cacheLife("hours");
  const result = await prisma.exchangeRate.aggregate({ _max: { updatedAt: true } });
  return result._max.updatedAt?.toISOString() ?? null;
}

/**
 * Load ALL cached exchange rates.
 * Uses the Cache Components layer (invalidated by the `exchange-rates`
 * tag) plus React cache() for per-render dedup. Returns a Map keyed
 * by "FROM_TO" (e.g. "USD_TWD").
 */
export const getAllExchangeRates = cache(async (): Promise<Map<string, number>> => {
  const rates = await getCachedExchangeRates();
  return new Map(Object.entries(rates));
});

/**
 * Derive a cross rate via USD from already-known rates, e.g.
 * TWD→EUR = (USD→EUR) / (USD→TWD). The daily cron warms USD rates for
 * every in-use currency, so this resolves most pairs that lack a direct
 * or inverse entry — without an external fetch.
 */
function crossRateViaUsd(
  get: (key: string) => number | undefined,
  from: string,
  to: string,
): number | undefined {
  const leg = (currency: string): number | undefined => {
    const direct = get(`USD_${currency}`);
    if (direct !== undefined) return direct;
    const inverse = get(`${currency}_USD`);
    return inverse !== undefined && inverse !== 0 ? 1 / inverse : undefined;
  };
  const usdToFrom = leg(from);
  const usdToTo = leg(to);
  if (usdToFrom === undefined || usdToTo === undefined || usdToFrom === 0) return undefined;
  return usdToTo / usdToFrom;
}

/**
 * Resolve a rate from a pre-loaded map, falling back to inverse, then
 * to a USD cross rate.
 */
export function resolveRate(
  rateMap: Map<string, number>,
  from: string,
  to: string,
): number | undefined {
  if (from === to) return 1;
  const direct = rateMap.get(`${from}_${to}`);
  if (direct !== undefined) return direct;
  const inverse = rateMap.get(`${to}_${from}`);
  if (inverse !== undefined) return 1 / inverse;
  return crossRateViaUsd((key) => rateMap.get(key), from, to);
}

/**
 * Race a promise against a timeout. Returns fallback if the promise
 * doesn't resolve within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Fetch exchange rates from external APIs with a timeout guard.
 * Returns {} if all sources fail or timeout.
 *
 * Exported for unit testing; production callers use `refreshExchangeRates`.
 */
export async function fetchExchangeRates(base: string): Promise<Record<string, number>> {
  const doFetch = async (): Promise<Record<string, number>> => {
    // Primary: Frankfurter (ECB data, reliable but limited to the currencies
    // the ECB publishes). Skip it entirely for bases it can't serve (e.g.
    // TWD) — those return a guaranteed 404, so the gate avoids a wasted
    // round-trip before falling back. For a supported base, a transient
    // failure is logged at warn level (breadcrumb only, not a captured Sentry
    // error) and falls through; only a total failure of BOTH sources is
    // escalated to log.error further down.
    if (FRANKFURTER_CURRENCIES.has(base)) {
      const frankfurterStart = Date.now();
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`, {
          next: { revalidate: 3600 },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.rates || Object.keys(data.rates).length === 0) throw new Error("empty rates");
        log.info("rates.frankfurter.fetch", { base, durationMs: Date.now() - frankfurterStart });
        return data.rates as Record<string, number>;
      } catch (error) {
        // Transient failure for a supported base; fall through to backup.
        log.warn("rates.frankfurter.fallback", {
          base,
          durationMs: Date.now() - frankfurterStart,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback (and primary for non-ECB bases): open.er-api.com (supports
    // 150+ currencies including TWD)
    try {
      const rates = await withTiming(
        "rates.er_api.fetch",
        async () => {
          const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
            next: { revalidate: 3600 },
          });
          const data = await res.json();
          if (data.result !== "success" || !data.rates) throw new Error("bad response");
          return Object.fromEntries(
            Object.entries(data.rates as Record<string, number>).filter(([key]) => key !== base),
          );
        },
        { base },
      );
      return rates;
    } catch (error) {
      log.error("rates.fetch.failed", { base, error: String(error) });
    }

    return {};
  };

  return withTimeout(doFetch(), RATE_FETCH_TIMEOUT_MS, {});
}

/**
 * Refresh all exchange rates for a base currency and persist to DB.
 * Uses batched concurrent upserts instead of sequential writes.
 *
 * Unless `force` (cron path), skips the external fetch entirely when this
 * base currency was refreshed within FX_REFRESH_TTL_MS — FX sources update
 * at most a few times a day, so refreshing on every dashboard interaction
 * buys nothing.
 */
export async function refreshExchangeRates(
  baseCurrency: string,
  opts: { force?: boolean } = {},
): Promise<RefreshRatesResult> {
  const last = lastRateRefreshAt.get(baseCurrency);
  if (!opts.force && last !== undefined && Date.now() - last < FX_REFRESH_TTL_MS) {
    log.info("rates.refresh.skipped_fresh", { base: baseCurrency });
    return {
      updated: 0,
      changed: 0,
      skippedFresh: true,
      nextRefreshAt: new Date(last + FX_REFRESH_TTL_MS).toISOString(),
      fetchFailed: false,
    };
  }

  if (!opts.force) {
    const persistedRefreshAt = await getPersistedFreshRefreshAt(baseCurrency);
    if (persistedRefreshAt) {
      lastRateRefreshAt.set(baseCurrency, persistedRefreshAt.getTime());
      log.info("rates.refresh.skipped_fresh_db", { base: baseCurrency });
      return {
        updated: 0,
        changed: 0,
        skippedFresh: true,
        nextRefreshAt: new Date(persistedRefreshAt.getTime() + FX_REFRESH_TTL_MS).toISOString(),
        fetchFailed: false,
      };
    }
  }

  const rates = await fetchExchangeRates(baseCurrency);
  const entries = Object.entries(rates);

  if (entries.length === 0) {
    // Genuine failure/timeout (lastRateRefreshAt deliberately NOT stamped,
    // so the next call retries immediately).
    return {
      updated: 0,
      changed: 0,
      skippedFresh: false,
      nextRefreshAt: null,
      fetchFailed: true,
    };
  }

  const rows: [fromCurrency: string, toCurrency: string, rate: number][] = [];
  for (const [toCurrency, rate] of entries) {
    rows.push([baseCurrency, toCurrency, rate]);
    // Persist the inverse too, so direct lookups cover both directions and
    // resolveRate stops re-deriving 1/rate on every chained conversion.
    // Tradeoff: a later genuine fetch of `toCurrency` as base overwrites this
    // derived row (last-write-wins) — fine, since both come from the same
    // upstream snapshot and a fresher genuine rate is strictly better.
    if (rate !== 0) rows.push([toCurrency, baseCurrency, 1 / rate]);
  }
  // Sort by pair so every statement locks rows in the same order: concurrent
  // refreshes (one per currency in /api/refresh) now write overlapping rows
  // (e.g. base=USD and base=TWD both upsert USD_TWD and TWD_USD), and
  // multi-row upserts taking the same locks in different orders can deadlock.
  rows.sort(([aFrom, aTo], [bFrom, bTo]) => `${aFrom}_${aTo}`.localeCompare(`${bFrom}_${bTo}`));

  const currentRows = await prisma.exchangeRate.findMany({
    where: { OR: rows.map(([fromCurrency, toCurrency]) => ({ fromCurrency, toCurrency })) },
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });
  const currentByPair = new Map(
    currentRows.map((row) => [`${row.fromCurrency}_${row.toCurrency}`, row]),
  );
  const changed = rows.reduce((count, [fromCurrency, toCurrency, rate]) => {
    const current = currentByPair.get(`${fromCurrency}_${toCurrency}`);
    return current === undefined || decimalChangedAtDbScale(current.rate, rate) ? count + 1 : count;
  }, 0);

  const params: unknown[] = [];
  const placeholders = rows.map(([fromCurrency, toCurrency, rate]) => {
    const base = params.length;
    params.push(fromCurrency, toCurrency, String(rate));
    return `($${base + 1}, $${base + 2}, $${base + 3}::numeric, NOW())`;
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ExchangeRate" ("fromCurrency", "toCurrency", rate, "updatedAt")
     VALUES ${placeholders.join(", ")}
     ON CONFLICT ("fromCurrency", "toCurrency") DO UPDATE SET
       rate        = EXCLUDED.rate,
       "updatedAt" = NOW()`,
    ...params,
  );

  // Stamp only after a successful persist so failed refreshes retry.
  lastRateRefreshAt.set(baseCurrency, Date.now());
  // `updated` counts fetched (forward) rates only — it feeds the user-facing
  // "N rates updated" toast; counting derived inverse rows would double it.
  return {
    updated: entries.length,
    changed,
    skippedFresh: false,
    nextRefreshAt: null,
    fetchFailed: false,
  };
}
