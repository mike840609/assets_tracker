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

        {/* Single column on mobile; on desktop the tall preferences form sits
            beside a stack of the shorter cards so wide monitors aren't a narrow
            column floating in empty space. items-start keeps columns independent.
            At xl+ the Version and Install cards pair up in a 2-col sub-grid so
            the right column doesn't have a long tail of narrow single-row cards. */}
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-10">
          <SettingsForm
            currentCurrency={settings.baseCurrency}
            currentLocale={settings.locale}
            lastPriceUpdate={latestPrice?.updatedAt?.toISOString() ?? null}
            lastExchangeRateUpdate={latestExchangeRate?.updatedAt?.toISOString() ?? null}
          />
          <div className="space-y-8 lg:space-y-10">
            <PrivacySecurity
              userEmail={session.user.email}
              signOutAction={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            />
            {/* Utility cluster: tighter internal spacing, visually subordinate
                to Privacy & Security above. Version + Install pair at xl+. */}
            <div className="space-y-5">
              <DataManagement />
              <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                <VersionCard />
                <InstallAppCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
