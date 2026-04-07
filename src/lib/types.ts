import type { Account, Holding, HoldingTransaction } from "@/generated/prisma/client";

// Serialized types where Prisma Decimal fields are converted to number
// These are safe to pass from Server Components to Client Components
export type SerializedAccount = Omit<Account, "cashBalance" | "createdAt" | "updatedAt"> & {
  cashBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type SerializedHolding = Omit<Holding, "quantity" | "createdAt" | "updatedAt"> & {
  quantity: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type SerializedAccountWithHoldings = SerializedAccount & {
  holdings: SerializedHolding[];
};

export type HoldingWithPrice = SerializedHolding & {
  currentPrice: number | null;
  marketValue: number | null;
};

export type AccountWithValue = SerializedAccount & {
  holdings: HoldingWithPrice[];
  totalValue: number;
  totalValueInBaseCurrency: number;
};

export type NetWorthSummary = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  baseCurrency: string;
  currencyExposure: { currency: string; value: number }[];
  accounts: AccountWithValue[];
};

export type AllocationItem = {
  category: string;
  value: number;
  percentage: number;
  color: string;
};

export type SerializedTransaction = Omit<HoldingTransaction, "quantity" | "createdAt"> & {
  quantity: number;
  createdAt: string;
  holding?: {
    symbol: string;
    name: string;
    currency: string;
    assetType: string;
  };
};

// Serialization helpers — explicitly construct plain objects
// (spreading Prisma model instances doesn't strip Decimal/Date properly)
export function serializeAccount(account: Account): SerializedAccount {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    type: account.type,
    category: account.category,
    currency: account.currency,
    cashBalance: Number(account.cashBalance),
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function serializeHolding(holding: Holding): SerializedHolding {
  return {
    id: holding.id,
    accountId: holding.accountId,
    symbol: holding.symbol,
    name: holding.name,
    quantity: Number(holding.quantity),
    currency: holding.currency,
    assetType: holding.assetType,
    createdAt: holding.createdAt.toISOString(),
    updatedAt: holding.updatedAt.toISOString(),
  };
}

export function serializeAccountWithHoldings(
  account: Account & { holdings: Holding[] }
): SerializedAccountWithHoldings {
  return {
    ...serializeAccount(account),
    holdings: account.holdings.map(serializeHolding),
  };
}
