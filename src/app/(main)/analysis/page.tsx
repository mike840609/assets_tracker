import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getCachedAnalysisPayload } from "@/lib/services/analysis-payload-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { AnalysisView } from "@/components/analysis/analysis-view";
import { countActiveAccounts } from "@/lib/services/account-service";

const CLIENT_NAMESPACES = ["analysis", "categories", "nav", "trendChart", "history", "freshness"];

async function AnalysisContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // The payload is the slowest read on this page (five DB queries + the
  // per-range aggregation), so it starts as soon as its settings/base-currency
  // input resolves rather than after every other await.
  const settingsP = getOrCreateSettings(userId);
  const payloadP = settingsP.then((s) => getCachedAnalysisPayload(userId, s.baseCurrency));

  const [
    t,
    messages,
    settings,
    accountCount,
    { seriesByRange, investmentCostBasis, snapshots, meta },
  ] = await Promise.all([
    getTranslations("analysis"),
    getMessages(),
    settingsP,
    countActiveAccounts(userId),
    payloadP,
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <AnalysisView
          seriesByRange={seriesByRange}
          investmentCostBasis={investmentCostBasis}
          snapshots={snapshots}
          meta={meta}
          baseCurrency={settings.baseCurrency}
          hasAccounts={accountCount > 0}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function AnalysisPage() {
  return <AnalysisContent />;
}
