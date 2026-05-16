import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import {
  getFullNormalizedHistory,
  getRawHistoryWithBreakdown,
  getMonthlyCashFlow,
  getAccountMonthlyCashFlow,
} from "@/lib/services/history-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AnalysisView } from "@/components/analysis/analysis-view";
import AnalysisLoading from "./loading";

const CLIENT_NAMESPACES = ["analysis", "categories"];

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await getOrCreateSettings(userId);
  const [t, messages, snapshots, cashFlowData, rawHistory, accountCashFlow, locale] =
    await Promise.all([
      getTranslations("analysis"),
      getMessages(),
      getFullNormalizedHistory(userId, settings.baseCurrency),
      getMonthlyCashFlow(userId, settings.baseCurrency),
      getRawHistoryWithBreakdown(userId, settings.baseCurrency),
      getAccountMonthlyCashFlow(userId, settings.baseCurrency),
      getLocale(),
    ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <AnalysisView
          snapshots={snapshots}
          cashFlowData={cashFlowData}
          rawHistory={rawHistory}
          accountCashFlow={accountCashFlow}
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
