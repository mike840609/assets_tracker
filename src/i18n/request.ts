import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "./config";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale };

function detectLocaleFromAcceptLanguage(acceptLanguage: string): Locale {
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("zh")) return "zh-TW";
  return "en-US";
}

/**
 * Phase-1 branding normalization.
 *
 * Keep the locale catalogs structurally untouched while the public product name
 * moves from Assets Tracker / 資產追蹤器 to astt. This changes display copy only;
 * technical identifiers, storage keys, and backup formats remain compatible.
 */
function applyAsttBranding<T>(value: T): T {
  if (typeof value === "string") {
    return value.replaceAll("Assets Tracker", "astt").replaceAll("資產追蹤器", "astt") as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyAsttBranding(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, applyAsttBranding(item)]),
    ) as T;
  }

  return value;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  let locale: Locale = DEFAULT_LOCALE;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale;
  } else {
    const headerStore = await headers();
    const acceptLanguage = headerStore.get("accept-language") ?? "";
    locale = detectLocaleFromAcceptLanguage(acceptLanguage);
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages: applyAsttBranding(messages),
  };
});
