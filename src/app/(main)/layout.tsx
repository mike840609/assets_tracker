import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";

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
        {/* Subtle background decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-chart-4/5 blur-3xl pointer-events-none -z-10" />
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6 relative z-0">{children}</div>
      </main>
      <MobileNav />
    </>
  );
}
