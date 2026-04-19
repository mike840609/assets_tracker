"use client";

import { memo } from "react";
import { formatCurrency } from "@/lib/currencies";

interface CurrencyCellProps {
  amount: number;
  currency: string;
  compact?: boolean;
  className?: string;
}

// Memoised so privacy/theme toggles don't force a re-format for every
// currency cell across the tree. `formatCurrency` is pure; as long as
// amount/currency/compact don't change, the formatted string is stable.
export const CurrencyCell = memo(function CurrencyCell({
  amount,
  currency,
  compact = false,
  className,
}: CurrencyCellProps) {
  return <span className={className}>{formatCurrency(amount, currency, compact)}</span>;
});
