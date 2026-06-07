"use client";

import Link from "next/link";
import { LineChart, BarChart } from "lucide-react";
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
    <div className="relative isolate flex min-h-[75vh] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card mt-4 shadow-sm p-6 sm:p-12">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-8 opacity-30 blur-[6px] pointer-events-none select-none transition-all duration-700"
        aria-hidden="true"
      >
        {/* Mock Topbar */}
        <div className="flex justify-between items-center w-full mb-2">
          <div className="h-6 w-36 rounded bg-muted/70" />
          <div className="h-8 w-24 rounded-md bg-muted/60" />
        </div>

        {/* Mock Analysis Widgets */}
        <div className="grid grid-cols-2 gap-6 w-full">
          <Card className="rounded-xl bg-background border-border/50 shadow-sm p-6 flex flex-col gap-4">
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="flex-1 flex items-end gap-2 mt-4 relative h-28">
              <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-full h-px bg-border/40" />
                ))}
              </div>
              {[45, 60, 35, 75, 50, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/30 rounded-t"
                  style={{ height: `${h}%`, zIndex: 1 }}
                />
              ))}
            </div>
          </Card>
          <Card className="rounded-xl bg-background border-border/50 shadow-sm p-6 flex flex-col gap-4">
            <div className="h-4 w-24 rounded bg-muted/60" />
            <div className="flex-1 flex items-center justify-center h-28">
              <div className="relative w-32 h-16 overflow-hidden">
                <div className="absolute inset-0 rounded-t-full border-[12px] border-muted/30 border-b-0" />
                <div
                  className="absolute inset-0 rounded-t-full border-[12px] border-[var(--gain)]/60 border-b-0 origin-bottom rotate-[-45deg]"
                  style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 100%, 0 100%)" }}
                />
                <div className="absolute bottom-0 left-1/2 w-1.5 h-12 bg-foreground rounded-full origin-bottom rotate-[35deg] -translate-x-1/2 translate-y-[2px]" />
                <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-foreground rounded-full -translate-x-1/2 translate-y-1.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Mock Top Performing Asset Classes */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 flex flex-col gap-4">
          <div className="h-4 w-40 rounded bg-muted/60" />
          <div className="space-y-3">
            {[
              { asset: "US Large Cap Equities", perf: "+14.2%", gain: true },
              { asset: "Global Fixed Income", perf: "+2.8%", gain: true },
              { asset: "Real Estate Holdings", perf: "-0.4%", gain: false },
            ].map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-border/20 pb-2 last:border-0 last:pb-0"
              >
                <div className="text-sm font-medium text-foreground/75">{row.asset}</div>
                <div
                  className={cn(
                    "font-mono text-xs font-semibold px-2 py-0.5 rounded",
                    row.gain
                      ? "text-[var(--gain)] bg-[var(--gain)]/10"
                      : "text-[var(--loss)] bg-[var(--loss)]/10",
                  )}
                >
                  {row.perf}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Mock Monthly Insights */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm p-6 flex flex-col gap-4 w-full">
          <div className="h-4 w-28 rounded bg-muted/60" />
          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[var(--gain)]/10 flex items-center justify-center text-[var(--gain)] flex-shrink-0">
                <LineChart className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="h-4 w-48 rounded bg-muted/60" />
                <div className="h-3 w-72 rounded bg-muted/40 mt-1" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Foreground CTA Overlay Card */}
      <div className="relative z-10 flex max-w-[460px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <BarChart className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground balance-text">
            {t("emptyTitle")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("emptyBody")}</p>
        </div>

        <div className="w-full pt-2">
          <Link
            href={cta.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full sm:w-auto gap-2 rounded-xl text-base font-medium transition-all active:scale-[0.98]",
            )}
          >
            {cta.label}
          </Link>
        </div>

        <p className="text-xs lg:text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
