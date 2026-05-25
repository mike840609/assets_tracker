import { getSession } from "@/lib/auth-session";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardPullRefresh } from "@/components/dashboard/dashboard-pull-refresh";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";
import { LargeTitleHeading } from "@/components/layout/large-title-heading";

const CLIENT_NAMESPACES = [
  "dashboardActions",
  "freshness",
  "history",
  "trendChart",
  "allocationChart",
  "currencyExposure",
  "accountsSummary",
  "netWorthCard",
  "goalsMilestone",
  "categories",
  "common",
];

async function DashboardPageContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [t, messages] = await Promise.all([getTranslations("dashboard"), getMessages()]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <DashboardPullRefresh>
        <div className="space-y-4 md:space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <LargeTitleHeading>{t("title")}</LargeTitleHeading>
          </div>

          <DashboardContent userId={userId} />
        </div>
      </DashboardPullRefresh>
    </NextIntlClientProvider>
  );
}

export default function DashboardPage() {
  return <DashboardPageContent />;
}
