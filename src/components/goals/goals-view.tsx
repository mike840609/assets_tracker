"use client";

import { startTransition, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CheckCircle2, GripVertical, Plus, Save, Target, X } from "lucide-react";
import type { GoalWithProgress, SerializedAccount } from "@/lib/types";
import type { ProjectionData } from "@/lib/services/projection-service";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";
import { ProjectionView } from "@/components/projections/projection-view";
import { StockTrackerView } from "@/components/stocks/stock-tracker-view";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalsOnboarding } from "./goals-onboarding";

type MobilePlanTab = "watchlist" | "goals" | "projections";

interface GoalsViewProps {
  goalsWithProgress: GoalWithProgress[];
  baseCurrency: string;
  accounts: SerializedAccount[];
  projectionData: ProjectionData;
  stocks: SerializedTrackedStock[];
}

function ReorderGoalItem({ data }: { data: GoalWithProgress }) {
  const t = useTranslations("goals");
  const dragControls = useDragControls();
  const progress = Math.max(0, Math.min(100, Math.round(data.progressPercent)));

  return (
    <Reorder.Item
      value={data}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      layout="position"
      whileDrag={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.85 }}
      style={{ willChange: "transform" }}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
    >
      <button
        type="button"
        aria-label={t("dragHandleLabel")}
        className="inline-flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={(event) => dragControls.start(event)}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <Target className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{data.goal.name}</p>
      {data.isCompleted ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--gain)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--gain-ink)]">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
          {t("completed")}
        </span>
      ) : (
        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {progress}%
        </span>
      )}
    </Reorder.Item>
  );
}

function ManageGoalsList({
  draft,
  onReorder,
}: {
  draft: GoalWithProgress[];
  onReorder: (next: GoalWithProgress[]) => void;
}) {
  const t = useTranslations("goals");

  return (
    <div className="space-y-3">
      <p className="text-xs leading-tight text-muted-foreground">{t("manageOrderHint")}</p>
      <Reorder.Group
        axis="y"
        values={draft}
        onReorder={onReorder}
        layoutScroll
        className="space-y-2"
      >
        {draft.map((data) => (
          <ReorderGoalItem key={data.goal.id} data={data} />
        ))}
      </Reorder.Group>
    </div>
  );
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
  const common = useTranslations("common");
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draft, setDraft] = useState<GoalWithProgress[]>([]);

  function enterManageMode() {
    setDraft([...goalsWithProgress]);
    setManageMode(true);
  }

  function cancelManageMode() {
    setManageMode(false);
    setDraft([]);
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      const res = await fetch("/api/goals/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: draft.map((data) => data.goal.id) }),
      });
      if (!res.ok) throw new Error("reorder failed");
      toast.success(t("reorderSaved"));
      setManageMode(false);
      setDraft([]);
      startTransition(() => router.refresh());
    } catch {
      // Stay in manage mode so the user can retry without losing the arrangement.
      toast.error(t("reorderSaveFailed"));
    } finally {
      setSavingOrder(false);
    }
  }
  // Deep link: the dashboard's "View projections" link points at /goals#projections
  // and "View all goals" at /goals#goals, so a tapped sub-view opens directly. The
  // bare "Plan" tab (no hash) lands on Watchlist, the leftmost sub-tab.
  // useSyncExternalStore reads the hash with a server snapshot of "" so SSR and
  // hydration agree; a manual switch sets `override`, which wins and rewrites the
  // hash for shareable, Back-friendly URLs.
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
    hash === "#goals" ? "goals" : hash === "#projections" ? "projections" : "watchlist";
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            {manageMode ? (
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  variant="outline"
                  onClick={cancelManageMode}
                  disabled={savingOrder}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4" />
                  {common("cancel")}
                </Button>
                <Button onClick={saveOrder} disabled={savingOrder} className="w-full sm:w-auto">
                  <Save className="h-4 w-4" />
                  {savingOrder ? common("saving") : common("save")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                {goalsWithProgress.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={enterManageMode}
                    className="flex-1 sm:flex-none"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {t("manageOrder")}
                  </Button>
                )}
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="order-last w-full sm:order-none sm:w-auto sm:flex-none"
                >
                  <Plus className="h-4 w-4" />
                  {t("addGoal")}
                </Button>
              </div>
            )}
          </div>

          {goalsWithProgress.length === 0 ? (
            <GoalsOnboarding onAdd={() => setCreateOpen(true)} />
          ) : manageMode ? (
            <ManageGoalsList draft={draft} onReorder={setDraft} />
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
