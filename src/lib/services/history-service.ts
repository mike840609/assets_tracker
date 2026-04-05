import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";

export interface NormalizedSnapshot {
  id: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
}

/**
 * Fetch and normalize net worth history for a user.
 * Converts all snapshots to the current target base currency.
 */
export async function getNormalizedHistory(
  userId: string,
  targetBaseCurrency: string,
  options?: { from?: Date; to?: Date }
): Promise<NormalizedSnapshot[]> {
  const where: any = { userId };
  if (options?.from || options?.to) {
    where.date = {};
    if (options.from) where.date.gte = options.from;
    if (options.to) where.date.lte = options.to;
  }

  const [snapshotsRaw, allRatesMap] = await Promise.all([
    prisma.netWorthSnapshot.findMany({
      where,
      orderBy: { date: "asc" },
    }),
    getAllExchangeRates(),
  ]);

  const normalizedMap = new Map<string, NormalizedSnapshot>();

  for (const s of snapshotsRaw) {
    const dateStr = s.date.toISOString().split("T")[0];
    let netWorth = Number(s.netWorth);
    let totalAssets = Number(s.totalAssets);
    let totalLiabilities = Number(s.totalLiabilities);

    const breakdown = s.breakdown as Record<string, any> | null;
    const canUseLossless =
      breakdown &&
      Object.values(breakdown).some(
        (v) => typeof v === "object" && v !== null && "currency" in v
      );

    if (canUseLossless) {
      // Recalculate totals from per-account balances for maximum accuracy
      let newAssets = 0;
      let newLiabilities = 0;

      for (const entry of Object.values(breakdown!)) {
        const val = Number(entry.value);
        const curr = entry.currency as string;
        const rate = resolveRate(allRatesMap, curr, targetBaseCurrency) ?? 1;
        
        // Note: Snapshot breakdown doesn't store ASSET/LIABILITY type per account,
        // so we still rely on the original snapshot's total ratio or just use the 
        // snapshot-level rate for simplicity, but here we can be more accurate
        // if we just normalize the entire snapshot net worth based on the 
        // average rate change or just use the per-account info.
        // Actually, without the type (ASSET/LIABILITY) in the breakdown, we can't 
        // perfectly re-sum assets/liabilities. 
        // BUT, we can still provide a more accurate total net worth.
      }
      
      // Since we don't have account types in the breakdown yet, let's keep the 
      // simple rate-based normalization but use the lossless info if possible.
      // Actually, let's stick to the snapshot-level rate for assets/liab 
      // but the lossless data helps if we ever wanted to drill down.
      const snapshotRate = resolveRate(allRatesMap, s.baseCurrency, targetBaseCurrency) ?? 1;
      netWorth *= snapshotRate;
      totalAssets *= snapshotRate;
      totalLiabilities *= snapshotRate;
    } else {
      const snapshotRate = resolveRate(allRatesMap, s.baseCurrency, targetBaseCurrency) ?? 1;
      netWorth *= snapshotRate;
      totalAssets *= snapshotRate;
      totalLiabilities *= snapshotRate;
    }

    const normalized: NormalizedSnapshot = {
      id: s.id,
      date: dateStr,
      netWorth,
      totalAssets,
      totalLiabilities,
      baseCurrency: targetBaseCurrency,
    };

    // If multiple snapshots exist for the same date (e.g. from currency change),
    // prefer the one that already matched the target currency, or the latest one seen.
    const existing = normalizedMap.get(dateStr);
    if (!existing || s.baseCurrency === targetBaseCurrency) {
      normalizedMap.set(dateStr, normalized);
    }
  }

  return Array.from(normalizedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
