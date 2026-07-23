import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync("src/components/dashboard/dashboard-content.tsx", "utf8");
const skeletonSource = readFileSync("src/components/dashboard/dashboard-skeleton.tsx", "utf8");
const concentrationSource = readFileSync("src/components/dashboard/concentration-card.tsx", "utf8");
const heatmapSource = readFileSync("src/components/analysis/portfolio-heatmap.tsx", "utf8");

describe("dashboard portfolio layout", () => {
  it("aligns the composition card with the desktop overview row and fills it internally", () => {
    expect(dashboardSource).toContain("<PortfolioHeatmap summary={summary} fillHeight />");
    expect(dashboardSource).toContain("lg:[&>*]:flex-1");
    expect(dashboardSource).toContain("lg:[&>*]:min-h-0");
    expect(dashboardSource).toContain("lg:min-h-0");
    expect(dashboardSource).toContain("lg:contain-size");
    expect(heatmapSource).not.toContain('fillHeight && "lg:h-full"');
    expect(heatmapSource).toContain('fillHeight && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"');
    expect(heatmapSource).toContain('fillHeight && "lg:min-h-0 lg:flex-1"');
    expect(heatmapSource.match(/fillHeight && "lg:flex lg:min-h-0 lg:flex-col"/g)).toHaveLength(2);
  });

  it("separates concentration from the 8/4 portfolio overview row", () => {
    const overviewStart = dashboardSource.indexOf('data-testid="portfolio-overview-row"');
    const concentrationStart = dashboardSource.indexOf("<ConcentrationSection", overviewStart);

    expect(overviewStart).toBeGreaterThan(-1);
    expect(concentrationStart).toBeGreaterThan(overviewStart);

    const overviewSource = dashboardSource.slice(overviewStart, concentrationStart);
    expect(overviewSource).toContain("lg:col-span-8");
    expect(overviewSource).toContain("lg:col-span-4");
    expect(overviewSource).not.toContain("<ConcentrationSection");
    expect(dashboardSource).toContain(`  if (summary.totalAssets <= 0) return null;
  return <ConcentrationCard summary={summary} />;`);

    const emptyGuard = concentrationSource.indexOf("if (top.length === 0) return null;");
    const loadedRow = concentrationSource.indexOf(
      '<div data-testid="portfolio-concentration-row">',
    );

    expect(emptyGuard).toBeGreaterThan(-1);
    expect(loadedRow).toBeGreaterThan(emptyGuard);
    expect(concentrationSource).toContain(`  return (
    <div data-testid="portfolio-concentration-row">
      <Card className="flex flex-col">`);
    expect(concentrationSource).toContain(`      </Card>
    </div>
  );`);
  });

  it("keeps the loading skeleton topology aligned with the dashboard", () => {
    const overviewStart = skeletonSource.indexOf('data-testid="portfolio-overview-skeleton"');
    const concentrationStart = skeletonSource.indexOf(
      "<ConcentrationCardSkeleton />",
      overviewStart,
    );

    expect(overviewStart).toBeGreaterThan(-1);
    expect(concentrationStart).toBeGreaterThan(overviewStart);

    const overviewSource = skeletonSource.slice(overviewStart, concentrationStart);
    expect(overviewSource).toContain("lg:col-span-8");
    expect(overviewSource).toContain("lg:col-span-4");
    expect(overviewSource).toContain("lg:contain-size");
    expect(overviewSource).toContain("lg:[&>*]:flex-1");
    expect(overviewSource).not.toContain("<ConcentrationCardSkeleton />");
    expect(skeletonSource)
      .toContain(`          <div className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:contain-size lg:[&>*]:min-h-0 lg:[&>*]:flex-1">
            <PortfolioHeatmapSkeleton />
          </div>
        </div>
        <ConcentrationCardSkeleton />`);
    expect(skeletonSource).toContain('data-testid="portfolio-concentration-skeleton"');
    expect(skeletonSource).toContain("export function ConcentrationCardSkeleton()");
  });

  it("lays concentration out horizontally on desktop", () => {
    expect(concentrationSource).toContain("lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)]");
    expect(concentrationSource).toContain("sm:grid-cols-2 xl:grid-cols-3");
  });
});
