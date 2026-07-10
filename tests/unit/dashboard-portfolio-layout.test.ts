import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync("src/components/dashboard/dashboard-content.tsx", "utf8");
const skeletonSource = readFileSync("src/components/dashboard/dashboard-skeleton.tsx", "utf8");

describe("dashboard portfolio layout", () => {
  it("keeps the dashboard treemap at its content-driven height", () => {
    expect(dashboardSource).toContain("<PortfolioHeatmap summary={summary} />");
    expect(dashboardSource).not.toContain("<PortfolioHeatmap summary={summary} fillHeight />");
  });

  it("separates concentration from the 8/4 portfolio overview row", () => {
    const overviewStart = dashboardSource.indexOf('data-testid="portfolio-overview-row"');
    const concentrationStart = dashboardSource.indexOf('data-testid="portfolio-concentration-row"');

    expect(overviewStart).toBeGreaterThan(-1);
    expect(concentrationStart).toBeGreaterThan(overviewStart);

    const overviewSource = dashboardSource.slice(overviewStart, concentrationStart);
    expect(overviewSource).toContain("lg:col-span-8");
    expect(overviewSource).toContain("lg:col-span-4");
    expect(overviewSource).not.toContain("<ConcentrationSection");
  });

  it("keeps the loading skeleton topology aligned with the dashboard", () => {
    expect(skeletonSource).toContain('data-testid="portfolio-overview-skeleton"');
    expect(skeletonSource).toContain('data-testid="portfolio-concentration-skeleton"');
    expect(skeletonSource).toContain("export function ConcentrationCardSkeleton()");
  });
});
