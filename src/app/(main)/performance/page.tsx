import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getNormalizedHistory } from "@/lib/services/history-service";
import { computePerformancePeriods } from "@/lib/performance-utils";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { PerformanceContent } from "@/components/performance/performance-content";

const CLIENT_NAMESPACES = ["performance", "common"];

export default async function PerformancePage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [t, allMessages, settings] = await Promise.all([
    getTranslations("performance"),
    getMessages(),
    getOrCreateSettings(userId),
  ]);

  const snapshots = await getNormalizedHistory(userId, settings.baseCurrency);

  const monthlyData = computePerformancePeriods(snapshots, "monthly");
  const yearlyData = computePerformancePeriods(snapshots, "yearly");

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("title")}
        </h2>

        <PerformanceContent
          monthlyData={monthlyData}
          yearlyData={yearlyData}
          baseCurrency={settings.baseCurrency}
        />
      </div>
    </NextIntlClientProvider>
  );
}
