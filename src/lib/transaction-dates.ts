// Effective-date helpers for the account transaction ledger (#500).
//
// Cash transactions may carry an `occurrenceDate` — the calendar day the cash
// flow actually happened, stored as UTC midnight (`@db.Date`). Everywhere the
// ledger is displayed or ordered, the effective date is
// `occurrenceDate ?? createdAt` (the same fallback the analysis pipeline uses
// since PR #499), so a backdated entry shows up on its real date.

export interface TransactionDateFields {
  id: string;
  createdAt: string;
  occurrenceDate?: string | null;
}

/** Effective instant (ms since epoch) used to order ledger rows. */
export function effectiveTransactionTime(tx: TransactionDateFields): number {
  return new Date(tx.occurrenceDate ?? tx.createdAt).getTime();
}

/**
 * Newest-first comparator: effective date, then createdAt, then id — the same
 * tie-break direction as the server's `ORDER BY "createdAt" DESC, id DESC`.
 */
export function compareTransactionsDesc(
  a: TransactionDateFields,
  b: TransactionDateFields,
): number {
  const byEffective = effectiveTransactionTime(b) - effectiveTransactionTime(a);
  if (byEffective !== 0) return byEffective;
  const byCreated = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (byCreated !== 0) return byCreated;
  return b.id.localeCompare(a.id);
}

/**
 * Localized day label for the ledger's date group headers. `occurrenceDate`
 * is a date-only value pinned to UTC midnight, so it must be formatted in UTC
 * — formatting it in a western-hemisphere local zone would render the
 * previous day.
 */
export function formatTransactionDateKey(tx: TransactionDateFields, locale?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  if (tx.occurrenceDate) {
    return new Date(tx.occurrenceDate).toLocaleDateString(locale, {
      ...options,
      timeZone: "UTC",
    });
  }
  return new Date(tx.createdAt).toLocaleDateString(locale, options);
}

/**
 * True when a form's YYYY-MM-DD date value is before the user's local today.
 * Drives the "past net-worth history isn't recalculated" disclosure caption —
 * client-local today is deliberate; exactness doesn't matter for a caption.
 */
export function isBackdated(dateOnly: string, now: Date = new Date()): boolean {
  if (!dateOnly) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return dateOnly < today;
}
