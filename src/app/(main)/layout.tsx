import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PrivacyModeProvider } from "@/components/layout/privacy-mode-context";
import { getSession } from "@/lib/auth-session";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  return (
    <PrivacyModeProvider>
      <Sidebar userImage={session?.user?.image ?? null} userName={session?.user?.name ?? null} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 relative w-full">
        <MobileHeader />
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
      </main>
      <MobileNav />
    </PrivacyModeProvider>
  );
}
