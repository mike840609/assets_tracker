export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
] as const;

export function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency?.symbol ?? code;
}

export interface FormatCurrencyOptions {
  compact?: boolean;
  decimals?: number;
  minDecimals?: number;
  maxDecimals?: number;
  locale?: string;
}

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  amount: number,
  currencyCode: string,
  compactOrOptions: boolean | FormatCurrencyOptions = false,
): string {
  const options: FormatCurrencyOptions =
    typeof compactOrOptions === "boolean" ? { compact: compactOrOptions } : compactOrOptions;

  const locale = options.locale || "en-US";
  const notation = options.compact && Math.abs(amount) >= 10000 ? "compact" : "standard";
  const minDecimals =
    options.minDecimals ?? (options.decimals !== undefined ? options.decimals : 0);
  const maxDecimals =
    options.maxDecimals ?? (options.decimals !== undefined ? options.decimals : 0);

  const cacheKey = `${locale}:${currencyCode}:${notation}:${minDecimals}:${maxDecimals}`;

  try {
    let formatter = currencyFormatterCache.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        notation,
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      });
      currencyFormatterCache.set(cacheKey, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${currencyCode} ${minDecimals > 0 ? amount.toFixed(minDecimals) : Math.round(amount)}`;
  }
}

export function formatPrice(
  price: number | null | undefined,
  currencyCode: string,
  options?: { locale?: string; maxDecimals?: number },
): string {
  if (price === null || price === undefined) return "—";
  if (isNaN(price)) return "—";

  const absPrice = Math.abs(price);
  let minDecimals = 2;
  let maxDecimals = 2;

  if (absPrice === 0) {
    minDecimals = 2;
    maxDecimals = 2;
  } else if (absPrice < 1) {
    minDecimals = 2;
    maxDecimals = options?.maxDecimals ?? 6;
  } else if (absPrice < 100) {
    minDecimals = 2;
    maxDecimals = options?.maxDecimals ?? 4;
  } else {
    minDecimals = 2;
    maxDecimals = options?.maxDecimals ?? 2;
  }

  return formatCurrency(price, currencyCode, {
    locale: options?.locale,
    minDecimals,
    maxDecimals,
  });
}

export function formatNumber(amount: number, decimals = 2): string {
  let formatter = numberFormatterCache.get(String(decimals));
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatterCache.set(String(decimals), formatter);
  }
  return formatter.format(amount);
}

export function formatQuantity(qty: number, assetType: string): string {
  if (assetType === "OPTION") return formatNumber(qty, 0);
  const decimals = assetType === "CRYPTO" ? 7 : 2;
  return formatNumber(qty, decimals);
}

export function getLocaleDefaultCurrency(locale: string): string {
  if (locale.includes("zh-TW")) return "TWD";
  return "USD";
}
