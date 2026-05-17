import type { SerializedAccountWithHoldings, SerializedHolding } from "@/lib/types";

export type NumericPriceMap = Record<string, number | null | undefined>;
export type RateMap = Record<string, number | undefined>;

export function getHoldingMultiplier(
  holding: Pick<SerializedHolding, "assetType" | "contractMultiplier">,
) {
  return holding.assetType === "OPTION" ? (holding.contractMultiplier ?? 100) : 1;
}

export function resolveRateFromRecord(ratesMap: RateMap, fromCurrency: string, toCurrency: string) {
  if (fromCurrency === toCurrency) return 1;
  return ratesMap[`${fromCurrency}_${toCurrency}`] ?? 1;
}

export function getHoldingMarketValue(
  holding: Pick<
    SerializedHolding,
    "symbol" | "quantity" | "currency" | "assetType" | "contractMultiplier"
  >,
  priceMap: NumericPriceMap,
  targetCurrency: string,
  ratesMap: RateMap,
) {
  const price = priceMap[holding.symbol] ?? null;
  if (price === null) return null;

  const holdingCurrency = holding.currency || "USD";
  const rate = resolveRateFromRecord(ratesMap, holdingCurrency, targetCurrency);
  return price * holding.quantity * getHoldingMultiplier(holding) * rate;
}

export function getAccountValue(
  account: SerializedAccountWithHoldings,
  priceMap: NumericPriceMap,
  ratesMap: RateMap,
) {
  const holdingsValue = account.holdings.reduce((sum, holding) => {
    return sum + (getHoldingMarketValue(holding, priceMap, account.currency, ratesMap) ?? 0);
  }, 0);

  return account.cashBalance + holdingsValue;
}

export function getAccountValueInCurrency(
  account: SerializedAccountWithHoldings,
  priceMap: NumericPriceMap,
  ratesMap: RateMap,
  targetCurrency: string,
) {
  const accountValue = getAccountValue(account, priceMap, ratesMap);
  return accountValue * resolveRateFromRecord(ratesMap, account.currency, targetCurrency);
}
