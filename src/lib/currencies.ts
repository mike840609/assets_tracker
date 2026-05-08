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

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency?.symbol ?? code;
}

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currencyCode: string, compact = false): string {
  try {
    const notation = compact && Math.abs(amount) >= 10000 ? "compact" : "standard";
    const key = `${currencyCode}:${notation}`;
    let formatter = currencyFormatterCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        notation,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      currencyFormatterCache.set(key, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${currencyCode} ${Math.round(amount)}`;
  }
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
