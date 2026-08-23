import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  MOBILE_PLAN_TABS,
  getMobilePlanPanelId,
  getMobilePlanTabId,
  handleMobilePlanTabKey,
  parseMobilePlanTab,
  renderActiveMobilePlanPanel,
  shouldRenderMobilePlanContent,
  shouldRenderGoalsPanel,
  type MobilePlanTab,
} from "@/components/goals/mobile-plan-tabs";

function pressNavigationKey(currentTab: MobilePlanTab, key: string) {
  let activeTab = currentTab;
  let focusedTab = currentTab;
  const handled = handleMobilePlanTabKey({
    currentTab,
    key,
    activate: (tab) => {
      activeTab = tab;
    },
    focus: (tab) => {
      focusedTab = tab;
    },
  });

  return { handled, activeTab, focusedTab };
}

describe("mobile Plan tabs", () => {
  it.each([
    ["watchlist", "watchlist"],
    ["goals", "goals"],
    ["projections", "projections"],
    ["calendar", "calendar"],
    [undefined, "watchlist"],
    ["not-a-tab", "watchlist"],
  ] as const)("parses %s as %s", (value, expected) => {
    expect(parseMobilePlanTab(value)).toBe(expected);
  });

  it.each([
    ["watchlist", "ArrowRight", "goals"],
    ["calendar", "ArrowRight", "watchlist"],
    ["watchlist", "ArrowLeft", "calendar"],
    ["goals", "ArrowLeft", "watchlist"],
    ["projections", "Home", "watchlist"],
    ["goals", "End", "calendar"],
  ] as const)("handles %s + %s by focusing and activating %s", (current, key, expected) => {
    expect(pressNavigationKey(current, key)).toEqual({
      handled: true,
      activeTab: expected,
      focusedTab: expected,
    });
  });

  it("ignores keys outside the horizontal tab navigation pattern", () => {
    expect(pressNavigationKey("goals", "ArrowDown")).toEqual({
      handled: false,
      activeTab: "goals",
      focusedTab: "goals",
    });
  });

  it("provides stable matching IDs for every tab and panel", () => {
    expect(
      MOBILE_PLAN_TABS.map((tab) => ({
        tab,
        tabId: getMobilePlanTabId(tab),
        panelId: getMobilePlanPanelId(tab),
      })),
    ).toEqual([
      {
        tab: "watchlist",
        tabId: "mobile-plan-tab-watchlist",
        panelId: "mobile-plan-panel-watchlist",
      },
      {
        tab: "goals",
        tabId: "mobile-plan-tab-goals",
        panelId: "mobile-plan-panel-goals",
      },
      {
        tab: "projections",
        tabId: "mobile-plan-tab-projections",
        panelId: "mobile-plan-panel-projections",
      },
      {
        tab: "calendar",
        tabId: "mobile-plan-tab-calendar",
        panelId: "mobile-plan-panel-calendar",
      },
    ]);
  });

  it.each(["watchlist", "projections", "calendar"] as const)(
    "renders only the active mobile panel: %s",
    (activeTab) => {
      const rendered: MobilePlanTab[] = [];
      const result = renderActiveMobilePlanPanel(true, activeTab, {
        watchlist: () => {
          rendered.push("watchlist");
          return "watchlist";
        },
        projections: () => {
          rendered.push("projections");
          return "projections";
        },
        calendar: () => {
          rendered.push("calendar");
          return "calendar";
        },
      });

      expect(rendered).toEqual([activeTab]);
      expect(result).toBe(activeTab);
    },
  );

  it("does not render a mobile-only panel while the desktop Goals tab is active", () => {
    const rendered: MobilePlanTab[] = [];
    const result = renderActiveMobilePlanPanel(true, "goals", {
      watchlist: () => {
        rendered.push("watchlist");
        return "watchlist";
      },
      projections: () => {
        rendered.push("projections");
        return "projections";
      },
      calendar: () => {
        rendered.push("calendar");
        return "calendar";
      },
    });

    expect(rendered).toEqual([]);
    expect(result).toBeNull();
  });

  it("does not render mobile-only panels on desktop", () => {
    const rendered: MobilePlanTab[] = [];
    const result = renderActiveMobilePlanPanel(false, "watchlist", {
      watchlist: () => {
        rendered.push("watchlist");
        return "watchlist";
      },
      projections: () => {
        rendered.push("projections");
        return "projections";
      },
      calendar: () => {
        rendered.push("calendar");
        return "calendar";
      },
    });

    expect(rendered).toEqual([]);
    expect(result).toBeNull();
  });

  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const)(
    "mounts mobile-only content only after the viewport is ready",
    (isViewportReady, isMobile, expected) => {
      expect(shouldRenderMobilePlanContent(isViewportReady, isMobile)).toBe(expected);
    },
  );

  it.each([
    [false, false, "watchlist", false],
    [false, false, "goals", false],
    [true, false, "watchlist", true],
    [true, false, "goals", true],
    [true, true, "watchlist", false],
    [true, true, "goals", true],
  ] as const)(
    "mounts the Goals panel only on desktop or when active",
    (isViewportReady, isMobile, activeTab, expected) => {
      expect(shouldRenderGoalsPanel(isViewportReady, isMobile, activeTab)).toBe(expected);
    },
  );

  it("connects every rendered tab and panel to the keyboard model", () => {
    const source = readFileSync("src/components/goals/goals-view.tsx", "utf8");

    expect(source).toContain("MOBILE_PLAN_TABS.map");
    expect(source).toContain("onKeyDown={(event) => handleTabKeyDown(event, tab)}");
    expect(source).toContain("tabRefs.current[nextTab]?.focus()");
    expect(source).toContain("aria-controls={getMobilePlanPanelId(tab)}");
    expect(source).toContain("id={getMobilePlanTabId(tab)}");

    for (const tab of MOBILE_PLAN_TABS) {
      expect(source).toContain(`id={getMobilePlanPanelId("${tab}")}`);
      expect(source).toContain(`aria-labelledby={getMobilePlanTabId("${tab}")}`);
    }
  });

  it("keeps 44px, non-truncating, scrollable tabs robust in the narrow layout", () => {
    const source = readFileSync("src/components/goals/goals-view.tsx", "utf8");
    const english = JSON.parse(readFileSync("messages/en-US.json", "utf8"));
    const traditionalChinese = JSON.parse(readFileSync("messages/zh-TW.json", "utf8"));

    expect(source).toContain("min-h-11");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("shrink-0");
    expect(source).toContain("whitespace-nowrap");
    expect(source).toContain("scrollIntoView");
    expect(source).not.toContain("flex-1 truncate whitespace-nowrap");
    expect([
      english.nav.stocks,
      english.nav.goals,
      english.nav.projections,
      english.nav.calendar,
    ]).toEqual(["Watchlist", "Goals", "Projections", "Calendar"]);
    expect([
      traditionalChinese.nav.stocks,
      traditionalChinese.nav.goals,
      traditionalChinese.nav.projections,
      traditionalChinese.nav.calendar,
    ]).toEqual(["自選股", "目標", "財務預測", "行事曆"]);
  });
});
