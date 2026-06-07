"use client";

import { useTranslations } from "next-intl";
import { Plus, Target, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface GoalsOnboardingProps {
  onAdd: () => void;
}

export function GoalsOnboarding({ onAdd }: GoalsOnboardingProps) {
  const t = useTranslations("goals");

  return (
    <div className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card mt-4 shadow-sm p-6 sm:p-12">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-6 p-8 opacity-30 blur-[6px] pointer-events-none select-none transition-all duration-700"
        aria-hidden="true"
      >
        {/* Mock Topbar */}
        <div className="flex justify-between items-center w-full mb-2">
          <div className="h-6 w-32 rounded bg-muted/70" />
          <div className="h-8 w-24 rounded-md bg-muted/60" />
        </div>

        {/* Mock Goals Overall Summary KPI */}
        <Card className="rounded-xl bg-background border-border/50 shadow-sm w-full p-6 grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">Total Saved for Goals</div>
            <div className="text-2xl font-semibold text-foreground/80 font-mono tracking-tight">
              $340,000
            </div>
          </div>
          <div className="space-y-2 flex flex-col justify-center">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>Overall Progress</span>
              <span>58% funded</span>
            </div>
            <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full w-[58%] bg-primary rounded-full" />
            </div>
          </div>
        </Card>

        {/* Mock Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full flex-1">
          {[
            {
              title: "Buy a House",
              current: "$85,000",
              target: "$120,000",
              percent: 70,
              track: true,
            },
            {
              title: "Emergency Fund",
              current: "$15,000",
              target: "$25,000",
              percent: 60,
              track: false,
            },
            {
              title: "Retirement Goal",
              current: "$240,000",
              target: "$500,000",
              percent: 48,
              track: true,
            },
          ].map((goal, i) => (
            <Card
              key={i}
              className="rounded-xl bg-background border-border/50 shadow-sm h-40 flex flex-col justify-between p-6"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-foreground/80 text-sm">{goal.title}</div>
                    {goal.track && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gain)] bg-[var(--gain)]/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        On track
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Target: 2028
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold">{goal.current}</div>
                  <div className="text-[10px] text-muted-foreground">of {goal.target}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${goal.percent}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Foreground CTA Overlay Card */}
      <div className="relative z-10 flex max-w-[460px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <Target className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground balance-text">
            {t("emptyTitle")}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("emptyDescription")}</p>
        </div>

        <div className="w-full pt-2">
          <Button
            onClick={onAdd}
            size="lg"
            className="w-full sm:w-auto gap-2 rounded-xl text-base font-medium transition-all active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            {t("addGoal")}
          </Button>
        </div>

        <p className="text-xs lg:text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    </div>
  );
}
