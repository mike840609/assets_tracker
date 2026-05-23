"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { Target, ArrowRight, CheckCircle2 } from "lucide-react";
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
  const { privacyMode } = usePrivacyMode();

  if (totalGoals === 0) return null;

  const progressClamped = featured ? Math.max(0, Math.min(100, featured.progressPercent)) : 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{t("title")}</p>
        </div>
        <Link
          href="/goals"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("viewAll", { count: totalGoals })}
          <ArrowRight className="h-3 w-3" />
        </Link>
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
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-all motion-normal"
                style={{ width: `${progressClamped}%` }}
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
                  date: new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(featured.goal.targetDate)),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
