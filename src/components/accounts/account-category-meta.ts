export const HIDDEN_VALUE = "***";

export const CATEGORY_ICONS: Record<string, string> = {
  BANK: "🏦",
  BROKERAGE: "📈",
  CRYPTO_WALLET: "🪙",
  PROPERTY: "🏠",
  VEHICLE: "🚗",
  CREDIT_CARD: "💳",
  LOAN: "📋",
  MORTGAGE: "🏡",
  OTHER: "📁",
};

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BANK: {
    bg: "bg-blue-50 dark:bg-blue-950/60",
    border: "border-blue-200 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  BROKERAGE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  CRYPTO_WALLET: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  PROPERTY: {
    bg: "bg-violet-50 dark:bg-violet-950/60",
    border: "border-violet-200 dark:border-violet-800/40",
    text: "text-violet-700 dark:text-violet-300",
  },
  VEHICLE: {
    bg: "bg-slate-50 dark:bg-slate-950/60",
    border: "border-slate-200 dark:border-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
  },
  CREDIT_CARD: {
    bg: "bg-red-50 dark:bg-red-950/60",
    border: "border-red-200 dark:border-red-800/40",
    text: "text-red-700 dark:text-red-300",
  },
  LOAN: {
    bg: "bg-orange-50 dark:bg-orange-950/60",
    border: "border-orange-200 dark:border-orange-800/40",
    text: "text-orange-700 dark:text-orange-300",
  },
  MORTGAGE: {
    bg: "bg-pink-50 dark:bg-pink-950/60",
    border: "border-pink-200 dark:border-pink-800/40",
    text: "text-pink-700 dark:text-pink-300",
  },
  OTHER: {
    bg: "bg-gray-50 dark:bg-gray-950/60",
    border: "border-gray-200 dark:border-gray-800/40",
    text: "text-gray-700 dark:text-gray-300",
  },
};

export const CATEGORY_ORDER = [
  "BANK",
  "BROKERAGE",
  "CRYPTO_WALLET",
  "PROPERTY",
  "VEHICLE",
  "CREDIT_CARD",
  "LOAN",
  "MORTGAGE",
  "OTHER",
];
