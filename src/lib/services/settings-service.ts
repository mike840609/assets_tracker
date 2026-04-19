import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLocale } from "next-intl/server";
import { getLocaleDefaultCurrency } from "../currencies";

/**
 * Cached read of user settings. Opts this request branch into the Next.js
 * 16 Cache Components layer so pages that only need settings (e.g.
 * `/settings`, the dashboard shell) can prerender the structural HTML
 * and stream only the dynamic islands.
 *
 * The create-fallback path is kept outside this function because
 * `getLocale()` reads cookies and cannot be called inside a cached
 * function.
 */
async function findSettings(userId: string) {
  "use cache";
  cacheTag("settings");
  cacheTag(`settings:${userId}`);
  cacheLife("minutes");
  return prisma.setting.findUnique({ where: { userId } });
}

async function getOrCreateSettingsInner(userId: string) {
  const existing = await findSettings(userId);
  if (existing) return existing;

  const locale = await getLocale();
  const baseCurrency = getLocaleDefaultCurrency(locale);

  return prisma.setting.create({
    data: {
      userId,
      locale,
      baseCurrency,
    },
  });
}

/**
 * Per-render dedup via React cache(). Cross-request caching is handled
 * by the `"use cache"` directive on `findSettings`.
 */
export const getOrCreateSettings = cache(getOrCreateSettingsInner);
