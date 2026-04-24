"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-destructive/10 blur-3xl -z-10" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[40%] w-[40%] rounded-full bg-chart-4/10 blur-3xl -z-10" />

      <div className="glass w-full max-w-md rounded-3xl p-10 space-y-6 text-center">
        {/* Icon */}
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl shadow-lg"
          style={{ background: "linear-gradient(135deg, #f87171 0%, #7f1d1d 100%)" }}
        >
          <AlertTriangle className="h-7 w-7 text-white" strokeWidth={2} />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("description")}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono mt-1">
              {t("digest")}: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            id="error-retry-btn"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {t("retry")}
          </button>
          <a
            id="error-home-link"
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {t("goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}
