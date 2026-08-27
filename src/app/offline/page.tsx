// S3: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline — astt",
  robots: { index: false },
};

function OfflineCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        {children}
      </div>
    </main>
  );
}

async function OfflineContent() {
  const t = await getTranslations("offline");

  // ponytail: a plain link, not a client island. This page is served from the
  // navigation cache with no guarantee its JS chunks are, so a hydrated onClick
  // would be dead exactly when the page is shown. Navigating to "/" re-enters
  // the service worker, which retries the network.
  return (
    <>
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
      <Button className="mt-6 h-11 md:h-8" render={<Link href="/" />}>
        {t("retry")}
      </Button>
    </>
  );
}

export default function OfflinePage() {
  return (
    <Suspense
      fallback={
        <OfflineCard>
          <div className="animate-pulse space-y-3">
            <div className="mx-auto h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="mx-auto mt-6 h-11 w-24 rounded-md bg-muted md:h-8" />
          </div>
        </OfflineCard>
      }
    >
      <OfflineCard>
        <OfflineContent />
      </OfflineCard>
    </Suspense>
  );
}
