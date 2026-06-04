"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dashboard rail fallback shown when the user has no goals. Projections is a
 * sub-tab of /goals, so without this the planning rail is empty and the feature
 * has no home-screen scent for goal-less users. A whole-card deep link into the
 * Projections sub-tab fills that gap; the in-card link on GoalsMilestoneCard
 * covers the has-goals case.
 */
export function ProjectionEntryCard() {
  const t = useTranslations("goalsMilestone");
  return (
    <Link
      href="/goals#projections"
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="transition-colors hover:bg-muted/30">
        <CardContent className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{t("projectionTitle")}</span>
            </span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm text-muted-foreground">{t("projectionHint")}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
