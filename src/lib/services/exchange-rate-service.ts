import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** How long to wait (ms) before giving up on external rate APIs */
const RATE_FETCH_TIMEOUT_MS = 1200;

/**
 * Data-cached exchange rates fetcher (5-minute TTL).
 * Returns a plain object (JSON-serializable) for the data cache layer.
 */
const getCachedExchangeRates = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const rates = await prisma.exchangeRate.findMany();
    const map: Record<string, number> = {};
    for (const r of rates) {
      map[`${r.fromCurrency}_${r.toCurrency}`] = Number(r.rate);
    }
    return map;
  },
  ["exchange-rates"],
  { revalidate: 300, tags: ["exchange-rates"] }
);

/**
 * Load ALL cached exchange rates.
 * Uses the data cache (5-min TTL) and React cache() for per-render dedup.
 * Returns a Map keyed by "FROM_TO" (e.g. "USD_TWD").
 */
export const getAllExchangeRates = cache(async (): Promise<Map<string, number>> => {
  const rates = await getCachedExchangeRates();
  return new Map(Object.entries(rates));
});

/**
 * Resolve a rate from a pre-loaded map, falling back to inverse.
 * Use this instead of getExchangeRate when you already have the map.
 */
export function resolveRate(
  rateMap: Map<string, number>,
  from: string,
  to: string
): number | undefined {
  if (from === to) return 1;
  const direct = rateMap.get(`${from}_${to}`);
  if (direct !== undefined) return direct;
  const inverse = rateMap.get(`${to}_${from}`);
  if (inverse !== undefined) return 1 / inverse;
  return undefined;
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
export async function fetchExchangeRates(
  base: string
): Promise<Record<string, number>> {
  const doFetch = async (): Promise<Record<string, number>> => {
    // Try frankfurter.app first (ECB data, reliable but limited currencies)
    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${base}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.rates && Object.keys(data.rates).length > 0) {
          return data.rates;
        }
      }
    } catch {
      // Fall through to backup
    }

    // Fallback: open.er-api.com (supports 150+ currencies including TWD)
    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${base}`,
        { next: { revalidate: 3600 } }
      );
      const data = await res.json();
      if (data.result === "success" && data.rates) {
        const { [base]: _, ...rates } = data.rates;
        return rates;
      }
    } catch (error) {
      console.error("Failed to fetch exchange rates:", error);
    }

    return {};
  };

  return withTimeout(doFetch(), RATE_FETCH_TIMEOUT_MS, {});
}

/**
 * Refresh all exchange rates for a base currency and persist to DB.
 * Uses batched concurrent upserts instead of sequential writes.
 */
export async function refreshExchangeRates(baseCurrency: string): Promise<number> {
  const rates = await fetchExchangeRates(baseCurrency);
  const entries = Object.entries(rates);

  if (entries.length === 0) return 0;

  // Batch upserts concurrently (instead of sequential loop)
  await Promise.all(
    entries.map(([toCurrency, rate]) => {
      const id = `${baseCurrency}_${toCurrency}`;
      return prisma.exchangeRate.upsert({
        where: { id },
        update: { rate, updatedAt: new Date() },
        create: { id, fromCurrency: baseCurrency, toCurrency, rate },
      });
    })
  );

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
  to: string
): Promise<number> {
  if (from === to) return 1;

  // Fast path: check DB (no timeout needed for DB queries)
  const cached = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: from, toCurrency: to },
  });
  if (cached) return Number(cached.rate);

  const inverse = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: to, toCurrency: from },
  });
  if (inverse) return 1 / Number(inverse.rate);

  // Slow path: fetch from external APIs (with timeout)
  const fetchAndStore = async (): Promise<number> => {
    const rates = await fetchExchangeRates(from);
    if (rates[to]) {
      const id = `${from}_${to}`;
      // Fire-and-forget: don't block on persisting
      prisma.exchangeRate.upsert({
        where: { id },
        update: { rate: rates[to], updatedAt: new Date() },
        create: { id, fromCurrency: from, toCurrency: to, rate: rates[to] },
      }).catch(() => {});
      return rates[to];
    }

    const reverseRates = await fetchExchangeRates(to);
    if (reverseRates[from]) {
      const rate = 1 / reverseRates[from];
      const id = `${from}_${to}`;
      prisma.exchangeRate.upsert({
        where: { id },
        update: { rate, updatedAt: new Date() },
        create: { id, fromCurrency: from, toCurrency: to, rate },
      }).catch(() => {});
      return rate;
    }

    return 1; // No rate found
  };

  const rate = await withTimeout(fetchAndStore(), RATE_FETCH_TIMEOUT_MS, 1);
  if (rate === 1 && from !== to) {
    console.warn(`Exchange rate ${from} → ${to} timed out or unavailable, defaulting to 1`);
  }
  return rate;
});

/**
 * Resolve missing exchange rate pairs with a global timeout.
 * Groups pairs by source currency to minimise external API calls
 * (one fetchExchangeRates per unique source instead of per pair).
 * If resolution takes too long, unresolved pairs default to 1.
 */
export async function resolveMissingRates(
  missingPairs: Array<[string, string]>,
  ratesMap: Record<string, number>,
  timeoutMs: number = RATE_FETCH_TIMEOUT_MS
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
          const id = key;
          prisma.exchangeRate.upsert({
            where: { id },
            update: { rate: rates[to], updatedAt: new Date() },
            create: { id, fromCurrency: from, toCurrency: to, rate: rates[to] },
          }).catch(() => {});
        }
      }
    })
  );

  await withTimeout(resolveAll, timeoutMs, undefined);

  // Fill any still-unresolved pairs with 1
  for (const key of uniquePairs) {
    if (ratesMap[key] === undefined) {
      ratesMap[key] = 1;
      console.warn(`Exchange rate ${key} unresolved after timeout, defaulting to 1`);
    }
  }
}
