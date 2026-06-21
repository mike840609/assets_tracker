"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, ChartCandlestick, CircleDollarSign, Plus, Search } from "lucide-react";
import { FirstRunSurface } from "@/components/onboarding/first-run-surface";
import { cn } from "@/lib/utils";

interface StocksOnboardingProps {
  onAdd: () => void;
}

const rows = [
  { symbol: "AAPL", tone: "bg-primary/12 text-[var(--primary-ink)]", gain: true },
  { symbol: "NVDA", tone: "bg-chart-2/12 text-chart-2", gain: true },
  { symbol: "TSM", tone: "bg-chart-3/12 text-chart-3", gain: false },
] as const;

export function StocksOnboarding({ onAdd }: StocksOnboardingProps) {
  const t = useTranslations("stocks.onboarding");

  const preview = (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
      <div className="rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t("preview.watchlistTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("preview.watchlistSubtitle")}
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-[var(--primary-ink)]">
            {t("preview.manual")}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/70">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("preview.colSymbol")}</span>
            <span>{t("preview.colRecord")}</span>
            <span className="text-right">{t("preview.colChange")}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.symbol}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-border/40 px-3 py-3 last:border-b-0"
            >
              <span
                className={cn("rounded-lg px-2 py-1 font-mono text-xs font-semibold", row.tone)}
              >
                {row.symbol}
              </span>
              <div className="min-w-0 space-y-1">
                <div className="h-3 w-32 rounded-full bg-muted" />
                <div className="h-2.5 w-24 rounded-full bg-muted/70" />
              </div>
              <span
                className={cn(
                  "ml-auto h-3 w-12 rounded-full",
                  row.gain ? "bg-[var(--gain)]/30" : "bg-[var(--loss)]/30",
                )}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-foreground">
          <ChartCandlestick className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{t("preview.detailTitle")}</span>
        </div>
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="h-3 w-16 rounded-full bg-muted" />
              <div className="h-6 w-24 rounded-lg bg-foreground/15" />
            </div>
            <div className="h-7 w-16 rounded-lg bg-primary/10" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1 rounded-lg bg-muted/40 p-3">
              <div className="h-2.5 w-14 rounded-full bg-muted" />
              <div className="h-3 w-16 rounded-full bg-muted/80" />
            </div>
            <div className="space-y-1 rounded-lg bg-muted/40 p-3">
              <div className="h-2.5 w-14 rounded-full bg-muted" />
              <div className="h-3 w-16 rounded-full bg-muted/80" />
            </div>
          </div>
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
          title: t("steps.search.title"),
          description: t("steps.search.description"),
          icon: Search,
        },
        {
          title: t("steps.record.title"),
          description: t("steps.record.description"),
          icon: CircleDollarSign,
        },
        {
          title: t("steps.date.title"),
          description: t("steps.date.description"),
          icon: CalendarDays,
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
