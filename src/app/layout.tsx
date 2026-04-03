import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asset Tracker",
  description: "Track your net worth, assets, and investments",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 relative w-full">
          {/* Subtle background decoration */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-chart-4/5 blur-3xl pointer-events-none -z-10" />
          <div className="mx-auto w-full max-w-6xl p-4 md:p-6 relative z-0">{children}</div>
        </main>
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
