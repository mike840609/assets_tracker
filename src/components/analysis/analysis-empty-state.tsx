"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * First-run state for the Analysis tab when the user has no snapshots yet.
 * Onboards toward the next real step: set up accounts, or view the dashboard
 * while daily snapshots accrue. Replaces the prior bare "no data" card.
 */
export function AnalysisEmptyState({ hasAccounts }: { hasAccounts: boolean }) {
  const t = useTranslations("analysis");
  const cta = hasAccounts
    ? { href: "/", label: t("emptyCtaDashboard") }
    : { href: "/accounts", label: t("emptyCtaAddAccount") };

  return (
    <Card className="px-6 py-12 sm:py-16">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <LineChart className="size-6" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h2>
          <p className="text-pretty text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
        <Link href={cta.href} className={cn(buttonVariants(), "mt-1")}>
          {cta.label}
        </Link>
        <p className="text-pretty text-xs text-muted-foreground/70">{t("emptyHint")}</p>
      </div>
    </Card>
  );
}
