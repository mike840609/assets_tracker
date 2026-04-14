import { formatCurrency } from "@/lib/currencies";

/** Currency formatter for area/line chart tooltips (e.g. TrendChart). */
export function createCurrencyTooltipFormatter(currency: string) {
  return (value: unknown) => formatCurrency(Number(value ?? 0), currency);
}

/**
 * Tooltip formatter for pie charts that pre-compute `percentage` on each
 * data point. Returns the Recharts `[label, name]` tuple format.
 */
export function createPieTooltipFormatter(currency: string) {
  return (
    value: number | string | ReadonlyArray<number | string> | undefined,
    name: string | number | undefined,
    props: { payload?: { percentage?: string } }
  ): [string, string | number] => {
    const formatted = formatCurrency(Number(value ?? 0), currency);
    const pct = props?.payload?.percentage ?? "0";
    return [`${formatted} (${pct}%)`, name ?? ""];
  };
}

/** Legend formatter for pie charts — renders name + percentage badge. */
export function createPieLegendFormatter() {
  // eslint-disable-next-line react/display-name
  return (value: string, entry: { payload?: { percentage?: string } }) => {
    const percentage = entry?.payload?.percentage;
    return (
      <span className="inline-flex items-baseline gap-1.5 ml-1 select-none">
        <span className="font-medium text-foreground">{value}</span>
        {percentage && (
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {percentage}%
          </span>
        )}
      </span>
    );
  };
}
