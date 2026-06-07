"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, SlidersHorizontal, Sparkles, Target, WalletCards } from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";

export function ProjectionOnboarding({ hasAccounts }: { hasAccounts?: boolean }) {
  const readyForSnapshots = hasAccounts ?? true;
  const t = useTranslations("projections.onboarding");
  const milestones = [
    { title: t("preview.milestoneOne.title"), value: t("preview.milestoneOne.value") },
    { title: t("preview.milestoneTwo.title"), value: t("preview.milestoneTwo.value") },
    { title: t("preview.milestoneThree.title"), value: t("preview.milestoneThree.value") },
  ];
  const assumptions = [
    {
      label: t("preview.assumptions.expenses"),
      value: t("preview.values.expenses"),
      width: "40%",
    },
    {
      label: t("preview.assumptions.savings"),
      value: t("preview.values.savings"),
      width: "66%",
    },
    {
      label: t("preview.assumptions.return"),
      value: t("preview.values.return"),
      width: "52%",
    },
    {
      label: t("preview.assumptions.inflation"),
      value: t("preview.values.inflation"),
      width: "28%",
    },
  ];

  const preview = (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.chartTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.chartSubtitle")}
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("preview.lens")}
          </span>
        </div>

        <div className="relative h-64 overflow-hidden rounded-lg border border-border/60 bg-card/70">
          <div className="absolute inset-0 grid grid-rows-4">
            {[0, 1, 2, 3].map((line) => (
              <span key={line} className="border-b border-dashed border-border/50" />
            ))}
          </div>
          <div className="absolute inset-x-5 top-9 border-t border-dashed border-[var(--gain)]/60" />
          <div
            className="absolute inset-x-0 bottom-0 h-48 bg-muted/45"
            style={{
              clipPath:
                "polygon(0 82%, 16% 76%, 32% 70%, 48% 60%, 64% 46%, 82% 28%, 100% 16%, 100% 100%, 0 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-56 bg-primary/15"
            style={{
              clipPath:
                "polygon(0 88%, 16% 80%, 32% 70%, 48% 54%, 64% 36%, 82% 18%, 100% 6%, 100% 100%, 0 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-56 border-t-2 border-primary"
            style={{
              clipPath:
                "polygon(0 88%, 16% 80%, 32% 70%, 48% 54%, 64% 36%, 82% 18%, 100% 6%, 100% 10%, 0 92%)",
            }}
          />
          <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2">
            {milestones.map((milestone) => (
              <div
                key={milestone.title}
                className="rounded-lg bg-background/90 px-3 py-2 text-xs shadow-sm ring-1 ring-border/70"
              >
                <p className="font-medium text-foreground">{milestone.title}</p>
                <p className="mt-1 font-mono text-muted-foreground">{milestone.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{t("preview.assumptionsTitle")}</span>
        </div>
        <div className="space-y-4">
          {assumptions.map((assumption) => (
            <div key={assumption.label} className="space-y-2">
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{assumption.label}</span>
                <span className="font-mono font-medium text-foreground">{assumption.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: assumption.width }}
                />
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
      title={t(readyForSnapshots ? "titleWithAccounts" : "titleNoAccounts")}
      description={t(readyForSnapshots ? "descriptionWithAccounts" : "descriptionNoAccounts")}
      primaryAction={{
        label: t(readyForSnapshots ? "primaryWithAccounts" : "primaryNoAccounts"),
        href: readyForSnapshots ? "/" : "/accounts",
        icon: readyForSnapshots ? Sparkles : WalletCards,
      }}
      preview={preview}
      activeStepIndex={readyForSnapshots ? 1 : 0}
      steps={[
        {
          title: t("steps.accounts.title"),
          description: t("steps.accounts.description"),
          icon: WalletCards,
        },
        {
          title: t("steps.history.title"),
          description: t("steps.history.description"),
          icon: CalendarClock,
        },
        {
          title: t("steps.assumptions.title"),
          description: t("steps.assumptions.description"),
          icon: Target,
        },
      ]}
      aside={{
        title: t("aside.title"),
        description: t("aside.description"),
        progressLabel: t("aside.progressLabel"),
        progressHint: t(
          readyForSnapshots ? "aside.progressHintWithAccounts" : "aside.progressHintNoAccounts",
        ),
      }}
    />
  );
}
