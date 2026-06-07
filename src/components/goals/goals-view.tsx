"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Target } from "lucide-react";
import type { GoalWithProgress, SerializedAccount } from "@/lib/types";
import type { ProjectionData } from "@/lib/services/projection-service";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";
import { ProjectionView } from "@/components/projections/projection-view";
import { StockTrackerView } from "@/components/stocks/stock-tracker-view";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";

type MobilePlanTab = "watchlist" | "goals" | "projections";

interface GoalsViewProps {
  goalsWithProgress: GoalWithProgress[];
  baseCurrency: string;
  accounts: SerializedAccount[];
  projectionData: ProjectionData;
  stocks: SerializedTrackedStock[];
}

export function GoalsView({
  goalsWithProgress,
  baseCurrency,
  accounts,
  projectionData,
  stocks,
}: GoalsViewProps) {
  const t = useTranslations("goals");
  const tNav = useTranslations("nav");
  const [createOpen, setCreateOpen] = useState(false);
  // Deep link: the dashboard's "View projections" link points at /goals#projections
  // so the Projections sub-view opens directly. useSyncExternalStore reads the hash
  // with a server snapshot of "" so SSR and hydration agree; a manual switch sets
  // `override`, which wins and rewrites the hash for shareable, Back-friendly URLs.
  const hash = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hashchange", onChange);
      return () => window.removeEventListener("hashchange", onChange);
    },
    () => window.location.hash,
    () => "",
  );
  const [override, setOverride] = useState<MobilePlanTab | null>(null);
  const hashTab: MobilePlanTab =
    hash === "#projections" ? "projections" : hash === "#goals" ? "goals" : "watchlist";
  const activeTab: MobilePlanTab = override ?? hashTab;

  const handleTabChange = (tab: MobilePlanTab) => {
    setOverride(tab);
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", tab === "watchlist" ? base : `${base}#${tab}`);
  };

  return (
    <div className="space-y-4">
      {/* Mobile-only tab switcher */}
      <div role="tablist" className="md:hidden flex border-b">
        {(["watchlist", "goals", "projections"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            onClick={() => handleTabChange(tab)}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            className={cn(
              "pb-2 px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "watchlist" ? tNav("stocks") : tNav(tab)}
          </button>
        ))}
      </div>

      {/* Watchlist tab — mobile only */}
      {activeTab === "watchlist" && (
        <div role="tabpanel" className="md:hidden">
          <StockTrackerView stocks={stocks} />
        </div>
      )}

      {/* Goals tab — always visible on desktop, conditional on mobile */}
      <div role="tabpanel" className={activeTab === "goals" ? "block" : "hidden md:block"}>
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
        <div role="tabpanel" className="md:hidden">
          <ProjectionView projectionData={projectionData} baseCurrency={baseCurrency} />
        </div>
      )}
    </div>
  );
}
