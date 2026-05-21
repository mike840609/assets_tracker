import { Suspense } from "react";
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
import SettingsLoading from "./loading";

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
      <div className="space-y-5 max-w-2xl pb-16 animate-in fade-in duration-200 md:space-y-10">
        <div className="flex flex-col space-y-3 md:space-y-4">
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          <div className="bg-muted/50 p-3 rounded-lg border w-full md:p-4">
            <h3 className="font-semibold text-sm mb-1">{t("appPhilosophy")}</h3>
            <p className="line-clamp-1 text-sm text-muted-foreground leading-relaxed sm:line-clamp-none">
              {t("appDescription")}
            </p>
          </div>
        </div>

        <SettingsForm currentCurrency={settings.baseCurrency} currentLocale={settings.locale} />
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
                <Button
                  variant="destructive"
                  type="submit"
                  className="min-h-11 w-full min-w-[200px] md:min-h-8"
                >
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
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
