import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getCachedAnalysisPayload } from "@/lib/services/analysis-payload-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AnalysisView } from "@/components/analysis/analysis-view";
import AnalysisLoading from "./loading";

const CLIENT_NAMESPACES = ["analysis", "categories", "nav", "trendChart", "history"];

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settingsP = getOrCreateSettings(userId);
  const [t, messages, locale, { snapshots, cashFlowData, rawHistory, accountCashFlow }, settings] =
    await Promise.all([
      getTranslations("analysis"),
      getMessages(),
      getLocale(),
      settingsP.then((s) => getCachedAnalysisPayload(userId, s.baseCurrency)),
      settingsP,
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
