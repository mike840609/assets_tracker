"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * First-run state for the Analysis tab when the user has no snapshots yet.
 * Onboards toward the next real step: set up accounts, or view the dashboard
 * while daily snapshots accrue.
 */
export function AnalysisEmptyState({ hasAccounts }: { hasAccounts: boolean }) {
  const t = useTranslations("analysis");
  const cta = hasAccounts
    ? { href: "/", label: t("emptyCtaDashboard") }
    : { href: "/accounts", label: t("emptyCtaAddAccount") };

  return (
    <div className="relative isolate flex min-h-[65vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-muted/5 mt-4">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-4 sm:p-6 opacity-40 mix-blend-luminosity blur-[6px] pointer-events-none select-none transition-all duration-1000 animate-mockup-breathe"
        aria-hidden="true"
      >
        {/* Mock KPI Row */}
        <Card className="h-32 bg-card border-border/40 shadow-sm flex items-center px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full divide-x divide-border/40">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-3 pl-6 first:pl-0 border-l-0">
                <div className="h-4 w-24 bg-muted/40 rounded" />
                <div className="h-8 w-32 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        </Card>

        {/* Mock Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          <Card className="bg-card border-border/40 shadow-sm p-6 flex flex-col gap-4">
            <div className="h-5 w-32 bg-muted/60 rounded" />
            <div className="flex-1 flex items-end gap-2 mt-4 relative">
              <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full h-px bg-border/40" />
                ))}
              </div>
              {[45, 60, 35, 75, 50, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t"
                  style={{ height: `${h}%`, zIndex: 1 }}
                />
              ))}
            </div>
          </Card>
          <Card className="bg-card border-border/40 shadow-sm p-6 flex flex-col gap-4">
            <div className="h-5 w-32 bg-muted/60 rounded" />
            <div className="flex-1 flex items-end mt-4 relative overflow-hidden">
              <div className="w-full h-full bg-gradient-to-tr from-primary/10 to-transparent border-t border-primary/20" />
            </div>
          </Card>
        </div>
      </div>

      {/* CTA Overlay */}
      <div className="relative z-10 m-auto flex max-w-[440px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-md backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <LineChart className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed balance-text">
            {t("emptyBody")}
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
          </Link>
        </div>

        <p className="text-pretty text-xs text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
