export const ACCOUNT_TYPES = ["ASSET", "LIABILITY"] as const;

export const ACCOUNT_CATEGORIES = [
  "BANK",
  "BROKERAGE",
  "CRYPTO_WALLET",
  "PROPERTY",
  "VEHICLE",
  "CREDIT_CARD",
  "LOAN",
  "MORTGAGE",
  "OTHER",
] as const;

export const HOLDING_ASSET_TYPES = [
  "STOCK",
  "ETF",
  "CRYPTO",
  "MUTUAL_FUND",
  "BOND",
  "OPTION",
  "OTHER",
] as const;

export const OPTION_TYPES = ["CALL", "PUT"] as const;

export const HOLDING_TRANSACTION_TYPES = ["BUY", "SELL", "EDIT"] as const;

export const CASH_TRANSACTION_TYPES = ["DEPOSIT", "WITHDRAWAL", "EDIT"] as const;
