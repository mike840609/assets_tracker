import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getProjectionData } from "@/lib/services/projection-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { ProjectionView } from "@/components/projections/projection-view";
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";

const CLIENT_NAMESPACES = ["projections"];

async function ProjectionsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settingsP = getOrCreateSettings(userId);
  const [t, messages, projectionData, accounts, settings] = await Promise.all([
    getTranslations("projections"),
    getMessages(),
    settingsP.then((s) => getProjectionData(userId, s.baseCurrency)),
    fetchUserAccountsWithHoldings(userId),
    settingsP,
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <ProjectionView projectionData={projectionData} baseCurrency={settings.baseCurrency} hasAccounts={accounts.length > 0} />
      </div>
    </NextIntlClientProvider>
  );
}

export default function ProjectionsPage() {
  return <ProjectionsContent />;
}
