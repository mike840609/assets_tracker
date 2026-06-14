/**
 * Shared helpers for comma-masked numeric text inputs (cash balances, quantities,
 * cost bases). Several account/holding forms render amounts as the user types with
 * thousands separators; these keep that masking and the inverse parse in one place
 * so the fiddly regex doesn't drift between copies.
 */

/**
 * Live thousands-separator mask for a numeric input value. Strips any existing
 * grouping commas, rejects non-numeric input by returning `null` (the caller
 * should ignore that keystroke and leave state unchanged), and otherwise regroups
 * the integer part while preserving an in-progress decimal (e.g. "1234." → "1,234.").
 */
export function maskAmountInput(value: string): string | null {
  const raw = value.replace(/,/g, "");
  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return null;
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const formatted = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/** Parse a comma-masked amount input value into a number (`NaN` if blank/invalid). */
export function parseAmountInput(value: string): number {
  return parseFloat(value.replace(/,/g, ""));
}

/**
 * Format a parsed number for display in a masked amount input (en-US thousands
 * grouping). Mirrors the inverse of {@link maskAmountInput} for the blur/normalize
 * step that re-renders a validated number with grouping separators.
 */
export function formatAmountInput(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits }).format(value);
}
