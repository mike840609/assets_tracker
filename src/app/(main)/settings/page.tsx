import { SettingsForm } from "@/components/settings/settings-form";
import { DataManagement } from "@/components/settings/data-management";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { signOut } from "@/auth";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { Button } from "@/components/ui/button";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";

const CLIENT_NAMESPACES = ["settings", "toast", "languages", "dataManagement"];

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
      <div className="space-y-10 max-w-2xl pb-16 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <SettingsForm
          currentCurrency={settings.baseCurrency}
          currentLocale={settings.locale}
          currentStockColorScheme={settings.stockColorScheme}
        />
        <DataManagement />
        <InstallAppCard />

        <section className="space-y-3 w-full border-t pt-10">
          <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
            {t("dangerZone")}
          </h3>
          <div className="border border-destructive/20 bg-destructive/5 rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">{t("signOut")}</p>
                <p className="text-sm text-muted-foreground">{t("signOutDesc")}</p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
                className="w-full sm:w-auto"
              >
                <Button variant="destructive" type="submit" className="w-full min-w-[200px]">
                  {t("signOut")}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </NextIntlClientProvider>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
