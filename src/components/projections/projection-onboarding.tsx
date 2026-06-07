"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProjectionOnboarding({ hasAccounts }: { hasAccounts?: boolean }) {
  const t = useTranslations("projections");
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
          <div className="h-6 w-44 rounded bg-muted/70" />
          <div className="h-8 w-24 rounded-md bg-muted/60" />
        </div>

        {/* Mock Projections Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full flex-1">
          {/* Main Chart Column */}
          <div className="flex-1 flex flex-col gap-6">
            <Card className="rounded-xl bg-background border-border/50 shadow-sm h-28 flex flex-col p-6 pb-2 justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-muted/60" />
                  <div className="h-6 w-36 rounded bg-foreground/20 mt-1" />
                </div>
                <div className="bg-[var(--gain)]/15 text-[var(--gain)] px-3 py-1 rounded-md text-[10px] font-semibold">
                  +12% vs goal
                </div>
              </div>
            </Card>

            <Card className="rounded-xl bg-background border-border/50 shadow-sm h-44 overflow-hidden flex flex-col">
              <div className="flex-1 relative w-full flex items-end">
                <div className="absolute inset-0 z-0 flex flex-col justify-center py-6">
                  <div className="w-full h-px border-t border-dashed border-border/40" />
                </div>
                {/* Simulated projection chart lines */}
                <div
                  className="w-full h-[60%] bg-muted/30 relative z-10"
                  style={{
                    clipPath:
                      "polygon(0 100%, 0 80%, 20% 75%, 40% 65%, 60% 50%, 80% 30%, 100% 0, 100% 100%)",
                  }}
                />
                <div
                  className="w-full h-[90%] bg-gradient-to-t from-primary/20 to-transparent absolute bottom-0 left-0 z-20"
                  style={{
                    clipPath:
                      "polygon(0 100%, 0 70%, 20% 55%, 40% 40%, 60% 25%, 80% 10%, 100% 0, 100% 100%)",
                  }}
                >
                  <div
                    className="absolute top-0 right-0 w-full h-0.5 bg-primary origin-left"
                    style={{
                      clipPath:
                        "polygon(0 70%, 20% 55%, 40% 40%, 60% 25%, 80% 10%, 100% 0, 100% 100%, 0 100%)",
                    }}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Side Assumptions Column */}
          <Card className="w-56 rounded-xl bg-background border-border/50 shadow-sm p-6 flex flex-col gap-6">
            <div className="h-4 w-24 rounded bg-muted/60" />
            <div className="space-y-6">
              {[
                { label: "Annual Return", val: "7.0%" },
                { label: "Inflation", val: "2.5%" },
                { label: "Savings Rate", val: "15%" },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.val}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted/50 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Mock Projection Milestones Table */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 flex flex-col gap-4">
          <div className="h-4 w-36 rounded bg-muted/60" />
          <div className="grid grid-cols-3 gap-6">
            {[
              { age: "Age 45", val: "$325,000" },
              { age: "Age 55", val: "$1,180,000" },
              { age: "Age 65", val: "$3,250,000" },
            ].map((milestone, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 border-r border-border/20 last:border-0 pr-4"
              >
                <div className="text-xs text-muted-foreground font-medium">{milestone.age}</div>
                <div className="font-mono text-base font-semibold">{milestone.val}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Foreground CTA Overlay Card */}
      <div className="relative z-10 flex max-w-[460px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground balance-text">
            {t("title")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("noData")}</p>
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
