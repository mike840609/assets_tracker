import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { log, withTiming } from "@/lib/logger";

/** How long to wait (ms) before giving up on external rate APIs */
const RATE_FETCH_TIMEOUT_MS = 1200;

// Skip the external refresh entirely when this base currency was refreshed
// within this window — FX sources update at most a few times a day
// (Frankfurter/ECB once per business day), so refreshing on every
// dashboard interaction buys nothing.
const RATE_REFRESH_TTL_MS = 60 * 60 * 1000;

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
 * to a USD cross rate. Use this instead of getExchangeRate when you
 * already have the map.
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
export async function fetchExchangeRates(base: string): Promise<Record<string, number>> {
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
 * Upsert a single exchange rate into the DB.
 * Errors are caught and logged as warnings so callers are never blocked.
 */
async function persistExchangeRate(from: string, to: string, rate: number): Promise<void> {
  const id = `${from}_${to}`;
  try {
    await prisma.exchangeRate.upsert({
      where: { id },
      update: { rate, updatedAt: new Date() },
      create: { id, fromCurrency: from, toCurrency: to, rate },
    });
  } catch (error) {
    log.warn("rates.persist.failed", { from, to, error: String(error) });
  }
}

/**
 * Refresh all exchange rates for a base currency and persist to DB.
 * Uses batched concurrent upserts instead of sequential writes.
 */
export async function refreshExchangeRates(baseCurrency: string): Promise<number> {
  const last = lastRateRefreshAt.get(baseCurrency);
  if (last !== undefined && Date.now() - last < RATE_REFRESH_TTL_MS) {
    log.info("rates.refresh.skipped_fresh", { base: baseCurrency });
    return 0;
  }

  const rates = await fetchExchangeRates(baseCurrency);
  const entries = Object.entries(rates);

  if (entries.length === 0) return 0;

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
  return entries.length;
}

/**
 * Get a single exchange rate, checking the DB first then fetching live
 * as a last resort. Wrapped with a timeout so external API failures
 * don't block page rendering — falls back to 1 if timed out.
 * Memoised per server render via React cache().
 */
export const getExchangeRate = cache(async function getExchangeRate(
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;

  // Fast path: check DB via primary key (id = "${from}_${to}")
  const direct = await prisma.exchangeRate.findUnique({ where: { id: `${from}_${to}` } });
  if (direct) return Number(direct.rate);

  const inverse = await prisma.exchangeRate.findUnique({ where: { id: `${to}_${from}` } });
  if (inverse) return 1 / Number(inverse.rate);

  // Derive via USD before hitting external APIs — the daily cron warms
  // USD rates for every in-use currency, so this is usually available.
  const usdLegs = await prisma.exchangeRate.findMany({
    where: { id: { in: [`USD_${from}`, `${from}_USD`, `USD_${to}`, `${to}_USD`] } },
    select: { id: true, rate: true },
  });
  const legMap = new Map(usdLegs.map((r) => [r.id, Number(r.rate)]));
  const derived = crossRateViaUsd((key) => legMap.get(key), from, to);
  if (derived !== undefined) return derived;

  // Slow path: fetch from external APIs (with timeout)
  const fetchAndStore = async (): Promise<number> => {
    const rates = await fetchExchangeRates(from);
    if (rates[to]) {
      // Fire-and-forget: don't block on persisting
      void persistExchangeRate(from, to, rates[to]);
      return rates[to];
    }

    const reverseRates = await fetchExchangeRates(to);
    if (reverseRates[from]) {
      const rate = 1 / reverseRates[from];
      void persistExchangeRate(from, to, rate);
      return rate;
    }

    return 1; // No rate found
  };

  const rate = await withTimeout(fetchAndStore(), RATE_FETCH_TIMEOUT_MS, 1);
  if (rate === 1 && from !== to) {
    log.warn("rates.timeout", { from, to });
  }
  return rate;
});

/**
 * Resolve missing exchange rate pairs with a global timeout.
 * Groups pairs by source currency to minimise external API calls
 * (one fetchExchangeRates per unique source instead of per pair).
 * Pairs still unresolved after the timeout are derived via USD cross
 * rates; only pairs with no conversion path at all default to 1.
 */
export async function resolveMissingRates(
  missingPairs: Array<[string, string]>,
  ratesMap: Record<string, number>,
  timeoutMs: number = RATE_FETCH_TIMEOUT_MS,
): Promise<void> {
  if (missingPairs.length === 0) return;

  const uniquePairs = [...new Set(missingPairs.map(([f, t]) => `${f}_${t}`))];

  // Group by source currency to batch external API calls
  const bySource = new Map<string, string[]>();
  for (const key of uniquePairs) {
    const [from, to] = key.split("_");
    let targets = bySource.get(from);
    if (!targets) {
      targets = [];
      bySource.set(from, targets);
    }
    targets.push(to);
  }

  const resolveAll = Promise.all(
    [...bySource.entries()].map(async ([from, targets]) => {
      const rates = await fetchExchangeRates(from);
      for (const to of targets) {
        const key = `${from}_${to}`;
        if (rates[to] !== undefined) {
          ratesMap[key] = rates[to];
          // Fire-and-forget persist
          void persistExchangeRate(from, to, rates[to]);
        }
      }
    }),
  );

  await withTimeout(resolveAll, timeoutMs, undefined);

  // Derive still-unresolved pairs via USD from rates we already have;
  // only fall back to 1 when no conversion path exists at all.
  for (const key of uniquePairs) {
    if (ratesMap[key] === undefined) {
      const [from, to] = key.split("_");
      const derived = crossRateViaUsd((k) => ratesMap[k], from, to);
      if (derived !== undefined) {
        ratesMap[key] = derived;
        log.info("rates.derived_cross", { key });
      } else {
        ratesMap[key] = 1;
        log.warn("rates.unresolved", { key });
      }
    }
  }
}
