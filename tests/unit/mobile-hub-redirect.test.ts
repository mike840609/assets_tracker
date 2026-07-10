import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile hub redirects", () => {
  it("hides standalone stocks and projections content on mobile before redirect", () => {
    const stocksPage = readFileSync("src/app/(main)/stocks/page.tsx", "utf8");
    const projectionsPage = readFileSync("src/app/(main)/projections/page.tsx", "utf8");

    expect(stocksPage).toContain("hidden");
    expect(stocksPage).toContain("md:block");
    expect(projectionsPage).toContain("hidden");
    expect(projectionsPage).toContain("md:block");
  });
});
