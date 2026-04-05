import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { signOut } from "@/auth";
import { getSession } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = ["settings", "toast", "languages"];

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [t, allMessages] = await Promise.all([
    getTranslations("settings"),
    getMessages(),
  ]);

  let settings = await prisma.setting.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.setting.create({ data: { userId, baseCurrency: "USD", locale: "en-US" } });
  }

  return (
    <NextIntlClientProvider messages={pickMessages(allMessages, CLIENT_NAMESPACES)}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <SettingsForm currentCurrency={settings.baseCurrency} currentLocale={settings.locale} />

        <div className="mt-8 border-t pt-8">
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
