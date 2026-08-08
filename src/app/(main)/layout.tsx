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
import { FxWarningBanner } from "@/components/layout/fx-warning-banner";
import { DemoModeBanner } from "@/components/demo/demo-mode-banner";
import { DemoResponseBoundary } from "@/components/demo/demo-response-boundary";
import { getAuthContext } from "@/lib/auth-session";
import { APP_VERSION } from "@/lib/changelog";

function SidebarWithSession({
  defaultCollapsed,
  userImage,
  userName,
}: {
  defaultCollapsed: boolean;
  userImage: string | null;
  userName: string | null;
}) {
  return (
    <Sidebar
      userImage={userImage}
      userName={userName}
      defaultCollapsed={defaultCollapsed}
      appVersion={APP_VERSION}
    />
  );
}

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await getAuthContext();
  if (context.status === "demo-expired" || context.status === "demo-disabled") {
    redirect(`/demo/expired?reason=${context.status}`);
  }
  if (context.status !== "active") redirect("/login?stale-session=1");
  const demoExpiry =
    context.principal.kind === "demo" ? context.principal.expiresAt.toISOString() : null;

  // Seed the sidebar's collapsed width from the cookie so SSR matches the saved
  // preference (no expanded→collapsed flash on reload).
  const defaultCollapsed = (await cookies()).get("asset-tracker:sidebar-collapsed")?.value === "1";

  return (
    <div className="contents">
      <DensityProvider>
        <PrivacyModeProvider>
          <LargeTitleProvider>
            <PullToRefreshProvider>
              <Suspense
                fallback={
                  <Sidebar
                    userImage={null}
                    userName={null}
                    defaultCollapsed={defaultCollapsed}
                    appVersion={APP_VERSION}
                  />
                }
              >
                <SidebarWithSession
                  defaultCollapsed={defaultCollapsed}
                  userImage={context.session.user.image ?? null}
                  userName={context.session.user.name ?? null}
                />
              </Suspense>
              <PullToRefreshIndicator />
              <MobileMainShell>
                <div className={demoExpiry ? "sticky top-0 z-40 md:contents" : "contents"}>
                  <MobileHeader disableAutoHide={demoExpiry !== null} />
                  {demoExpiry ? <DemoModeBanner expiresAt={demoExpiry} /> : null}
                </div>
                <div className="mx-auto w-full max-w-7xl 2xl:max-w-[88rem] p-4 md:p-6">
                  <Suspense fallback={null}>
                    <FxWarningBanner />
                  </Suspense>
                  {children}
                </div>
              </MobileMainShell>
              {demoExpiry ? <DemoResponseBoundary /> : null}
              <MobileNav />
              <LazyCommandPalette />
            </PullToRefreshProvider>
          </LargeTitleProvider>
        </PrivacyModeProvider>
      </DensityProvider>
    </div>
  );
}
