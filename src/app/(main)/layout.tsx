import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { OnboardingCheck } from "@/components/onboarding/onboarding-check";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 relative w-full">
        <MobileHeader />
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
      </main>
      <MobileNav />
      <OnboardingCheck />
    </>
  );
}
