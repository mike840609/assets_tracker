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
import { Skeleton } from "@/components/ui/skeleton";
import { isPublicDemoEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "astt — Self-hosted Net Worth & Portfolio Tracker",
  description:
    "Open-source, self-hosted net worth and portfolio tracker. Accounts, investments, property, liabilities, and long-term goals — multi-currency, on your own database.",
  alternates: { canonical: "/" },
};

function FeatureSkeletonList({ count }: { count: number }) {
  return (
    <div className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex gap-3.5">
          <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LandingSkeleton() {
  return (
    <div
      className="dark landing-theme h-dvh w-full overflow-x-hidden overflow-y-auto bg-background text-foreground"
      aria-busy="true"
    >
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-4 w-9" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Skeleton className="h-11 w-24 rounded-lg md:h-9 md:w-20" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-9 md:w-9" />
            <Skeleton className="h-11 w-20 rounded-lg md:h-9 md:w-16" />
          </div>
        </div>
      </header>

      <main>
        <section
          className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20 ${
            isPublicDemoEnabled
              ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-16"
              : "lg:max-w-4xl"
          }`}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-9 w-full max-w-2xl sm:h-10" />
              <Skeleton className="h-9 w-4/5 max-w-xl sm:h-10" />
            </div>
            <div className="max-w-prose space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-12 w-36 rounded-xl" />
              <Skeleton className="h-12 w-40 rounded-xl" />
            </div>
            <Skeleton className="h-3 w-64" />
          </div>

          {isPublicDemoEnabled ? (
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 sm:p-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="mt-4 h-12 w-full rounded-xl" />
              <Skeleton className="mx-auto mt-3 h-3 w-3/4" />
            </div>
          ) : null}
        </section>

        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-prose" />
            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-12">
              <div className="lg:col-span-2">
                <Skeleton className="h-4 w-40" />
                <FeatureSkeletonList count={4} />
              </div>
              <div>
                <Skeleton className="h-4 w-44" />
                <FeatureSkeletonList count={2} />
              </div>
              <div>
                <Skeleton className="h-4 w-56 max-w-full" />
                <FeatureSkeletonList count={2} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-prose" />
            <div className="mt-8 space-y-10">
              <div>
                <Skeleton className="h-4 w-28" />
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="aspect-[3/2] w-full rounded-xl" />
                      <Skeleton className="h-4 w-3/4 max-w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-4 w-28" />
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {Array.from({ length: 2 }, (_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="mx-auto flex aspect-[390/844] w-full max-w-[16rem] items-start justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 sm:max-w-[17rem]">
                        <Skeleton className="h-full w-full rounded-xl" />
                      </div>
                      <Skeleton className="h-4 w-3/4 max-w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-prose" />
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5 max-w-full" />
                  </div>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-11 w-28 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/50">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-center sm:px-6 lg:py-20">
            <Skeleton className="mx-auto h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="mx-auto mt-2 h-12 w-36 rounded-xl" />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-16 rounded-lg md:h-5" />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <LandingContent />
    </Suspense>
  );
}
