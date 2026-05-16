import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { computeGoalsWithProgress } from "@/lib/services/goal-service";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { GoalsView } from "@/components/goals/goals-view";
import GoalsLoading from "./loading";
import type { SerializedAccount } from "@/lib/types";

const CLIENT_NAMESPACES = ["goals", "common"];

async function GoalsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await getOrCreateSettings(userId);
  const [t, messages, goalsWithProgress, rawAccounts] = await Promise.all([
    getTranslations("goals"),
    getMessages(),
    computeGoalsWithProgress(userId, settings.baseCurrency),
    fetchUserAccountsWithHoldings(userId),
  ]);

  const accounts: SerializedAccount[] = rawAccounts.map(({ holdings: _h, ...rest }) => rest);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>
        <GoalsView
          goalsWithProgress={goalsWithProgress}
          baseCurrency={settings.baseCurrency}
          accounts={accounts}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function GoalsPage() {
  return (
    <Suspense fallback={<GoalsLoading />}>
      <GoalsContent />
    </Suspense>
  );
}
