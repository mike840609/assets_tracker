import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { DataManagement } from "@/components/settings/data-management";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { TutorialCard } from "@/components/onboarding/tutorial-card";
import { signOut } from "@/auth";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { Button } from "@/components/ui/button";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import SettingsLoading from "./loading";

const CLIENT_NAMESPACES = ["settings", "toast", "languages", "dataManagement", "onboarding"];

async function SettingsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  // Run all independent queries in parallel
  const [t, allMessages, settings] = await Promise.all([
    getTranslations("settings"),
    getMessages(),
    getOrCreateSettings(userId),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <SettingsForm currentCurrency={settings.baseCurrency} currentLocale={settings.locale} />
        <DataManagement />
        <InstallAppCard />
        <TutorialCard />

        <div className="mt-8 border-t pt-8 max-w-lg">
          <h3 className="text-lg font-medium text-red-500 mb-4">{t("dangerZone")}</h3>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="destructive" type="submit">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
