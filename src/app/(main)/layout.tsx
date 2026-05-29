import { Suspense } from "react";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileMainShell } from "@/components/layout/mobile-main-shell";
import { PullToRefreshIndicator } from "@/components/layout/pull-to-refresh-indicator";
import { PrivacyModeProvider } from "@/components/layout/privacy-mode-context";
import { DensityProvider } from "@/components/layout/density-context";
import { PullToRefreshProvider } from "@/components/layout/pull-to-refresh-context";
import { LargeTitleProvider } from "@/components/layout/large-title-context";
import { LazyCommandPalette } from "@/components/layout/lazy-command-palette";
import { OnboardingProvider } from "@/components/onboarding/onboarding-context";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages } from "@/lib/i18n-utils";
import { getSession } from "@/lib/auth-session";

async function SidebarWithSession() {
  const session = await getSession();
  return (
    <Sidebar userImage={session?.user?.image ?? null} userName={session?.user?.name ?? null} />
  );
}

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();
  return (
    <div className="contents">
      <DensityProvider>
        <NextIntlClientProvider messages={pickMessages(messages, ["onboarding", "common"])}>
          <OnboardingProvider>
            <OnboardingTour />
            <PrivacyModeProvider>
              <LargeTitleProvider>
                <PullToRefreshProvider>
                  <Suspense fallback={<Sidebar userImage={null} userName={null} />}>
                    <SidebarWithSession />
                  </Suspense>
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
          </OnboardingProvider>
        </NextIntlClientProvider>
      </DensityProvider>
    </div>
  );
}
