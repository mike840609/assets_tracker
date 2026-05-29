import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { resolveProjectionData } from "@/lib/services/demo-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { ProjectionView } from "@/components/projections/projection-view";

const CLIENT_NAMESPACES = ["projections"];

async function ProjectionsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settingsP = getOrCreateSettings(userId);
  const [t, messages, projectionData, settings] = await Promise.all([
    getTranslations("projections"),
    getMessages(),
    settingsP.then((s) => resolveProjectionData(userId, s.baseCurrency)),
    settingsP,
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <ProjectionView projectionData={projectionData} baseCurrency={settings.baseCurrency} />
      </div>
    </NextIntlClientProvider>
  );
}

export default function ProjectionsPage() {
  return <ProjectionsContent />;
}
