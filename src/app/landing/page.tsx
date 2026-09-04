// The public landing page. Anonymous requests to "/" are rewritten here by
// src/proxy.ts, so this content is served at https://astt.app itself — the URL
// that directory listings, search engines, and shared links point at.
//
// force-static is incompatible with nextConfig.cacheComponents (PPR mode);
// PPR prerendering the Suspense fallback shell is the correct tier here, and
// the locale cookie read by next-intl is what makes the visible content dynamic.
//
// Do not put request-bound locale reads in generateMetadata(): Next.js 16.2 can
// resume a different metadata subtree under Cache Components and fall back to
// client rendering with a __next_metadata_boundary__ mismatch. React 19 can
// hoist <title>, <meta>, and <link> tags rendered by a Server Component into
// <head>, so localized metadata stays in the same dynamic Suspense subtree as
// the localized landing content instead of using Next's dynamic Metadata API.
import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LandingContent } from "@/components/landing/landing-content";
import { Skeleton } from "@/components/ui/skeleton";
import { isPublicDemoEnabled } from "@/lib/env";
import { getAppAssetUrl } from "@/lib/app-url";

// Clear route-level fields inherited from the root Metadata API. The localized
// equivalents below are rendered as React 19 document metadata, avoiding
// duplicate title/description/social tags while keeping the Next metadata tree
// request-independent for PPR resume.
export const metadata: Metadata = {
  title: null,
  description: null,
  openGraph: null,
  twitter: null,
};

async function LandingDocumentMetadata() {
  const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()]);
  const title = t("metaTitle");
  const description = t("metaDescription");
  const openGraphLocale = locale === "zh-TW" ? "zh_TW" : "en_US";
  const socialPreviewUrl = getAppAssetUrl("/landing/social-preview.png").toString();

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href="/" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content="/" />
      <meta property="og:site_name" content="astt" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={openGraphLocale} />
      <meta property="og:image" content={socialPreviewUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="astt landing page" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialPreviewUrl} />
    </>
  );
}

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
      className="dark landing-theme h-dvh w-full scroll-smooth motion-reduce:scroll-auto overflow-x-hidden overflow-y-auto bg-background text-foreground"
      aria-busy="true"
    >
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-4 w-9" />
          </div>
          <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 md:flex md:flex-nowrap">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-20 shrink-0 rounded-lg md:h-9" />
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Skeleton className="h-11 w-24 rounded-lg md:h-9 md:w-20" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-9 md:w-9" />
            <Skeleton className="h-11 w-20 rounded-lg md:h-9 md:w-16" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-16 lg:py-20">
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

          <div className="space-y-4">
            <div className="mx-auto aspect-[390/848] w-full max-w-[15rem] lg:hidden">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
            <div className="hidden space-y-1.5 lg:block">
              <div className="rounded-xl border border-border/70 bg-card/90 p-1.5 shadow-sm">
                <Skeleton className="mx-2 h-4 w-16" />
                <Skeleton className="aspect-[1430/927] w-full rounded-xl" />
              </div>
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
          </div>
        </section>

        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-prose" />
            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-12">
              <div className="lg:col-span-2">
                <Skeleton className="h-4 w-40" />
                <FeatureSkeletonList count={5} />
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
            <div className="mt-5 flex flex-wrap gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-11 w-28 rounded-lg md:h-5" />
              ))}
            </div>
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
                      <div className="mx-auto flex aspect-[390/848] w-full max-w-[16rem] items-start justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 sm:max-w-[17rem]">
                        <Skeleton className="h-full w-full rounded-xl" />
                      </div>
                      <Skeleton className="h-4 w-3/4 max-w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col gap-3 border-t border-border/50 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-11 w-32 rounded-xl" />
                <Skeleton className="h-11 w-48 rounded-xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-prose" />
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5 max-w-full" />
                    <Skeleton className="h-4 w-4/5 max-w-full" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  {index === 0 ? <Skeleton className="h-20 w-full rounded-xl" /> : null}
                  {index === 1 ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5 max-w-full" />
                    </div>
                  ) : null}
                  <Skeleton className="mt-auto h-11 w-40 rounded-lg" />
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
      <LandingDocumentMetadata />
      <LandingContent />
    </Suspense>
  );
}
