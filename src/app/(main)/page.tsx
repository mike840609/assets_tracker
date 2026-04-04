import { Suspense } from "react";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [dbUser, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.setting.findUnique({ where: { userId } }),
  ]);

  if (!dbUser) {
    const { redirect } = await import("next/navigation");
    redirect("/api/auth/signout");
  }

  const baseCurrency = settings?.baseCurrency ?? "USD";

  if (!settings) {
    prisma.setting.create({ data: { userId, baseCurrency: "USD" } }).catch(() => {});
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Dashboard
        </h2>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={userId} baseCurrency={baseCurrency} />
      </Suspense>
    </div>
  );
}
