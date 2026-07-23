import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildCalendarNavigationHref } from "@/components/calendar/calendar-navigation";

describe("mobile calendar routing", () => {
  it("preserves Calendar query state in the mobile hub redirect", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/layout/mobile-hub-redirect.tsx"),
      "utf8",
    );
    expect(source).toContain('search = ""');
    expect(source).toContain("`/goals${search}${hash}`");
  });

  it("registers Calendar as the fourth Plan tab", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/goals/goals-view.tsx"),
      "utf8",
    );
    expect(source).toContain('"calendar"');
    expect(source).toContain("<CalendarView");
  });

  it("preserves the current query and Calendar hash when selecting another date", () => {
    expect(
      buildCalendarNavigationHref({
        pathname: "/goals",
        search: "?month=2026-08&date=2026-08-12&view=agenda",
        hash: "#calendar",
        date: "2026-09-03",
      }),
    ).toBe("/goals?month=2026-09&date=2026-09-03&view=agenda#calendar");
  });
});
