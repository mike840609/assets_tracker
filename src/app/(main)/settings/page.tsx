import { SettingsForm } from "@/components/settings/settings-form";
import { DataManagement } from "@/components/settings/data-management";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { PrivacySecurity } from "@/components/settings/privacy-security";
import { signOut } from "@/auth";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";

const CLIENT_NAMESPACES = ["settings", "toast", "languages", "dataManagement", "freshness"];

async function SettingsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  // Run all independent queries in parallel
  const [t, allMessages, settings, latestPrice, latestExchangeRate] = await Promise.all([
    getTranslations("settings"),
    getMessages(),
    getOrCreateSettings(userId),
    prisma.priceCache.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.exchangeRate.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <div className="space-y-10 max-w-2xl pb-16 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <SettingsForm
          currentCurrency={settings.baseCurrency}
          currentLocale={settings.locale}
          lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
          lastExchangeRateUpdate={latestExchangeRate?.updatedAt?.toISOString() ?? null}
        />
        <PrivacySecurity
          userEmail={session.user.email}
          signOutAction={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        />
        <DataManagement />
        <InstallAppCard />
      </div>
    </NextIntlClientProvider>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
