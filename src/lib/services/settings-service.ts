import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getLocale } from "next-intl/server";
import { getLocaleDefaultCurrency } from "../currencies";

export const getOrCreateSettings = cache(async function getOrCreateSettings(userId: string) {
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
