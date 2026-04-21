import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getFullNormalizedHistory } from "@/lib/services/history-service";
import { pickMessages } from "@/lib/i18n-utils";
import { AnalysisView } from "@/components/analysis/analysis-view";
import AnalysisLoading from "./loading";

export const revalidate = 900;

const CLIENT_NAMESPACES = ["analysis"];

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await getOrCreateSettings(userId);
  const [t, messages, snapshots, locale] = await Promise.all([
    getTranslations("analysis"),
    getMessages(),
    getFullNormalizedHistory(userId, settings.baseCurrency),
    getLocale(),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("title")}
        </h2>

        <AnalysisView
          snapshots={snapshots}
          baseCurrency={settings.baseCurrency}
          locale={locale}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <AnalysisContent />
    </Suspense>
  );
}
