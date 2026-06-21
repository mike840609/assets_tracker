"use client";

import { useTranslations } from "next-intl";
import {
  Activity,
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  LineChart,
  WalletCards,
} from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";
import { cn } from "@/lib/utils";

export function AnalysisEmptyState({ hasAccounts }: { hasAccounts: boolean }) {
  const t = useTranslations("analysis.onboarding");
  const cashFlowRows = [
    { toneClass: "bg-primary", widthClass: "w-3/4" },
    { toneClass: "bg-[var(--gain)]", widthClass: "w-1/2" },
    { toneClass: "bg-[var(--loss)]", widthClass: "w-1/3" },
  ];

  const preview = (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.trendTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.trendSubtitle")}
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-[var(--primary-ink)]">
            {t("preview.range")}
          </span>
        </div>

        <div className="grid h-56 grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
          <div className="flex flex-col justify-between py-2 text-right text-[10px] tabular-nums text-muted-foreground">
            <span>240k</span>
            <span>180k</span>
            <span>120k</span>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/70">
            <div className="absolute inset-0 grid grid-rows-4">
              {[0, 1, 2, 3].map((line) => (
                <span key={line} className="border-b border-dashed border-border/50" />
              ))}
            </div>
            <div className="absolute inset-x-4 bottom-4 flex h-40 items-end gap-2">
              {[38, 56, 44, 64, 58, 73, 69, 82].map((height, index) => (
                <span
                  key={index}
                  className="min-w-0 flex-1 rounded-t-md bg-primary/35"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-x-4 bottom-8 h-28 rounded-t-[40%] border-t-2 border-[var(--gain)]/80" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t("preview.cashFlowTitle")}</span>
          </div>
          <div className="space-y-3">
            {cashFlowRows.map((row) => (
              <div key={row.toneClass} className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.toneClass)} />
                <span className="h-2.5 flex-1 rounded-full bg-muted" />
                <span className={cn("h-2.5 rounded-full bg-muted/70", row.widthClass)} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t("preview.attributionTitle")}</span>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
                <span className="h-9 rounded-lg bg-card/80 ring-1 ring-border/50" />
                <span className="h-3 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <FirstRunSurface
      eyebrow={t("eyebrow")}
      title={t(hasAccounts ? "titleWithAccounts" : "titleNoAccounts")}
      description={t(hasAccounts ? "descriptionWithAccounts" : "descriptionNoAccounts")}
      primaryAction={{
        label: t(hasAccounts ? "primaryWithAccounts" : "primaryNoAccounts"),
        href: hasAccounts ? "/" : "/accounts",
        icon: hasAccounts ? LineChart : WalletCards,
      }}
      preview={preview}
      activeStepIndex={hasAccounts ? 1 : 0}
      steps={[
        {
          title: t("steps.accounts.title"),
          description: t("steps.accounts.description"),
          icon: WalletCards,
        },
        {
          title: t("steps.snapshots.title"),
          description: t("steps.snapshots.description"),
          icon: CalendarClock,
        },
        {
          title: t("steps.read.title"),
          description: t("steps.read.description"),
          icon: BarChart3,
        },
      ]}
      aside={{
        title: t("aside.title"),
        description: t("aside.description"),
        progressLabel: t("aside.progressLabel"),
        progressHint: t(
          hasAccounts ? "aside.progressHintWithAccounts" : "aside.progressHintNoAccounts",
        ),
      }}
    />
  );
}
