import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  getFullNormalizedHistory,
  getRawHistoryWithBreakdown,
  getMonthlyCashFlow,
} from "@/lib/services/history-service";
import { pickMessages } from "@/lib/i18n-utils";
import { AnalysisView } from "@/components/analysis/analysis-view";
import { AnalysisPullRefresh } from "@/components/analysis/analysis-pull-refresh";
import AnalysisLoading from "./loading";

const CLIENT_NAMESPACES = ["analysis", "categories"];

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await getOrCreateSettings(userId);
  const [t, messages, snapshots, cashFlowData, rawHistory, locale] = await Promise.all([
    getTranslations("analysis"),
    getMessages(),
    getFullNormalizedHistory(userId, settings.baseCurrency),
    getMonthlyCashFlow(userId, settings.baseCurrency),
    getRawHistoryWithBreakdown(userId, settings.baseCurrency),
    getLocale(),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <AnalysisPullRefresh>
        <div className="space-y-8 animate-in fade-in duration-500">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h2>

          <AnalysisView
            snapshots={snapshots}
            cashFlowData={cashFlowData}
            rawHistory={rawHistory}
            baseCurrency={settings.baseCurrency}
            locale={locale}
          />
        </div>
      </AnalysisPullRefresh>
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
