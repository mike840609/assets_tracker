import type { ReactNode } from "react";

export const MOBILE_PLAN_TABS = ["watchlist", "goals", "projections", "calendar"] as const;

export type MobilePlanTab = (typeof MOBILE_PLAN_TABS)[number];
export type MobileOnlyPlanTab = Exclude<MobilePlanTab, "goals">;
export type MobilePlanPanelRenderers = Record<MobileOnlyPlanTab, () => ReactNode>;

export function parseMobilePlanTab(value: string | undefined): MobilePlanTab {
  return MOBILE_PLAN_TABS.find((tab) => tab === value) ?? "watchlist";
}

export function getMobilePlanTabId(tab: MobilePlanTab): string {
  return `mobile-plan-tab-${tab}`;
}

export function getMobilePlanPanelId(tab: MobilePlanTab): string {
  return `mobile-plan-panel-${tab}`;
}

export function renderActiveMobilePlanPanel(
  isMobile: boolean,
  activeTab: MobilePlanTab,
  renderers: MobilePlanPanelRenderers,
): ReactNode {
  if (!isMobile || activeTab === "goals") return null;
  return renderers[activeTab]();
}

export function shouldRenderMobilePlanContent(
  isViewportReady: boolean,
  isMobile: boolean,
): boolean {
  return isViewportReady && isMobile;
}

export function shouldRenderGoalsPanel(
  isViewportReady: boolean,
  isMobile: boolean,
  activeTab: MobilePlanTab,
): boolean {
  return isViewportReady && (!isMobile || activeTab === "goals");
}

type MobilePlanTabKeyHandlerOptions = {
  currentTab: MobilePlanTab;
  key: string;
  activate: (tab: MobilePlanTab) => void;
  focus: (tab: MobilePlanTab) => void;
};

export function handleMobilePlanTabKey({
  currentTab,
  key,
  activate,
  focus,
}: MobilePlanTabKeyHandlerOptions): boolean {
  const currentIndex = MOBILE_PLAN_TABS.indexOf(currentTab);
  let nextTab: MobilePlanTab;

  switch (key) {
    case "ArrowRight":
      nextTab = MOBILE_PLAN_TABS[(currentIndex + 1) % MOBILE_PLAN_TABS.length];
      break;
    case "ArrowLeft":
      nextTab =
        MOBILE_PLAN_TABS[(currentIndex - 1 + MOBILE_PLAN_TABS.length) % MOBILE_PLAN_TABS.length];
      break;
    case "Home":
      nextTab = MOBILE_PLAN_TABS[0];
      break;
    case "End":
      nextTab = MOBILE_PLAN_TABS[MOBILE_PLAN_TABS.length - 1];
      break;
    default:
      return false;
  }

  activate(nextTab);
  focus(nextTab);
  return true;
}
