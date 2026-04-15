import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLocale } from "next-intl/server";
import { getLocaleDefaultCurrency } from "../currencies";

/**
 * Inner settings fetcher — plain async function, no cache wrappers here.
 * Falls back to creating default settings if none exist.
 */
async function getOrCreateSettingsInner(userId: string) {
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
}

/**
 * Data-cached settings fetcher (5-minute TTL, invalidated by "settings" tag).
 * Wrapped in React cache() so duplicate calls within the same render are deduped.
 */
export const getOrCreateSettings = cache(
  unstable_cache(getOrCreateSettingsInner, ["user-settings"], {
    revalidate: 300,
    tags: ["settings"],
  })
);
