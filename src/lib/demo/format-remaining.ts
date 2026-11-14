// A plain duration ("24 hours", "24 小時"), not a relative time: the message
// already reads "{duration} remaining" / "剩餘 {duration}".
export function formatRemaining(locale: string, remainingMs: number) {
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  const [value, unit] =
    remainingMinutes < 60
      ? [remainingMinutes, "minute"]
      : [Math.ceil(remainingMinutes / 60), "hour"];
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(value);
}
