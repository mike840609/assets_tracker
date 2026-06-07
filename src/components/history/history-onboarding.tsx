"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, LineChart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HistoryOnboarding({ hasAccounts }: { hasAccounts?: boolean }) {
  const t = useTranslations("history");
  const cta =
    (hasAccounts ?? true)
      ? { href: "/", label: t("emptyCtaDashboard", { defaultValue: "Go to dashboard" }) }
      : {
          href: "/accounts",
          label: t("emptyCtaAddAccount", { defaultValue: "Add your first account" }),
        };

  return (
    <div className="relative isolate flex min-h-[75vh] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card mt-4 shadow-sm p-6 sm:p-12">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-8 opacity-30 blur-[6px] pointer-events-none select-none transition-all duration-700"
        aria-hidden="true"
      >
        {/* Mock Topbar */}
        <div className="flex justify-between items-center w-full mb-2">
          <div className="h-6 w-40 rounded bg-muted/70" />
          <div className="flex gap-2">
            {["1M", "3M", "1Y", "ALL"].map((label, i) => (
              <div
                key={label}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-md",
                  i === 3
                    ? "bg-primary text-primary-foreground opacity-70"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Mock Historical Chart Card */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full h-[280px] flex flex-col overflow-hidden">
          <div className="p-6 pb-4 border-b border-border/40 flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-4 w-28 rounded bg-muted/60" />
              <div className="h-6 w-36 rounded bg-foreground/20 mt-1" />
            </div>
          </div>
          <div className="flex-1 relative w-full flex items-end">
            <div className="absolute inset-0 z-0 flex flex-col justify-between py-6">
              <div className="w-full h-px border-t border-dashed border-border/40" />
              <div className="w-full h-px border-t border-dashed border-border/40" />
            </div>
            <div
              className="w-full h-4/5 bg-gradient-to-t from-primary/20 to-transparent relative z-10"
              style={{
                clipPath:
                  "polygon(0 100%, 0 60%, 20% 50%, 40% 65%, 60% 40%, 80% 20%, 100% 0, 100% 100%)",
              }}
            >
              <div
                className="absolute top-0 right-0 w-full h-0.5 bg-primary origin-left"
                style={{
                  clipPath:
                    "polygon(0 60%, 20% 50%, 40% 65%, 60% 40%, 80% 20%, 100% 0, 100% 100%, 0 100%)",
                }}
              />
            </div>
          </div>
        </Card>

        {/* Mock Snapshots Table */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 flex flex-col gap-4">
          <div className="h-4 w-28 rounded bg-muted/60" />
          <div className="space-y-3">
            {[
              { date: "May 31, 2026", worth: "$124,500.00", change: "+$2,450.00", gain: true },
              { date: "Apr 30, 2026", worth: "$122,050.00", change: "+$1,890.00", gain: true },
              { date: "Mar 31, 2026", worth: "$120,160.00", change: "-$340.00", gain: false },
            ].map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b border-border/20 pb-2 last:border-0 last:pb-0"
              >
                <div className="text-sm font-medium text-foreground/75">{row.date}</div>
                <div className="flex gap-6 items-center">
                  <div className="font-mono text-sm font-semibold">{row.worth}</div>
                  <div
                    className={cn(
                      "font-mono text-xs font-semibold px-2 py-0.5 rounded",
                      row.gain
                        ? "text-[var(--gain)] bg-[var(--gain)]/10"
                        : "text-[var(--loss)] bg-[var(--loss)]/10",
                    )}
                  >
                    {row.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Foreground CTA Overlay Card */}
      <div className="relative z-10 flex max-w-[460px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <LineChart className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground balance-text">
            {t("emptyTitle")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("emptyDesc")}</p>
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
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <p className="text-xs lg:text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
