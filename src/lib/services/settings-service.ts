import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLocale } from "next-intl/server";
import { getLocaleDefaultCurrency } from "../currencies";

/**
 * React-cached settings fetcher (deduplicates within a single render).
 * Falls back to creating default settings if none exist.
 */
const getOrCreateSettingsInner = cache(async function getOrCreateSettings(userId: string) {
  let settings = await prisma.setting.findUnique({ where: { userId } });

  if (!settings) {
    const locale = await getLocale();
    const baseCurrency = getLocaleDefaultCurrency(locale);

    settings = await prisma.setting.create({
      data: {
        userId,
        locale,
        baseCurrency,
      },
    });
  }

  return settings;
});

/**
 * Cached version of settings fetch (30-second TTL, invalidated by "settings" tag).
 * Avoids a DB round-trip on every page load when settings haven't changed.
 */
export const getOrCreateSettings = unstable_cache(
  async (userId: string) => getOrCreateSettingsInner(userId),
  ["user-settings"],
  { revalidate: 30, tags: ["settings"] }
);
