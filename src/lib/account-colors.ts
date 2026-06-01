/**
 * Shared account color palette for the portfolio heatmap and the accounts table.
 *
 * The heatmap encodes account identity by hue (and share by tile area); the
 * accounts table reuses the same hue on each row's allocation bar so a row reads
 * as the 1D analog of its tile. Both must rank accounts identically, hence one
 * source of truth here. Colors are schema-aware design tokens (chart spectrum),
 * not raw palette values, per DESIGN.md's chart-color boundary.
 */
export const ACCOUNT_HEATMAP_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-9)",
  "var(--chart-8)",
  "var(--chart-4)",
] as const;

/**
 * Map asset account ids to a heatmap color. Mirrors the heatmap's assignment:
 * keep positive-value accounts, rank by base-currency value descending, then
 * index into the palette. Accounts with non-positive value are omitted (they
 * have no heatmap tile either).
 */
export function buildAssetAccountColorMap(
  accounts: { id: string; value: number }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  [...accounts]
    .filter((account) => account.value > 0)
    .sort((a, b) => b.value - a.value)
    .forEach((account, index) => {
      map[account.id] = ACCOUNT_HEATMAP_COLORS[index % ACCOUNT_HEATMAP_COLORS.length];
    });
  return map;
}
