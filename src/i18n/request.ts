import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "./config";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale };

function detectLocaleFromAcceptLanguage(acceptLanguage: string): Locale {
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("zh")) return "zh-TW";
  return "en-US";
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

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
