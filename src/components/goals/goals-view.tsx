"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { useIsMobile, useIsViewportReady } from "@/hooks/use-is-mobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CheckCircle2, GripVertical, Plus, Save, Target, X } from "lucide-react";
import type { GoalWithProgress, SerializedAccount, SerializedCalendarEntry } from "@/lib/types";
import type { ProjectionData } from "@/lib/services/projection-service";
import type { CalendarEarningsItem } from "@/lib/services/calendar-earnings-data";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";
import { GoalCard } from "./goal-card";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalsOnboarding } from "./goals-onboarding";
import {
  MOBILE_PLAN_TABS,
  getMobilePlanPanelId,
  getMobilePlanTabId,
  handleMobilePlanTabKey,
  renderActiveMobilePlanPanel,
  shouldRenderMobilePlanContent,
  shouldRenderGoalsPanel,
  type MobilePlanTab,
} from "./mobile-plan-tabs";

const StockTrackerView = dynamic(
  () => import("@/components/stocks/stock-tracker-view").then((module) => module.StockTrackerView),
  { ssr: false },
);
const ProjectionView = dynamic(
  () => import("@/components/projections/projection-view").then((module) => module.ProjectionView),
  { ssr: false },
);
const CalendarView = dynamic(
  () => import("@/components/calendar/calendar-view").then((module) => module.CalendarView),
  { ssr: false },
);

