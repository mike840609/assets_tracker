import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const NAV_HREFS = [
  "/",
  "/accounts",
  "/goals",
  "/stocks",
  "/analysis",
  "/projections",
  "/calendar",
  "/history",
  "/settings",
];

describe("calendar route integration", () => {
  it("loads a bounded range through the service and renders CalendarView", () => {
    const source = fs.readFileSync(path.join(root, "src/app/(main)/calendar/page.tsx"), "utf8");
    expect(source).toContain("normalizeCalendarUrlState");
    expect(source).toContain("getVisibleCalendarRange");
    expect(source).toContain("getCalendarEntriesInRange");
    expect(source).toContain("<CalendarView");
  });

  it("keeps desktop navigation and shortcuts in the same order", () => {
    const sidebar = fs.readFileSync(path.join(root, "src/components/layout/sidebar.tsx"), "utf8");
    const desktop = fs.readFileSync(
      path.join(root, "src/components/layout/desktop-command-palette.tsx"),
      "utf8",
    );
    const lazy = fs.readFileSync(
      path.join(root, "src/components/layout/lazy-command-palette.tsx"),
      "utf8",
    );

    const sidebarNavStart = sidebar.indexOf("const navItems = [");
    const sidebarNavBlock = sidebar.slice(
      sidebarNavStart,
      sidebar.indexOf("  return (", sidebarNavStart),
    );
    const desktopNavBlock = desktop.slice(
      desktop.indexOf("const navItems = useMemo"),
      desktop.indexOf("  const privacyShortcut"),
    );
    const lazyNavBlock = lazy.slice(
      lazy.indexOf("const NAV_HREFS = ["),
      lazy.indexOf("] as const;"),
    );

    expect([...sidebarNavBlock.matchAll(/href: "([^"]+)"/g)].map((match) => match[1])).toEqual(
      NAV_HREFS,
    );
    expect(
      [...desktopNavBlock.matchAll(/\{ href: "([^"]+)"[^}]+kbd: "(\d)" \}/g)].map(
        ([, href, kbd]) => ({ href, kbd }),
      ),
    ).toEqual(NAV_HREFS.map((href, index) => ({ href, kbd: String(index + 1) })));
    expect([...lazyNavBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1])).toEqual(NAV_HREFS);
    expect(lazy).toContain("/^[1-9]$/");
  });
});
