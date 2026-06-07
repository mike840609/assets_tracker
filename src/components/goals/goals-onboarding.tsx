"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CircleDollarSign, Plus, Target, TrendingUp } from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";

interface GoalsOnboardingProps {
  onAdd: () => void;
}

export function GoalsOnboarding({ onAdd }: GoalsOnboardingProps) {
  const t = useTranslations("goals.onboarding");

  const preview = (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.cardTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.cardSubtitle")}
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("preview.status")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded-full bg-muted" />
              <div className="h-7 w-44 rounded-lg bg-foreground/15" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-primary/10" />
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("preview.progress")}</span>
              <span className="font-mono text-foreground">0%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-0 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{t("preview.scopeTitle")}</span>
        </div>
        <div className="space-y-3">
          {["netWorth", "assets", "account"].map((key, index) => (
            <div key={key} className="flex items-center gap-3 rounded-lg bg-card/70 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-3 w-28 rounded-full bg-muted" />
                <div className="h-2.5 w-40 max-w-full rounded-full bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <FirstRunSurface
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      primaryAction={{ label: t("primaryAction"), onClick: onAdd, icon: Plus }}
      preview={preview}
      steps={[
        {
          title: t("steps.goal.title"),
          description: t("steps.goal.description"),
          icon: Target,
        },
        {
          title: t("steps.scope.title"),
          description: t("steps.scope.description"),
          icon: CircleDollarSign,
        },
        {
          title: t("steps.deadline.title"),
          description: t("steps.deadline.description"),
          icon: CalendarClock,
        },
      ]}
      aside={{
        title: t("aside.title"),
        description: t("aside.description"),
        progressLabel: t("aside.progressLabel"),
        progressHint: t("aside.progressHint"),
      }}
    />
  );
}
