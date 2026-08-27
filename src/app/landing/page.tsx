// The public landing page. Anonymous requests to "/" are rewritten here by
// src/proxy.ts, so this content is served at https://astt.app itself — the URL
// that directory listings, search engines, and shared links point at.
//
// force-static is incompatible with nextConfig.cacheComponents (PPR mode);
// PPR prerendering the Suspense fallback shell is the correct tier here, and
// the locale cookie read by next-intl is what makes the content dynamic.
import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingContent } from "@/components/landing/landing-content";
import { isPublicDemoEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "astt — Self-hosted Net Worth & Portfolio Tracker",
  description:
    "Open-source, self-hosted net worth and portfolio tracker. Accounts, investments, property, liabilities, and long-term goals — multi-currency, on your own database.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-background">
          <div className="border-b border-border/50">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
              <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
          <div
            className={`mx-auto max-w-6xl space-y-4 px-4 py-14 sm:px-6 ${
              isPublicDemoEnabled ? "" : "lg:max-w-4xl"
            }`}
          >
            <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-full max-w-prose animate-pulse rounded bg-muted" />
            <div className="h-5 w-2/3 max-w-prose animate-pulse rounded bg-muted" />
          </div>
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
