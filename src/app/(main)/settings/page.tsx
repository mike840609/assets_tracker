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
      <div className="max-w-2xl space-y-6 pb-16 animate-in fade-in duration-200 md:space-y-8">
        <div className="flex flex-col space-y-3">
          <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          <div className="w-full rounded-lg border bg-muted/50 px-3 py-2 md:px-4 md:py-3">
            <h3 className="text-[13px] font-semibold leading-5 md:text-sm">{t("appPhilosophy")}</h3>
            <p className="max-w-[68ch] text-[13px] leading-5 text-muted-foreground [overflow-wrap:anywhere] md:text-sm md:leading-6">
              {t("appDescription")}
            </p>
          </div>
        </div>

        <SettingsForm currentCurrency={settings.baseCurrency} currentLocale={settings.locale} />
        <DataManagement />
        <InstallAppCard />

        <section className="w-full space-y-3 border-t pt-6 md:pt-8">
          <h3 className="flex items-center gap-2 text-base font-semibold text-destructive">
            {t("dangerZone")}
          </h3>
          <div className="overflow-hidden rounded-lg border border-destructive/20 bg-destructive/5">
            <div className="flex flex-col justify-between gap-3 p-3 sm:flex-row sm:items-center md:p-4">
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
