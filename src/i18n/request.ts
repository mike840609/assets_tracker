import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  detectLocaleFromAcceptLanguage,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from "./config";

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale };

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
    messages,
  };
});
