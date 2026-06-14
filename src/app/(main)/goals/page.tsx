import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getProjectionData } from "@/lib/services/projection-service";
import { getCachedTrackedStocks } from "@/lib/services/stock-watch-service";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { GoalsView } from "@/components/goals/goals-view";
import type { SerializedAccount } from "@/lib/types";

const CLIENT_NAMESPACES = [
  "goals",
  "common",
  "nav",
  "projections",
  "stocks",
  "holdingSearch",
  "freshness",
  "toast",
  "categories",
];

async function GoalsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settingsP = getOrCreateSettings(userId);
  const [t, navT, messages, goalsWithProgress, rawAccounts, projectionData, settings, stocks] =
    await Promise.all([
      getTranslations("goals"),
      getTranslations("nav"),
      getMessages(),
      settingsP.then((s) => computeGoalsWithProgress(userId, s.baseCurrency)),
      fetchUserAccountsWithHoldings(userId),
      settingsP.then((s) => getProjectionData(userId, s.baseCurrency)),
      settingsP,
      getCachedTrackedStocks(userId),
    ]);

  const accounts: SerializedAccount[] = rawAccounts.map(({ holdings: _h, ...rest }) => rest);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>
          <span className="md:hidden">{navT("plan")}</span>
          <span className="hidden md:inline">{t("title")}</span>
        </LargeTitleHeading>
        <GoalsView
          goalsWithProgress={goalsWithProgress}
          baseCurrency={settings.baseCurrency}
          accounts={accounts}
          projectionData={projectionData}
          stocks={stocks}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function GoalsPage() {
  return <GoalsContent />;
}
