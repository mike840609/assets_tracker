import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("calendar route integration", () => {
  it("loads a bounded range through the service and renders CalendarView", () => {
    const source = fs.readFileSync(path.join(root, "src/app/(main)/calendar/page.tsx"), "utf8");
    expect(source).toContain("normalizeCalendarUrlState");
    expect(source).toContain("getVisibleCalendarRange");
    expect(source).toContain("getCalendarEntriesInRange");
    expect(source).toContain("<CalendarView");
  });

  it("keeps desktop navigation and shortcuts in the same order", () => {
    const lazy = fs.readFileSync(
      path.join(root, "src/components/layout/lazy-command-palette.tsx"),
      "utf8",
    );
    expect(lazy).toContain('"/calendar"');
    expect(lazy).toContain("/^[1-9]$/");
    expect(lazy).toContain('key === "c"');
  });
});
