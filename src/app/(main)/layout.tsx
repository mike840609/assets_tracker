import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileMainShell } from "@/components/layout/mobile-main-shell";
import { PullToRefreshIndicator } from "@/components/layout/pull-to-refresh-indicator";
import { PrivacyModeProvider } from "@/components/layout/privacy-mode-context";
import { DensityProvider } from "@/components/layout/density-context";
import { PullToRefreshProvider } from "@/components/layout/pull-to-refresh-context";
import { LargeTitleProvider } from "@/components/layout/large-title-context";
import { LazyCommandPalette } from "@/components/layout/lazy-command-palette";
import { AppLoadingShell } from "@/components/layout/app-loading-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { getSession } from "@/lib/auth-session";
import { APP_VERSION } from "@/lib/changelog";

async function AuthenticatedMainLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  if (!session?.user?.id) redirect("/login?stale-session=1");

  // Seed the sidebar's collapsed width from the cookie so SSR matches the saved
  // preference (no expanded→collapsed flash on reload).
  const defaultCollapsed = cookieStore.get("asset-tracker:sidebar-collapsed")?.value === "1";

  return (
    <div className="contents">
      <DensityProvider>
        <PrivacyModeProvider>
          <LargeTitleProvider>
            <PullToRefreshProvider>
              <Sidebar
                userImage={session.user.image ?? null}
                userName={session.user.name ?? null}
                defaultCollapsed={defaultCollapsed}
                appVersion={APP_VERSION}
              />
              <PullToRefreshIndicator />
              <MobileMainShell>
                <MobileHeader />
                <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
              </MobileMainShell>
              <MobileNav />
              <LazyCommandPalette />
            </PullToRefreshProvider>
          </LargeTitleProvider>
        </PrivacyModeProvider>
      </DensityProvider>
    </div>
  );
}

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <AppLoadingShell>
          <DashboardSkeleton />
        </AppLoadingShell>
      }
    >
      <AuthenticatedMainLayout>{children}</AuthenticatedMainLayout>
    </Suspense>
  );
}
