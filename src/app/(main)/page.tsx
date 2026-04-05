import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("title")}
        </h2>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={userId} />
      </Suspense>
    </div>
  );
}
