import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Goals calendar earnings integration", () => {
  it("loads earnings and passes them into the mobile CalendarView", () => {
    const page = fs.readFileSync(path.join(root, "src/app/(main)/goals/page.tsx"), "utf8");
    const view = fs.readFileSync(path.join(root, "src/components/goals/goals-view.tsx"), "utf8");

    expect(page).toContain("getCalendarEarnings");
    expect(page).toContain("earningsByDate");
    expect(page).toContain("panelData.calendarEarnings");
    expect(view).toContain("earningsByDate?: ReadonlyMap<string, CalendarEarningsItem[]>");
    expect(view).toContain("earningsByDate={earningsByDate}");
  });

  it("keeps mobile selection inside the Goals Suspense architecture", () => {
    const page = fs.readFileSync(path.join(root, "src/app/(main)/goals/page.tsx"), "utf8");

    expect(page).toContain("tab?: string");
    expect(page).toContain("headers()");
    expect(page).toContain("isMobileUserAgent");
    expect(page).toContain("parseMobilePlanTab(tab)");
    expect(page).toContain("<Suspense fallback={<PanelSkeleton />}");
    expect(page).toContain("GoalsDeferredData");
    expect(page).toContain("getGoalsPanelData");
    expect(page).toContain('activeTab === "watchlist"');
    expect(page).toContain('activeTab === "projections"');
    expect(page).toContain("isMobile && tab !== undefined");
    expect(page).not.toContain("goalsDataP!");
  });
});
