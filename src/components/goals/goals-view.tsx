"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Target } from "lucide-react";
import type { GoalWithProgress, SerializedAccount } from "@/lib/types";
import type { ProjectionData } from "@/lib/services/projection-service";
import { ProjectionView } from "@/components/projections/projection-view";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";

interface GoalsViewProps {
  goalsWithProgress: GoalWithProgress[];
  baseCurrency: string;
  accounts: SerializedAccount[];
  projectionData: ProjectionData;
}

export function GoalsView({
  goalsWithProgress,
  baseCurrency,
  accounts,
  projectionData,
}: GoalsViewProps) {
  const t = useTranslations("goals");
  const tNav = useTranslations("nav");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"goals" | "projections">("goals");

  return (
    <div className="space-y-4">
      {/* Mobile-only tab switcher */}
      <div className="md:hidden flex border-b">
        {(["goals", "projections"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              "pb-2 px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tNav(tab)}
          </button>
        ))}
      </div>

      {/* Goals tab — always visible on desktop, conditional on mobile */}
      <div className={activeTab === "projections" ? "hidden md:block" : "block"}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t("addGoal")}
            </Button>
          </div>

          {goalsWithProgress.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="rounded-full bg-muted p-6">
                <Target className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="font-semibold">{t("emptyTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
              </div>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("addGoal")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {goalsWithProgress.map((data) => (
                <GoalCard
                  key={data.goal.id}
                  data={data}
                  baseCurrency={baseCurrency}
                  accounts={accounts}
                  defaultCurrency={baseCurrency}
                />
              ))}
            </div>
          )}

          <GoalFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            accounts={accounts}
            defaultCurrency={baseCurrency}
          />
        </div>
      </div>

      {/* Projections tab — mobile only */}
      {activeTab === "projections" && (
        <div className="md:hidden">
          <ProjectionView
            latestNetWorth={projectionData.latestNetWorth}
            trailing12mSavings={projectionData.trailing12mSavings}
            annualSnapshots={projectionData.annualSnapshots}
            hasData={projectionData.hasData}
            baseCurrency={baseCurrency}
          />
        </div>
      )}
    </div>
  );
}
