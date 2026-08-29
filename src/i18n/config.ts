export const SUPPORTED_LOCALES = ["en-US", "zh-TW"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en-US";

export function detectLocaleFromAcceptLanguage(acceptLanguage: string): Locale {
  const candidates = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [languageTag, ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) => /^\s*q\s*=/i.test(parameter));
      const qualityMatch = qualityParameter?.match(/^\s*q\s*=\s*([0-9.]+)\s*$/i);
      const quality = qualityParameter ? (qualityMatch ? Number(qualityMatch[1]) : 0) : 1;

      return { languageTag: languageTag.toLowerCase(), quality, index };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { languageTag } of candidates) {
    if (languageTag === "zh" || languageTag.startsWith("zh-")) return "zh-TW";
    if (languageTag === "en" || languageTag.startsWith("en-")) return "en-US";
  }

  return DEFAULT_LOCALE;
}
