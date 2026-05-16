"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus, Target } from "lucide-react";
import type { GoalWithProgress, SerializedAccount } from "@/lib/types";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";

interface GoalsViewProps {
  goalsWithProgress: GoalWithProgress[];
  baseCurrency: string;
  accounts: SerializedAccount[];
}

export function GoalsView({ goalsWithProgress, baseCurrency, accounts }: GoalsViewProps) {
  const t = useTranslations("goals");
  const [createOpen, setCreateOpen] = useState(false);

  return (
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
  );
}
