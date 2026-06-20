"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { Target, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import type { GoalWithProgress } from "@/lib/types";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

const HIDDEN = "***";

interface GoalsMilestoneCardProps {
  featured: GoalWithProgress | null;
  totalGoals: number;
  baseCurrency: string;
}

export function GoalsMilestoneCard({
  featured,
  totalGoals,
  baseCurrency,
}: GoalsMilestoneCardProps) {
  const t = useTranslations("goalsMilestone");
  const locale = useLocale();
  const { privacyMode } = usePrivacyMode();
  const reduceMotion = useReducedMotion();

  // Fill the progress bar from 0 → its value the frame after mount so the
  // milestone reads as advancing. Reduced motion lands at the final width.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (totalGoals === 0) return null;

  const progressClamped = featured ? Math.max(0, Math.min(100, featured.progressPercent)) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-primary" />
            <CardTitle className="truncate">{t("title")}</CardTitle>
          </div>
          <Link
            href="/goals#goals"
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("viewAll", { count: totalGoals })}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!featured ? (
          <p className="text-sm text-muted-foreground">{t("allCompleted")}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              {featured.isCompleted && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              <p className="font-medium text-sm truncate">{featured.goal.name}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {progressClamped.toFixed(0)}%
              </span>
            </div>

            {/* Progress bar */}
            <div
              role="progressbar"
              aria-valuenow={progressClamped}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={featured.goal.name}
              className="h-2 w-full rounded-full bg-muted/60 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-primary/80 transition-[width] duration-700 ease-out"
                style={{ width: `${reduceMotion || filled ? progressClamped : 0}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {privacyMode ? HIDDEN : formatCurrency(featured.currentAmount, baseCurrency)}
              </span>
              <span>
                {privacyMode ? HIDDEN : formatCurrency(featured.targetAmountInBase, baseCurrency)}
              </span>
            </div>

            {featured.goal.targetDate && (
              <p className="text-xs text-muted-foreground">
                {t("due", {
                  date: new Intl.DateTimeFormat(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(featured.goal.targetDate)),
                })}
              </p>
            )}
          </div>
        )}

        {/* Mobile-only entry point — Projections is a sub-tab of /goals, so the
            tab bar gives it no scent. Surface it here, where Goals already lives
            on the dashboard. Desktop reaches Projections via the sidebar. */}
        <Link
          href="/goals#projections"
          className="md:hidden mt-3 flex items-center justify-between gap-2 rounded-sm border-t border-border/40 pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            {t("viewProjection")}
          </span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
