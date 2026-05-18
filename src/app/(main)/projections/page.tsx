import { Suspense } from "react";
import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getSession } from "@/lib/auth-session";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getProjectionData } from "@/lib/services/projection-service";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";
import { ProjectionView } from "@/components/projections/projection-view";
import ProjectionsLoading from "./loading";

const CLIENT_NAMESPACES = ["projections"];

async function ProjectionsContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settingsP = getOrCreateSettings(userId);
  const [t, messages, projectionData, settings] = await Promise.all([
    getTranslations("projections"),
    getMessages(),
    settingsP.then((s) => getProjectionData(userId, s.baseCurrency)),
    settingsP,
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
        <LargeTitleHeading>{t("title")}</LargeTitleHeading>

        <ProjectionView
          latestNetWorth={projectionData.latestNetWorth}
          trailing12mSavings={projectionData.trailing12mSavings}
          annualSnapshots={projectionData.annualSnapshots}
          hasData={projectionData.hasData}
          baseCurrency={settings.baseCurrency}
        />
      </div>
    </NextIntlClientProvider>
  );
}

export default function ProjectionsPage() {
  return (
    <Suspense fallback={<ProjectionsLoading />}>
      <ProjectionsContent />
    </Suspense>
  );
}
