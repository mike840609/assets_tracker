import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { HistoryPullRefresh } from "@/components/history/history-pull-refresh";
import { HistoryView } from "@/components/history/history-view";
import { getFullNormalizedHistory } from "@/lib/services/history-service";

const CLIENT_NAMESPACES = ["trendChart", "history", "freshness"];

async function HistoryContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const settingsP = getOrCreateSettings(userId);
  const [allMessages, snapshots, settings] = await Promise.all([
    getMessages(),
    settingsP.then((s) => getFullNormalizedHistory(userId, s.baseCurrency)),
    settingsP,
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <HistoryPullRefresh>
        <HistoryView
          snapshots={snapshots}
          baseCurrency={settings.baseCurrency}
          showTitle
          className="animate-in fade-in duration-200"
        />
      </HistoryPullRefresh>
    </NextIntlClientProvider>
  );
}

export default function HistoryPage() {
  return <HistoryContent />;
}
