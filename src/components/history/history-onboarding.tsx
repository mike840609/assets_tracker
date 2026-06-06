"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, LineChart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HistoryOnboarding({ hasAccounts }: { hasAccounts?: boolean }) {
  const t = useTranslations("history");
  // Default to true if not provided (e.g. legacy usage)
  const cta =
    (hasAccounts ?? true)
      ? { href: "/", label: t("emptyCtaDashboard", { defaultValue: "Go to dashboard" }) }
      : {
          href: "/accounts",
          label: t("emptyCtaAddAccount", { defaultValue: "Add your first account" }),
        };

  return (
    <div className="relative isolate flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-muted/5 mt-4">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-4 sm:p-6 opacity-40 mix-blend-luminosity blur-[6px] pointer-events-none select-none transition-all duration-1000 animate-mockup-breathe"
        aria-hidden="true"
      >
        <div className="h-48 w-full rounded-xl bg-card border border-border/40 shadow-sm flex flex-col justify-end overflow-hidden relative">
          <div className="absolute top-4 left-4 h-5 w-32 bg-muted/60 rounded" />
          <div className="w-full h-[120px] bg-gradient-to-t from-primary/10 to-transparent border-t border-primary/20" />
        </div>

        <div className="flex-1 w-full rounded-xl bg-card border border-border/40 p-5 shadow-sm flex flex-col gap-4">
          <div className="h-6 w-full bg-muted/40 rounded" />
          <div className="h-10 w-full bg-muted/20 rounded" />
          <div className="h-10 w-full bg-muted/20 rounded" />
          <div className="h-10 w-full bg-muted/20 rounded" />
        </div>
      </div>

      {/* CTA Overlay */}
      <div className="relative z-10 m-auto flex max-w-[440px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <LineChart className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed balance-text">
            {t("emptyDesc")}
          </p>
        </div>

        <div className="w-full pt-2">
          <Link
            href={cta.href}
            className={cn(
              buttonVariants({ size: "default" }),
              "w-full h-11 gap-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]",
            )}
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/70">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
