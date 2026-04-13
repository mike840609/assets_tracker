import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LazyTrendChart } from "@/components/dashboard/lazy-charts";
import { HistoryTable } from "@/components/history/history-table";
import { getNormalizedHistory } from "@/lib/services/history-service";
import HistoryLoading from "./loading";

const CLIENT_NAMESPACES = ["trendChart", "history"];

async function HistoryContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [t, allMessages, settings] = await Promise.all([
    getTranslations("history"),
    getMessages(),
    getOrCreateSettings(userId),
  ]);

  const snapshots = await getNormalizedHistory(userId, settings.baseCurrency);

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("title")}
        </h2>

        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
          <LazyTrendChart baseCurrency={settings.baseCurrency} snapshots={snapshots} hideRangeFilter />
        </div>

        <div className="bg-card border border-border/50 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] rounded-xl p-1 card-gradient transition-shadow hover:shadow-lg">
          <HistoryTable snapshots={snapshots} baseCurrency={settings.baseCurrency} />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <HistoryContent />
    </Suspense>
  );
}
