import { SettingsForm } from "@/components/settings/settings-form";
import { DataManagement } from "@/components/settings/data-management";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { PrivacySecurity } from "@/components/settings/privacy-security";
import { VersionCard } from "@/components/settings/version-card";
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
      <div className="space-y-8 max-w-2xl lg:max-w-6xl pb-16 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        {/* Single column on mobile. On desktop a 2x3 section grid: each section
            is placed explicitly so its title sits on a shared row line across
            both columns (Preferences↔Privacy, Synchronization↔Data Management,
            Version↔Install). auto-rows-min + items-start anchor every section to
            its row top so the titles align. SettingsForm uses lg:contents so its
            two inner sections become direct grid items. */}
        <div className="grid gap-8 lg:grid-cols-2 lg:auto-rows-min lg:items-start lg:gap-x-10 lg:gap-y-10">
          <SettingsForm
            currentCurrency={settings.baseCurrency}
            currentLocale={settings.locale}
            lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
            lastExchangeRateUpdate={latestExchangeRate?.updatedAt?.toISOString() ?? null}
          />
          <div className="lg:col-start-2 lg:row-start-1">
            <PrivacySecurity
              userEmail={session.user.email}
              signOutAction={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            />
          </div>
          <div className="lg:col-start-2 lg:row-start-2">
            <DataManagement />
          </div>
          <div className="lg:col-start-1 lg:row-start-3">
            <VersionCard />
          </div>
          <div className="lg:col-start-2 lg:row-start-3">
            <InstallAppCard />
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
