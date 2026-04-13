import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { pickMessages } from "@/lib/i18n-utils";

const CLIENT_NAMESPACES = [
  "dashboardActions",
  "trendChart",
  "allocationChart",
  "currencyExposure",
  "accountsSummary",
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
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("title")}
          </h2>
        </div>

        <DashboardContent userId={userId} />
      </div>
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
