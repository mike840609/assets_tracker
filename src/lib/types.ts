import type {
  Account,
  Goal,
  Holding,
  HoldingTransaction,
  RecurringCashTransaction,
  RecurringInvestment,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Generic serialization utilities
// ---------------------------------------------------------------------------

/**
 * Maps a Prisma model type to its serialized form:
 * - Decimal fields → number
 * - Date fields   → string (ISO)
 * - All other fields pass through unchanged
 *
 * @public Building block for new serialized model types.
 */
export type Serialized<T, DecimalKeys extends keyof T = never, DateKeys extends keyof T = never> = {
  [K in keyof T]: K extends DecimalKeys ? number : K extends DateKeys ? string : T[K];
};

/**
 * Converts a Prisma model instance to its serialized form.
 * Coerces Decimal fields via Number() and Date fields via .toISOString().
 * Safe to pass from Server Components to Client Components.
 */
function serializeModel<T extends object, D extends keyof T, Dt extends keyof T>(
  obj: T,
  opts: { decimals: readonly D[]; dates: readonly Dt[] },
): Serialized<T, D, Dt> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj) as (keyof T & string)[]) {
    if ((opts.decimals as readonly (keyof T)[]).includes(key)) {
      result[key] = Number(obj[key]);
    } else if ((opts.dates as readonly (keyof T)[]).includes(key)) {
      result[key] = (obj[key] as unknown as Date).toISOString();
    } else {
      result[key] = obj[key];
    }
  }
  return result as Serialized<T, D, Dt>;
}

// ---------------------------------------------------------------------------
// Serialized model types
// ---------------------------------------------------------------------------

export type SerializedAccount = Serialized<Account, "cashBalance", "createdAt" | "updatedAt">;

export type SerializedHolding = Serialized<
  Holding,
  "quantity" | "strike",
  "createdAt" | "updatedAt" | "expiration"
>;

export type SerializedAccountWithHoldings = SerializedAccount & {
  holdings: SerializedHolding[];
};

export type SerializedTransaction = Serialized<HoldingTransaction, "quantity", "createdAt"> & {
  holding?: {
    symbol: string;
    name: string;
    currency: string;
    assetType: string;
  };
};

// ---------------------------------------------------------------------------
// Calculation types
// ---------------------------------------------------------------------------

export type HoldingWithPrice = SerializedHolding & {
  currentPrice: number | null;
  marketValue: number | null;
  marketValueInBaseCurrency: number | null;
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

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** @public Documented serialization helper (see CLAUDE.md — RSC → Client serialization). */
export function serializeAccount(account: Account): SerializedAccount {
  return serializeModel(account, {
    decimals: ["cashBalance"] as const,
    dates: ["createdAt", "updatedAt"] as const,
  });
}

/** @public Documented serialization helper (see CLAUDE.md — RSC → Client serialization). */
export function serializeHolding(holding: Holding): SerializedHolding {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(holding) as (keyof Holding)[]) {
    const value = holding[key];
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (key === "quantity" || key === "strike") {
      result[key] = Number(value);
    } else if (key === "createdAt" || key === "updatedAt" || key === "expiration") {
      result[key] = (value as Date).toISOString();
    } else {
      result[key] = value;
    }
  }
  return result as SerializedHolding;
}

export function serializeAccountWithHoldings(
  account: Account & { holdings: Holding[] },
): SerializedAccountWithHoldings {
  return {
    ...serializeAccount(account),
    holdings: account.holdings.map(serializeHolding),
  };
}

// ---------------------------------------------------------------------------
// Recurring cash transaction types (F6)
// ---------------------------------------------------------------------------

export type SerializedRecurringCashTransaction = {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  note: string | null;
  // Calendar-day fields are serialized as YYYY-MM-DD (no time component).
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** YYYY-MM-DD from a UTC-midnight `@db.Date` value. */
function toDateOnly(d: Date): string {
  return (d as Date).toISOString().slice(0, 10);
}

export function serializeRecurringCashTransaction(
  rule: RecurringCashTransaction,
): SerializedRecurringCashTransaction {
  return {
    id: rule.id,
    accountId: rule.accountId,
    type: rule.type as "DEPOSIT" | "WITHDRAWAL",
    amount: Number(rule.amount),
    frequency: rule.frequency,
    note: rule.note,
    startDate: toDateOnly(rule.startDate),
    endDate: rule.endDate ? toDateOnly(rule.endDate) : null,
    nextRunDate: toDateOnly(rule.nextRunDate),
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export type SerializedRecurringInvestment = {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  assetType: "STOCK" | "ETF" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "OPTION" | "OTHER";
  holdingCurrency: string;
  amount: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  note: string | null;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function serializeRecurringInvestment(
  rule: RecurringInvestment,
): SerializedRecurringInvestment {
  return {
    id: rule.id,
    accountId: rule.accountId,
    symbol: rule.symbol,
    name: rule.name,
    assetType: rule.assetType,
    holdingCurrency: rule.holdingCurrency,
    amount: Number(rule.amount),
    frequency: rule.frequency,
    note: rule.note,
    startDate: toDateOnly(rule.startDate),
    endDate: rule.endDate ? toDateOnly(rule.endDate) : null,
    nextRunDate: toDateOnly(rule.nextRunDate),
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Goal types
// ---------------------------------------------------------------------------

export type SerializedGoal = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  targetCurrency: string;
  targetDate: string | null;
  scope: "NET_WORTH" | "ASSETS_ONLY" | "CATEGORY" | "ACCOUNT";
  scopeRefId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalWithProgress = {
  goal: SerializedGoal;
  currentAmount: number;
  targetAmountInBase: number;
  progressPercent: number;
  projectedDateLinear: string | null;
  projectedDateCAGR: string | null;
  isCompleted: boolean;
};

export function serializeGoal(goal: Goal): SerializedGoal {
  return {
    id: goal.id,
    userId: goal.userId,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    targetCurrency: goal.targetCurrency,
    targetDate: goal.targetDate ? (goal.targetDate as Date).toISOString() : null,
    scope: goal.scope as "NET_WORTH" | "ASSETS_ONLY" | "CATEGORY" | "ACCOUNT",
    scopeRefId: goal.scopeRefId,
    sortOrder: goal.sortOrder,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
