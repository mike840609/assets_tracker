/** Formats a YYYY-MM-DD calendar day as a localized medium date (e.g. "Jun 15, 2026"). */
export function formatRunDate(dateOnly: string): string {
  // Parse as local midnight so the displayed day matches the stored calendar day.
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateOnly;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
