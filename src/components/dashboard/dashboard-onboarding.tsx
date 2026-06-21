"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Clock3,
  Landmark,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const previewRows = [
  { key: "bank", tone: "bg-primary/12 text-primary", width: "w-32" },
  { key: "brokerage", tone: "bg-chart-2/12 text-chart-2", width: "w-40" },
  { key: "other", tone: "bg-chart-3/12 text-chart-3", width: "w-28" },
] as const;

const setupSteps = [
  {
    key: "account",
    icon: Wallet,
    href: "/accounts",
    primary: true,
  },
  {
    key: "currency",
    icon: CircleDollarSign,
    href: "/settings",
    primary: false,
  },
  {
    key: "history",
    icon: Clock3,
    href: "/history",
    primary: false,
  },
] as const;

export function DashboardOnboarding() {
  const t = useTranslations("dashboard.onboarding");

  return (
    <section
      aria-labelledby="dashboard-onboarding-title"
      className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="relative overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_68%)]" />
        <div className="relative flex min-h-full flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-[56ch] space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>{t("eyebrow")}</span>
              </div>
              <div className="space-y-2">
                <h2
                  id="dashboard-onboarding-title"
                  className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-foreground"
                >
                  {t("title")}
                </h2>
                <p className="text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  {t("description")}
                </p>
              </div>
            </div>
            <Link
              href="/accounts"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("primaryAction")}
            </Link>
          </div>

          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
            <div className="flex min-h-[18rem] flex-col justify-between rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    <span>{t("preview.netWorth")}</span>
                  </div>
                  <div className="font-mono text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-4xl">
                    <span aria-hidden="true">••••••</span>
                    <span className="sr-only">{t("preview.noValue")}</span>
                  </div>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {t("preview.private")}
                </div>
              </div>

              <div className="relative mt-5 h-36 overflow-hidden rounded-xl border border-border/60 bg-card/70 p-4">
                <div className="absolute inset-x-4 top-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("preview.trend")}</span>
                  <span>{t("preview.awaitingData")}</span>
                </div>
                <svg
                  className="absolute inset-x-4 bottom-3 h-24 w-[calc(100%-2rem)] overflow-visible"
                  viewBox="0 0 420 120"
                  role="img"
                  aria-label={t("preview.chartLabel")}
                >
                  <defs>
                    <linearGradient id="onboarding-chart-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[22, 52, 82, 112].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      x2="420"
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.08"
                    />
                  ))}
                  <path
                    d="M0 92 C 64 88, 82 64, 138 70 S 220 104, 272 62 S 348 36, 420 44 L 420 120 L 0 120 Z"
                    fill="url(#onboarding-chart-fill)"
                  />
                  <path
                    d="M0 92 C 64 88, 82 64, 138 70 S 220 104, 272 62 S 348 36, 420 44"
                    fill="none"
                    stroke="var(--primary)"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{t("preview.accounts")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{t("preview.empty")}</span>
                </div>
                <div className="space-y-3">
                  {previewRows.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            row.tone,
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className={cn("h-3 rounded-full bg-muted", row.width)} />
                      </div>
                      <div className="h-3 w-12 rounded-full bg-muted" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{t("preview.allocation")}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="h-20 w-20 shrink-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(var(--primary) 0 42%, var(--chart-2) 42% 70%, var(--chart-3) 70% 100%)",
                    }}
                    aria-hidden="true"
                  >
                    <div className="m-3.5 h-[3.25rem] w-[3.25rem] rounded-full bg-background" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {["primary", "chart2", "chart3"].map((item, index) => (
                      <div key={item} className="flex items-center gap-2">
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
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="grid gap-2 sm:grid-cols-3">
                {setupSteps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <Link
                      key={step.key}
                      href={step.href}
                      className={cn(
                        "group flex min-h-14 items-start gap-3 rounded-lg p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        step.primary
                          ? "bg-background shadow-sm ring-1 ring-foreground/10 hover:bg-card"
                          : "hover:bg-background/70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          step.primary
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground ring-1 ring-foreground/10",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 space-y-1">
                        <span className="flex items-center gap-2 text-sm font-semibold leading-tight text-foreground">
                          <span className="font-mono text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          {t(`steps.${step.key}.title`)}
                        </span>
                        <span className="block text-pretty text-xs leading-5 text-muted-foreground md:hidden 2xl:block">
                          {t(`steps.${step.key}.description`)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/accounts"
                className={cn(
                  buttonVariants(),
                  "w-full justify-between sm:justify-center lg:w-auto",
                )}
              >
                {t("primaryAction")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 lg:p-5">
        <div className="flex h-full flex-col justify-between gap-8">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold leading-snug text-foreground">
                {t("aside.title")}
              </h3>
              <p className="text-pretty text-sm leading-6 text-muted-foreground">
                {t("aside.description")}
              </p>
            </div>
          </div>
          <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="text-xs font-medium text-primary">{t("aside.progressLabel")}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t("aside.progressHint")}</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
