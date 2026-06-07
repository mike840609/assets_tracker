"use client";

import { useTranslations } from "next-intl";
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Landmark,
  Plus,
} from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";
import { cn } from "@/lib/utils";

const accountTypes = [
  { key: "bank", icon: Landmark, tone: "bg-primary/12 text-primary" },
  { key: "brokerage", icon: BriefcaseBusiness, tone: "bg-chart-2/12 text-chart-2" },
  { key: "property", icon: Building2, tone: "bg-chart-3/12 text-chart-3" },
] as const;

export function AccountsOnboarding({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("accountsList.onboarding");

  const preview = (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.ledgerTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.ledgerSubtitle")}
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("preview.private")}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/70">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_5.5rem] gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("preview.colAccount")}</span>
            <span>{t("preview.colCurrency")}</span>
            <span className="text-right">{t("preview.colValue")}</span>
          </div>
          {accountTypes.map((type) => {
            const Icon = type.icon;

            return (
              <div
                key={type.key}
                className="grid grid-cols-[minmax(0,1fr)_5rem_5.5rem] items-center gap-3 border-b border-border/40 px-3 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      type.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="h-3 w-28 rounded-full bg-muted sm:w-36" />
                </div>
                <span className="h-3 w-10 rounded-full bg-muted" />
                <span className="ml-auto h-3 w-16 rounded-full bg-muted" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-foreground">
          <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{t("preview.mixTitle")}</span>
        </div>
        <div className="space-y-3">
          {[70, 22, 8].map((width, index) => (
            <div key={width} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    index === 0 && "bg-primary",
                    index === 1 && "bg-chart-2",
                    index === 2 && "bg-chart-3",
                  )}
                />
                <div className="h-2.5 flex-1 rounded-full bg-muted" />
              </div>
              <div className="h-1.5 rounded-full bg-muted/60" style={{ width: `${width}%` }} />
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
          title: t("steps.account.title"),
          description: t("steps.account.description"),
          icon: Landmark,
        },
        {
          title: t("steps.currency.title"),
          description: t("steps.currency.description"),
          icon: CircleDollarSign,
        },
        {
          title: t("steps.balance.title"),
          description: t("steps.balance.description"),
          icon: Banknote,
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
