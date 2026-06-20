import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ColorSchemaProvider } from "@/components/layout/color-schema-context";
import { LazyToaster } from "@/components/layout/lazy-toaster";
import { CustomSpeedInsights } from "@/components/layout/speed-insights";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { AppLoadingShell } from "@/components/layout/app-loading-shell";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages } from "@/lib/i18n-utils";
import "./globals.css";

const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist",
  display: "swap",
  preload: true,
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://assets-tracker-ct.vercel.app"),
  title: "Assets Tracker",
  description: "Track your net worth, assets, and investments",
  appleWebApp: {
    capable: true,
    title: "Assets Tracker",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Assets Tracker",
    description: "Track your net worth, assets, and investments",
    url: "https://assets-tracker-ct.vercel.app",
    siteName: "Assets Tracker",
    images: [{ url: "/opengraph-image.png", width: 1024, height: 682, alt: "Assets Tracker" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Assets Tracker",
    description: "Track your net worth, assets, and investments",
    images: ["/twitter-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#000d0e" },
  ],
};

const enableVercelInsights = process.env.VERCEL === "1";

/**
 * Reads locale from NEXT_LOCALE cookie / Accept-Language header and
 * provides messages to client components. Wrapped in Suspense in the
 * root layout so the <html>/<body> shell is prerenderable without a
 * cookie read.
 */
async function LocaleProviders({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      messages={pickMessages(messages, ["app", "nav", "commandPalette", "common", "errors"])}
    >
      <HtmlLangSync />
      {children}
    </NextIntlClientProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://api.frankfurter.app" />
        <link rel="dns-prefetch" href="https://open.er-api.com" />
      </head>
      <body className="h-full flex flex-col md:flex-row overflow-hidden bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ColorSchemaProvider>
            {/*
             * LocaleProviders reads the NEXT_LOCALE cookie — a runtime API.
             * Suspense keeps this cookie read out of the prerender pass so
             * static routes can produce a ◐ (Partial Prerender) shell.
             * The fallback is a non-null element to avoid the Next.js
             * "empty fallback above document body" anti-pattern.
             */}
            <Suspense fallback={<AppLoadingShell />}>
              <LocaleProviders>{children}</LocaleProviders>
            </Suspense>
            <LazyToaster />
            {enableVercelInsights ? (
              <>
                <Analytics />
                <CustomSpeedInsights />
              </>
            ) : null}
          </ColorSchemaProvider>
        </ThemeProvider>
        <Script id="pwa-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        `}</Script>
      </body>
    </html>
  );
}
