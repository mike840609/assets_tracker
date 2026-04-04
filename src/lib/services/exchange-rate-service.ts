import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Load ALL cached exchange rates from the database in a single query.
 * Returns a lookup map keyed by "FROM_TO" (e.g. "USD_TWD").
 * Memoised per server render via React cache().
 */
export const getAllExchangeRates = cache(async (): Promise<Map<string, number>> => {
  const rates = await prisma.exchangeRate.findMany();
  const map = new Map<string, number>();
  for (const r of rates) {
    map.set(`${r.fromCurrency}_${r.toCurrency}`, Number(r.rate));
  }
  return map;
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

export async function fetchExchangeRates(
  base: string
): Promise<Record<string, number>> {
  // Try frankfurter.app first (ECB data, reliable but limited currencies)
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}`,
      { next: { revalidate: 0 } }
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
      { next: { revalidate: 0 } }
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
}

export async function refreshExchangeRates(baseCurrency: string): Promise<number> {
  // fetchExchangeRates already tries frankfurter.app then open.er-api.com
  const rates = await fetchExchangeRates(baseCurrency);
  let updated = 0;

  for (const [toCurrency, rate] of Object.entries(rates)) {
    const id = `${baseCurrency}_${toCurrency}`;
    await prisma.exchangeRate.upsert({
      where: { id },
      update: { rate, updatedAt: new Date() },
      create: {
        id,
        fromCurrency: baseCurrency,
        toCurrency,
        rate,
      },
    });
    updated++;
  }

  return updated;
}

export const getExchangeRate = cache(async function getExchangeRate(
  from: string,
  to: string
): Promise<number> {
  if (from === to) return 1;

  const cached = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: from, toCurrency: to },
  });

  if (cached) return Number(cached.rate);

  // Try inverse
  const inverse = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: to, toCurrency: from },
  });

  if (inverse) return 1 / Number(inverse.rate);

  // Fetch live
  const rates = await fetchExchangeRates(from);
  if (rates[to]) {
    const id = `${from}_${to}`;
    await prisma.exchangeRate.upsert({
      where: { id },
      update: { rate: rates[to], updatedAt: new Date() },
      create: { id, fromCurrency: from, toCurrency: to, rate: rates[to] },
    });
    return rates[to];
  }

  // Try fetching the reverse direction
  const reverseRates = await fetchExchangeRates(to);
  if (reverseRates[from]) {
    const rate = 1 / reverseRates[from];
    const id = `${from}_${to}`;
    await prisma.exchangeRate.upsert({
      where: { id },
      update: { rate, updatedAt: new Date() },
      create: { id, fromCurrency: from, toCurrency: to, rate },
    });
    return rate;
  }

  console.warn(`No exchange rate found for ${from} -> ${to}, defaulting to 1`);
  return 1;
});
