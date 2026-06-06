"use client";

import { useTranslations } from "next-intl";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoalsOnboardingProps {
  onAdd: () => void;
}

export function GoalsOnboarding({ onAdd }: GoalsOnboardingProps) {
  const t = useTranslations("goals");

  return (
    <div className="relative isolate flex min-h-[50vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-muted/5 mt-4">
      {/* Background Mockup */}
      <div
        className="absolute inset-0 z-0 flex flex-col gap-4 p-4 sm:p-6 opacity-40 mix-blend-luminosity blur-[5px] pointer-events-none select-none transition-all duration-1000"
        aria-hidden="true"
      >
        <div className="h-32 w-full rounded-xl bg-card border border-border/40 p-5 flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted/60 rounded" />
              <div className="h-4 w-24 bg-muted/40 rounded" />
            </div>
            <div className="h-6 w-16 bg-muted/60 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-12 bg-muted/50 rounded" />
              <div className="h-3 w-12 bg-muted/50 rounded" />
            </div>
            <div className="h-2.5 w-full bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-primary/40 rounded-full" />
            </div>
          </div>
        </div>
        <div className="h-32 w-full rounded-xl bg-card border border-border/40 p-5 flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-muted/60 rounded" />
              <div className="h-4 w-20 bg-muted/40 rounded" />
            </div>
            <div className="h-6 w-16 bg-muted/60 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-muted/50 rounded" />
              <div className="h-3 w-12 bg-muted/50 rounded" />
            </div>
            <div className="h-2.5 w-full bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-primary/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* CTA Overlay */}
      <div className="relative z-10 m-auto flex max-w-[420px] flex-col items-center gap-6 rounded-2xl border border-border/50 bg-background/95 p-8 text-center shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <Target className="h-8 w-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{t("emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed balance-text">
            {t("emptyDescription")}
          </p>
        </div>

        <div className="w-full pt-2">
          <Button
            onClick={onAdd}
            className="w-full h-11 gap-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("addGoal")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/70">
          {t("emptyHint")}
        </p>
      </div>
    </div>
  );
}
