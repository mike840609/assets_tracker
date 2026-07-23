import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
