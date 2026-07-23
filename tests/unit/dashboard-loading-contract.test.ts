import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contentSource = readFileSync("src/components/dashboard/dashboard-content.tsx", "utf8");
const lazyChartsSource = readFileSync("src/components/dashboard/lazy-charts.tsx", "utf8");
const skeletonSource = readFileSync("src/components/dashboard/dashboard-skeleton.tsx", "utf8");
const sectionSkeletonSource = readFileSync(
  "src/components/dashboard/dashboard-section-skeletons.tsx",
  "utf8",
);

const sharedSkeletons = [
  "ChartCardSkeleton",
  "NetWorthSkeleton",
  "AccountsSummarySkeleton",
  "PortfolioHeatmapSkeleton",
  "WatchlistCardSkeleton",
  "ConcentrationCardSkeleton",
] as const;

describe("dashboard loading contract", () => {
  it("defines section skeletons in one module", () => {
    for (const name of sharedSkeletons) {
      expect(sectionSkeletonSource).toContain(`export function ${name}(`);
      expect(contentSource).not.toContain(`function ${name}(`);
      expect(skeletonSource).not.toContain(`function ${name}(`);
    }
    expect(contentSource).toContain('from "@/components/dashboard/dashboard-section-skeletons"');
    expect(lazyChartsSource).toContain(
      'import { ChartCardSkeleton } from "@/components/dashboard/dashboard-section-skeletons";',
    );
    expect(lazyChartsSource).not.toContain("function ChartSkeleton()");
  });

  it("keeps advanced route skeletons collapsed on mobile", () => {
    expect(skeletonSource).toContain('data-testid="dashboard-portfolio-disclosure-skeleton"');
    expect(skeletonSource).toContain('className="h-11 w-full rounded-xl md:hidden"');
    expect(skeletonSource).toContain('className="hidden space-y-4 md:block md:space-y-8"');
  });
});
