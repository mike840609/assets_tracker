import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ColorSchemaProvider } from "@/components/layout/color-schema-context";
import { LazyToaster } from "@/components/layout/lazy-toaster";
import { CustomSpeedInsights } from "@/components/layout/speed-insights";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
    startupImage: [
      // iPhone 16 Pro Max (6.9")
      {
        url: "/splash/iphone-16-pro-max-dark.svg",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-16-pro-max-light.svg",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 16 Pro (6.3")
      {
        url: "/splash/iphone-16-pro-dark.svg",
        media:
          "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-16-pro-light.svg",
        media:
          "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 16 Plus / 15 Plus / 14 Pro Max (6.7")
      {
        url: "/splash/iphone-16-plus-dark.svg",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-16-plus-light.svg",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 16 / 15 / 15 Pro / 14 Pro (6.1" notch)
      {
        url: "/splash/iphone-16-dark.svg",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-16-light.svg",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 14 / 13 / 13 Pro / 12 / 12 Pro (6.1" notch)
      {
        url: "/splash/iphone-14-dark.svg",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-14-light.svg",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
      {
        url: "/splash/iphone-14-plus-dark.svg",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-14-plus-light.svg",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 13 mini / 12 mini
      {
        url: "/splash/iphone-13-mini-dark.svg",
        media:
          "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-13-mini-light.svg",
        media:
          "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 11 Pro Max / XS Max
      {
        url: "/splash/iphone-11-pro-max-dark.svg",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-11-pro-max-light.svg",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 11 / XR
      {
        url: "/splash/iphone-xr-dark.svg",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-xr-light.svg",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPhone X / XS / 11 Pro
      {
        url: "/splash/iphone-x-dark.svg",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-x-light.svg",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone SE 3rd / 8 / 7 / 6s
      {
        url: "/splash/iphone-se-dark.svg",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-se-light.svg",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPhone 8 Plus / 7 Plus / 6s Plus
      {
        url: "/splash/iphone-8-plus-dark.svg",
        media:
          "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/iphone-8-plus-light.svg",
        media:
          "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPad Pro 12.9"
      {
        url: "/splash/ipad-pro-12-dark.svg",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/ipad-pro-12-light.svg",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad Pro 11"
      {
        url: "/splash/ipad-pro-11-dark.svg",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/ipad-pro-11-light.svg",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad 10th gen
      {
        url: "/splash/ipad-10-dark.svg",
        media:
          "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/ipad-10-light.svg",
        media:
          "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad Air / 10.5" / 9th gen
      {
        url: "/splash/ipad-air-dark.svg",
        media:
          "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/ipad-air-light.svg",
        media:
          "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad mini 6th gen
      {
        url: "/splash/ipad-mini-dark.svg",
        media:
          "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/ipad-mini-light.svg",
        media:
          "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
    ],
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
    { media: "(prefers-color-scheme: dark)", color: "#0d1f1e" },
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
  await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      messages={pickMessages(messages, ["app", "nav", "commandPalette", "common"])}
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
            <Suspense fallback={<span />}>
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
      </body>
    </html>
  );
}
