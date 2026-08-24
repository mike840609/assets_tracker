import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getMobileHubClientRedirectUrl, getMobileHubRedirectUrl } from "@/lib/mobile-hub-route";

describe("mobile hub redirects", () => {
  it("hides standalone stocks, projections, and calendar content on mobile before redirect", () => {
    const stocksPage = readFileSync("src/app/(main)/stocks/page.tsx", "utf8");
    const projectionsPage = readFileSync("src/app/(main)/projections/page.tsx", "utf8");
    const calendarPage = readFileSync("src/app/(main)/calendar/page.tsx", "utf8");

    expect(stocksPage).toContain("hidden");
    expect(stocksPage).toContain("md:block");
    expect(projectionsPage).toContain("hidden");
    expect(projectionsPage).toContain("md:block");
    expect(calendarPage).toContain("hidden");
    expect(calendarPage).toContain("md:block");
  });

  it("redirects Calendar with normalized month and date state", () => {
    const calendarPage = readFileSync("src/app/(main)/calendar/page.tsx", "utf8");

    expect(calendarPage).toContain(
      '<MobileHubRedirect hash="#calendar" search={`?month=${month}&date=${date}`} />',
    );
  });

  it.each([
    ["/stocks", "", "/goals"],
    ["/projections", "", "/goals?tab=projections"],
    [
      "/calendar",
      "?month=2026-08&date=2026-08-12",
      "/goals?month=2026-08&date=2026-08-12&tab=calendar",
    ],
  ] as const)("builds the mobile hub redirect for %s", (pathname, search, expected) => {
    expect(
      getMobileHubRedirectUrl({
        pathname,
        search,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
      }),
    ).toBe(expected);
  });

  it("leaves desktop user agents on standalone routes", () => {
    expect(
      getMobileHubRedirectUrl({
        pathname: "/stocks",
        search: "",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      }),
    ).toBeNull();
  });

  it.each([
    ["?symbol=AAPL&view=compact", "", "#watchlist", "/goals?symbol=AAPL&view=compact"],
    [
      "",
      "?month=2026-08&date=2026-08-12",
      "#calendar",
      "/goals?month=2026-08&date=2026-08-12&tab=calendar",
    ],
  ] as const)(
    "preserves the complete client query string when redirecting",
    (currentSearch, fallbackSearch, hash, expected) => {
      expect(getMobileHubClientRedirectUrl({ currentSearch, fallbackSearch, hash })).toBe(expected);
    },
  );
});
