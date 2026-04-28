import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardPullRefresh } from "@/components/dashboard/dashboard-pull-refresh";
import { MobileLargeTitle } from "@/components/layout/mobile-large-title";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = [
  "dashboardActions",
  "trendChart",
  "allocationChart",
  "currencyExposure",
  "accountsSummary",
  "netWorthCard",
  "categories",
  "common",
];

async function DashboardPageContent() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const [t, messages] = await Promise.all([
    getTranslations("dashboard"),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES)}>
      <DashboardPullRefresh>
        <div className="space-y-8 animate-in fade-in duration-500">
          <MobileLargeTitle title={t("title")} />

          <DashboardContent userId={userId} />
        </div>
      </DashboardPullRefresh>
    </NextIntlClientProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}