interface GoalsViewProps {
  loadedTab: MobilePlanTab;
  goalsWithProgress?: GoalWithProgress[];
  baseCurrency: string;
  accounts?: SerializedAccount[];
  projectionData?: ProjectionData;
  stocks?: SerializedTrackedStock[];
  calendarEntries?: SerializedCalendarEntry[];
  earningsByDate?: ReadonlyMap<string, CalendarEarningsItem[]>;
  calendarMonth: string;
  calendarSelectedDate: string;
  calendarToday: string;
  locale: string;
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
  loadedTab,
  goalsWithProgress,
  baseCurrency,
  accounts,
  projectionData,
  stocks,
  calendarEntries,
  earningsByDate,
  calendarMonth,
  calendarSelectedDate,
  calendarToday,
  locale,
}: GoalsViewProps) {
  const t = useTranslations("goals");
  const tNav = useTranslations("nav");
  const common = useTranslations("common");
  const router = useRouter();
  const isMobile = useIsMobile();
  const isViewportReady = useIsViewportReady();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draft, setDraft] = useState<GoalWithProgress[]>([]);
  const tabRefs = useRef<Partial<Record<MobilePlanTab, HTMLButtonElement | null>>>({});
  const migratedLegacyHash = useRef<string | null>(null);
  const pendingLegacyHash = useRef<string | null>(null);
  const loadedGoals = goalsWithProgress ?? [];
  const loadedAccounts = accounts ?? [];

  function enterManageMode() {
    setDraft([...loadedGoals]);
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
  // Deep links for goals, projections, and Calendar open their matching sub-view.
  // The bare "Plan" tab (no hash) lands on Watchlist, the leftmost sub-tab.
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
    hash === "#goals"
      ? "goals"
      : hash === "#projections"
        ? "projections"
        : hash === "#calendar"
          ? "calendar"
          : "watchlist";
  const activeTab: MobilePlanTab = override ?? hashTab;
  const hasLoadedActivePanel = activeTab === loadedTab;

  // Keep the structural tabpanels in the DOM so every tab retains its
  // aria-controls target, but only create the heavy mobile child for the active
  // mobile tab. The hydration-safe viewport hook keeps even the default Watchlist
  // child out of the desktop render.
  const mobileContentEnabled = shouldRenderMobilePlanContent(isViewportReady, isMobile);
  const activeMobilePanelContent = renderActiveMobilePlanPanel(mobileContentEnabled, activeTab, {
    watchlist: () =>
      hasLoadedActivePanel && stocks ? <StockTrackerView stocks={stocks} /> : <MobilePlanLoading />,
    projections: () =>
      hasLoadedActivePanel && projectionData ? (
        <ProjectionView projectionData={projectionData} baseCurrency={baseCurrency} />
      ) : (
        <MobilePlanLoading />
      ),
    calendar: () =>
      hasLoadedActivePanel && calendarEntries && earningsByDate ? (
        <CalendarView
          initialEntries={calendarEntries}
          month={calendarMonth}
          selectedDate={calendarSelectedDate}
          today={calendarToday}
          locale={locale}
          showHeader={false}
          earningsByDate={earningsByDate}
        />
      ) : (
        <MobilePlanLoading />
      ),
  });
  const renderGoalsContent = shouldRenderGoalsPanel(isViewportReady, isMobile, activeTab);

  useEffect(() => {
    if (!isMobile) return;

    tabRefs.current[activeTab]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeTab, isMobile]);

  useEffect(() => {
    if (
      !isMobile ||
      !hash ||
      migratedLegacyHash.current === hash ||
      new URLSearchParams(window.location.search).has("tab")
    ) {
      return;
    }

    migratedLegacyHash.current = hash;
    pendingLegacyHash.current = hash;
    setOverride(activeTab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    const href = `${window.location.pathname}?${params.toString()}`;
    router.replace(href);
  }, [activeTab, hash, isMobile, router]);

  useEffect(() => {
    const legacyHash = pendingLegacyHash.current;
    if (!legacyHash || loadedTab !== activeTab) return;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${legacyHash}`,
    );
    pendingLegacyHash.current = null;
  }, [activeTab, loadedTab]);

  const handleTabChange = (tab: MobilePlanTab) => {
    setOverride(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`${window.location.pathname}?${params.toString()}#${tab}`);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: MobilePlanTab) => {
    const handled = handleMobilePlanTabKey({
      currentTab: tab,
      key: event.key,
      activate: handleTabChange,
      focus: (nextTab) => tabRefs.current[nextTab]?.focus(),
    });
    if (handled) event.preventDefault();
  };

  return (
    <div className="space-y-4">
      {/* Mobile-only tab switcher */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="md:hidden flex min-w-0 overflow-x-auto overscroll-x-contain border-b scrollbar-none"
      >
        {MOBILE_PLAN_TABS.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            id={getMobilePlanTabId(tab)}
            role="tab"
            type="button"
            onClick={() => handleTabChange(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
            aria-selected={activeTab === tab}
            aria-controls={getMobilePlanPanelId(tab)}
            tabIndex={activeTab === tab ? 0 : -1}
            className={cn(
              "-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
      <div
        id={getMobilePlanPanelId("watchlist")}
        role="tabpanel"
        aria-labelledby={getMobilePlanTabId("watchlist")}
        hidden={activeTab !== "watchlist"}
        className="md:hidden"
      >
        {activeTab === "watchlist" ? activeMobilePanelContent : null}
      </div>

      {/* Goals tab — always visible on desktop, conditional on mobile */}
      <div
        id={getMobilePlanPanelId("goals")}
        role="tabpanel"
        aria-labelledby={getMobilePlanTabId("goals")}
        className={activeTab === "goals" ? "block" : "hidden md:block"}
      >
        {renderGoalsContent && hasLoadedActivePanel && goalsWithProgress && accounts ? (
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
                  {loadedGoals.length > 1 && (
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

            {loadedGoals.length === 0 ? (
              <GoalsOnboarding onAdd={() => setCreateOpen(true)} />
            ) : manageMode ? (
              <ManageGoalsList draft={draft} onReorder={setDraft} />
            ) : (
              <div className="grid gap-4">
                {loadedGoals.map((data) => (
                  <GoalCard
                    key={data.goal.id}
                    data={data}
                    baseCurrency={baseCurrency}
                    accounts={loadedAccounts}
                    defaultCurrency={baseCurrency}
                  />
                ))}
              </div>
            )}

            <GoalFormDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              accounts={loadedAccounts}
              defaultCurrency={baseCurrency}
            />
          </div>
        ) : renderGoalsContent ? (
          <MobilePlanLoading />
        ) : null}
      </div>

      {/* Projections tab — mobile only */}
      <div
        id={getMobilePlanPanelId("projections")}
        role="tabpanel"
        aria-labelledby={getMobilePlanTabId("projections")}
        hidden={activeTab !== "projections"}
        className="md:hidden"
      >
        {activeTab === "projections" ? activeMobilePanelContent : null}
      </div>

      {/* Calendar tab — mobile only */}
      <div
        id={getMobilePlanPanelId("calendar")}
        role="tabpanel"
        aria-labelledby={getMobilePlanTabId("calendar")}
        hidden={activeTab !== "calendar"}
        className="pb-20 md:hidden"
      >
        {activeTab === "calendar" ? activeMobilePanelContent : null}
      </div>
    </div>
  );
}

function MobilePlanLoading() {
  return <div aria-label="Loading" className="h-48 animate-pulse rounded-lg bg-muted" />;
}
