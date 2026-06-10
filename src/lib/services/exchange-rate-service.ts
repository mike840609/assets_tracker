import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FX_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log, withTiming } from "@/lib/logger";

export type RefreshRatesResult = {
  updated: number;
  /** True when the base currency's rates were fresh and no fetch happened. */
  skippedFresh: boolean;
  /** When the rates become stale again; null unless skippedFresh. */
  nextRefreshAt: string | null;
};

/** How long to wait (ms) before giving up on external rate APIs */
const RATE_FETCH_TIMEOUT_MS = 1200;

// In-process memo of the last successful refresh per base currency, so the
// staleness check costs no DB read (same warm-instance pattern as
// lib/rate-limit.ts). Cold starts simply refresh once and re-prime it.
const lastRateRefreshAt = new Map<string, number>();

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
 */
async function fetchExchangeRates(base: string): Promise<Record<string, number>> {
  const doFetch = async (): Promise<Record<string, number>> => {
    // Try frankfurter.app first (ECB data, reliable but limited currencies)
    try {
      const rates = await withTiming(
        "rates.frankfurter.fetch",
        async () => {
          const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
            next: { revalidate: 3600 },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!data.rates || Object.keys(data.rates).length === 0) throw new Error("empty rates");
          return data.rates as Record<string, number>;
        },
        { base },
      );
      return rates;
    } catch {
      // Fall through to backup
    }

    // Fallback: open.er-api.com (supports 150+ currencies including TWD)
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
      skippedFresh: true,
      nextRefreshAt: new Date(last + FX_REFRESH_TTL_MS).toISOString(),
    };
  }

  const rates = await fetchExchangeRates(baseCurrency);
  const entries = Object.entries(rates);

  if (entries.length === 0) return { updated: 0, skippedFresh: false, nextRefreshAt: null };

  const params: unknown[] = [];
  const placeholders = entries.map(([toCurrency, rate]) => {
    const id = `${baseCurrency}_${toCurrency}`;
    const base = params.length;
    params.push(id, baseCurrency, toCurrency, String(rate));
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::numeric, NOW())`;
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ExchangeRate" (id, "fromCurrency", "toCurrency", rate, "updatedAt")
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (id) DO UPDATE SET
       rate        = EXCLUDED.rate,
       "updatedAt" = NOW()`,
    ...params,
  );

  // Stamp only after a successful persist so failed refreshes retry.
  lastRateRefreshAt.set(baseCurrency, Date.now());
  return { updated: entries.length, skippedFresh: false, nextRefreshAt: null };
}
