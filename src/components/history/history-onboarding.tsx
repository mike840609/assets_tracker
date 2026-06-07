"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, CalendarDays, LineChart, Table2, WalletCards } from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";
import { cn } from "@/lib/utils";

export function HistoryOnboarding({ hasAccounts }: { hasAccounts?: boolean }) {
  const readyForSnapshots = hasAccounts ?? true;
  const t = useTranslations("history.onboarding");

  const preview = (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.chartTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.chartSubtitle")}
            </p>
          </div>
          <div className="flex rounded-lg bg-muted/70 p-1 text-xs font-medium text-muted-foreground">
            {["1M", "3M", "1Y"].map((range, index) => (
              <span
                key={range}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  index === 2 && "bg-background text-foreground shadow-sm",
                )}
              >
                {range}
              </span>
            ))}
          </div>
        </div>

        <div className="relative h-60 overflow-hidden rounded-lg border border-border/60 bg-card/70">
          <div className="absolute inset-0 grid grid-rows-4">
            {[0, 1, 2, 3].map((line) => (
              <span key={line} className="border-b border-dashed border-border/50" />
            ))}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-44 bg-primary/15"
            style={{
              clipPath:
                "polygon(0 86%, 12% 74%, 24% 78%, 38% 58%, 54% 64%, 70% 38%, 86% 30%, 100% 18%, 100% 100%, 0 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-44 border-t-2 border-primary"
            style={{
              clipPath:
                "polygon(0 86%, 12% 74%, 24% 78%, 38% 58%, 54% 64%, 70% 38%, 86% 30%, 100% 18%, 100% 22%, 0 90%)",
            }}
          />
          <div className="absolute right-4 top-7 rounded-lg bg-background/90 px-3 py-2 text-xs shadow-sm ring-1 ring-border/70">
            <p className="font-medium text-foreground">{t("preview.tooltipTitle")}</p>
            <p className="mt-1 font-mono text-muted-foreground">$124,500</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t("preview.calendarTitle")}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[12, 28, 0, 48, 72, 34, 8, 0, 18, 64, 45, 12, 6, 80, 22, 0, 52, 68, 30, 10, 42].map(
              (level, index) => (
                <span
                  key={index}
                  className="aspect-square rounded-[3px] bg-primary/10"
                  style={{
                    backgroundColor:
                      level === 0
                        ? "color-mix(in oklch, var(--muted) 70%, transparent)"
                        : `color-mix(in oklch, var(--primary) ${level}%, var(--background))`,
                  }}
                />
              ),
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <Table2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t("preview.tableTitle")}</span>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[minmax(0,1fr)_5rem_4rem] items-center gap-3 rounded-lg bg-card/80 px-3 py-2.5 ring-1 ring-border/50"
              >
                <span className="h-2.5 rounded-full bg-muted" />
                <span className="h-2.5 rounded-full bg-muted" />
                <span
                  className={cn(
                    "h-2.5 rounded-full",
                    row === 2 ? "bg-[var(--loss)]/40" : "bg-[var(--gain)]/40",
                  )}
                />
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
      title={t(readyForSnapshots ? "titleWithAccounts" : "titleNoAccounts")}
      description={t(readyForSnapshots ? "descriptionWithAccounts" : "descriptionNoAccounts")}
      primaryAction={{
        label: t(readyForSnapshots ? "primaryWithAccounts" : "primaryNoAccounts"),
        href: readyForSnapshots ? "/" : "/accounts",
        icon: readyForSnapshots ? CalendarClock : WalletCards,
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
          title: t("steps.snapshots.title"),
          description: t("steps.snapshots.description"),
          icon: CalendarClock,
        },
        {
          title: t("steps.ledger.title"),
          description: t("steps.ledger.description"),
          icon: LineChart,
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
