import { SettingsForm } from "@/components/settings/settings-form";
import { DataManagement } from "@/components/settings/data-management";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { PrivacySecurity } from "@/components/settings/privacy-security";
import { VersionCard } from "@/components/settings/version-card";
import { GitHubMark } from "@/components/settings/github-mark";
import { REPO_URL } from "@/lib/repo";
import { signOut } from "@/auth";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";

const CLIENT_NAMESPACES = [
  "settings",
  "toast",
  "languages",
  "dataManagement",
  "freshness",
  "common",
];

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
        {/* The About card carries the full license statement, but it sits in the
            third grid row — below the fold on landing. This badge puts the
            open-source signal in the header, where it is seen without scrolling. */}
        <div className="space-y-3">
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <GitHubMark className="h-3.5 w-3.5" />
            {t("openSourceBadge")}
          </a>
        </div>

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
