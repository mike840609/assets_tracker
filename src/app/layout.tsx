import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { pickMessages } from "@/lib/i18n-utils";
import "./globals.css";

const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Asset Tracker",
  description: "Track your net worth, assets, and investments",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

async function LocaleHtml({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${className} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="dns-prefetch" href="https://api.frankfurter.app" />
        <link rel="dns-prefetch" href="https://open.er-api.com" />
      </head>
      <body className="h-full flex flex-col md:flex-row overflow-hidden bg-background text-foreground">
        <NextIntlClientProvider messages={pickMessages(messages, ["app", "nav"])}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense>
      <LocaleHtml className={`${geist.variable} ${geistMono.variable}`}>
        {children}
      </LocaleHtml>
    </Suspense>
  );
}
