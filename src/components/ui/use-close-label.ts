"use client";

import { useTranslations } from "next-intl";

// Shared by Dialog and Drawer. Some routes nest a NextIntlClientProvider whose
// namespaces omit `common`, so check before translating instead of letting a
// missing key throw inside a UI primitive.
export function useCloseLabel(): string {
  const t = useTranslations();
  return t.has?.("common.close") ? t("common.close") : "Close";
}
