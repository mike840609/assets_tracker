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
 * Data-cached settings fetcher (5-minute TTL).
 * Tagged both broadly (`settings`) and per-user (`settings:${userId}`) so
 * `/settings` can rely on a cached read and be invalidated for just the
 * mutating user. React cache() dedupes within a single render.
 */
export const getOrCreateSettings = cache((userId: string) =>
  unstable_cache(
    () => getOrCreateSettingsInner(userId),
    ["user-settings", userId],
    {
      revalidate: 300,
      tags: ["settings", `settings:${userId}`],
    },
  )(),
);
