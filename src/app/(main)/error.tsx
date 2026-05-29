"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center md:gap-6 md:py-24 animate-in fade-in zoom-in-95 motion-normal">
      <div className="rounded-full bg-destructive/10 p-8 shadow-sm">
        <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>{t("retry")}</Button>
        <Button variant="outline" render={<Link href="/" />}>
          {t("backHome")}
        </Button>
      </div>
    </div>
  );
}
