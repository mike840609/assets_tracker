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
  hasForeignCurrencySnapshots,
} from "@/lib/services/history-service";
import { countActiveAccounts } from "@/lib/services/account-service";

const CLIENT_NAMESPACES = ["trendChart", "history", "freshness"];

async function HistoryContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const settingsP = getOrCreateSettings(userId);
  const baseCurrencyP = settingsP.then((s) => s.baseCurrency);
  const snapshotsP = Promise.all([baseCurrencyP, settingsP]).then(([currency]) =>
    getFullNormalizedHistory(userId, currency),
  );
  const reconciliationP: ReturnType<typeof getSnapshotReconciliationWarning> = Promise.all([
    snapshotsP,
    baseCurrencyP,
  ]).then(([snapshots, currency]) => getSnapshotReconciliationWarning(userId, currency, snapshots));

  const [allMessages, snapshots, settings, accountCount, reconciliationWarning, converted] =
    await Promise.all([
      getMessages(),
      snapshotsP,
      settingsP,
      countActiveAccounts(userId),
      reconciliationP,
      baseCurrencyP.then((c) => hasForeignCurrencySnapshots(userId, c)),
    ]);

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
          hasConvertedSnapshots={converted}
        />
      </HistoryPullRefresh>
    </NextIntlClientProvider>
  );
}

export default function HistoryPage() {
  return <HistoryContent />;
}
