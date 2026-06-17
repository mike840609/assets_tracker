import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { HistoryPullRefresh } from "@/components/history/history-pull-refresh";
import { HistoryView } from "@/components/history/history-view";
import {
  getFullNormalizedHistory,
  getSnapshotReconciliationWarning,
} from "@/lib/services/history-service";
import { prisma } from "@/lib/prisma";

const CLIENT_NAMESPACES = ["trendChart", "history", "freshness"];

async function HistoryContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const settingsP = getOrCreateSettings(userId);
  const [allMessages, snapshots, settings, accountCount, reconciliationWarning] = await Promise.all(
    [
      getMessages(),
      settingsP.then((s) => getFullNormalizedHistory(userId, s.baseCurrency)),
      settingsP,
      prisma.account.count({ where: { userId, isActive: true } }),
      settingsP.then((s) => getSnapshotReconciliationWarning(userId, s.baseCurrency)),
    ],
  );

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <HistoryPullRefresh>
        <HistoryView
          snapshots={snapshots}
          baseCurrency={settings.baseCurrency}
          showTitle
          className="animate-in fade-in duration-200"
          hasAccounts={accountCount > 0}
          reconciliationWarning={reconciliationWarning}
        />
      </HistoryPullRefresh>
    </NextIntlClientProvider>
  );
}

export default function HistoryPage() {
  return <HistoryContent />;
}
