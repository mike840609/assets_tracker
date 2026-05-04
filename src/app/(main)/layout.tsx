import { Suspense } from "react";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileMainShell } from "@/components/layout/mobile-main-shell";
import { PullToRefreshIndicator } from "@/components/layout/pull-to-refresh-indicator";
import { PrivacyModeProvider } from "@/components/layout/privacy-mode-context";
import { DensityProvider } from "@/components/layout/density-context";
import { PullToRefreshProvider } from "@/components/layout/pull-to-refresh-context";
import { LargeTitleProvider } from "@/components/layout/large-title-context";
import { DesktopCommandPalette } from "@/components/layout/desktop-command-palette";
import { getSession } from "@/lib/auth-session";

async function SidebarWithSession() {
  const session = await getSession();
  return (
    <Sidebar
      userImage={session?.user?.image ?? null}
      userName={session?.user?.name ?? null}
    />
  );
}

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DensityProvider>
      <PrivacyModeProvider>
        <LargeTitleProvider>
          <PullToRefreshProvider>
            <Suspense fallback={<Sidebar userImage={null} userName={null} />}>
              <SidebarWithSession />
            </Suspense>
            <PullToRefreshIndicator />
            <MobileMainShell>
              <MobileHeader />
              <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
            </MobileMainShell>
            <MobileNav />
            <DesktopCommandPalette />
          </PullToRefreshProvider>
        </LargeTitleProvider>
      </PrivacyModeProvider>
    </DensityProvider>
  );
}
