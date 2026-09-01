import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardSource = readFileSync("src/components/ui/card.tsx", "utf8");
const netWorthCardSource = readFileSync("src/components/dashboard/net-worth-card.tsx", "utf8");
const trendChartSource = readFileSync("src/components/dashboard/trend-chart.tsx", "utf8");
const dashboardActionsSource = readFileSync(
  "src/components/dashboard/dashboard-actions.tsx",
  "utf8",
);
const watchlistSource = readFileSync("src/components/dashboard/watchlist-card.tsx", "utf8");
const allocationSource = readFileSync("src/components/dashboard/allocation-chart.tsx", "utf8");
const currencyExposureSource = readFileSync(
  "src/components/dashboard/currency-exposure-chart.tsx",
  "utf8",
);
const concentrationSource = readFileSync("src/components/dashboard/concentration-card.tsx", "utf8");

describe("dashboard card styling", () => {
  it("uses a HeroUI-inspired surface, hairline border, and resting shadow", () => {
    expect(cardSource).toContain("border border-border/60");
    expect(cardSource).toContain("bg-card");
    expect(cardSource).toContain("shadow-sm");
    expect(cardSource).not.toContain("ring-1 ring-foreground/10");
  });

  it("keeps the net-worth hero gradient free of the old glass utility", () => {
    expect(netWorthCardSource).toContain("card-gradient");
    expect(netWorthCardSource).not.toContain("glass card-gradient");
  });

  it("uses boxed controls for HeroUI-inspired chart filters", () => {
    expect(trendChartSource.match(/variant="boxed"/g)).toHaveLength(2);
    expect(trendChartSource).not.toContain('variant="pill"');
  });

  it("uses the shared badge primitive for dashboard status chips", () => {
    expect(netWorthCardSource).toContain('import { Badge } from "@/components/ui/badge"');
    expect(netWorthCardSource).toContain('variant={isPositive ? "gain" : "loss"}');
    expect(trendChartSource).toContain('import { Badge } from "@/components/ui/badge"');
    expect(watchlistSource).toContain('variant={isGain ? "gain" : "loss"}');
    expect(allocationSource).toContain('import { Badge } from "@/components/ui/badge"');
    expect(currencyExposureSource).toContain('import { Badge } from "@/components/ui/badge"');
    expect(concentrationSource).toContain('import { Badge } from "@/components/ui/badge"');
  });

  it("keeps refresh actions compact and free of decorative pill treatment", () => {
    expect(dashboardActionsSource).toContain('className="gap-2 px-3"');
    expect(dashboardActionsSource).not.toContain("rounded-full px-5");
    expect(dashboardActionsSource).toContain('className="rounded-lg"');
  });
});
