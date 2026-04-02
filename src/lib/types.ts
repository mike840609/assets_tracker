import type { Account, Holding, PriceCache } from "@/generated/prisma";
import { Decimal } from "@/generated/prisma/runtime/library";

export type AccountWithHoldings = Account & {
  holdings: Holding[];
};

export type HoldingWithPrice = Holding & {
  currentPrice: number | null;
  marketValue: number | null;
};

export type AccountWithValue = Account & {
  holdings: HoldingWithPrice[];
  totalValue: number;
  totalValueInBaseCurrency: number;
};

export type NetWorthSummary = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  baseCurrency: string;
  accounts: AccountWithValue[];
};

export type AllocationItem = {
  category: string;
  value: number;
  percentage: number;
  color: string;
};

export function decimalToNumber(d: Decimal | null | undefined): number {
  if (d == null) return 0;
  return Number(d);
}
