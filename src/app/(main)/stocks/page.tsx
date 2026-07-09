import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getCachedTrackedStocks } from "@/lib/services/stock-watch-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { MobileHubRedirect } from "@/components/layout/mobile-hub-redirect";
import { StockTrackerView } from "@/components/stocks/stock-tracker-view";

const CLIENT_NAMESPACES = ["stocks", "holdingSearch", "common", "freshness", "nav", "toast"];

async function StocksContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const [t, messages, stocks] = await Promise.all([
    getTranslations("stocks"),
    getMessages(),
    getCachedTrackedStocks(session.user.id),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <MobileHubRedirect hash="#watchlist" />
      <div className="hidden space-y-4 md:block md:space-y-8 md:animate-in md:fade-in md:duration-200">
        <div>
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <StockTrackerView stocks={stocks} />
      </div>
    </NextIntlClientProvider>
  );
}

export default function StocksPage() {
  return <StocksContent />;
}
