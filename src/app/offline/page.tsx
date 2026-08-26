import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Offline — astt",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          astt needs a connection to load fresh data. You can retry when you are back online.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          你目前處於離線狀態，恢復連線後再試一次。
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <RetryButton />
          <Link
            href="/"
            className="inline-flex h-11 md:h-8 items-center justify-center rounded-md border px-4 text-sm"
          >
            Go home / 回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
