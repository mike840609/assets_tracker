import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile PWA audit source contracts", () => {
  it("moves pull progress onto requestAnimationFrame and shared refs", () => {
    const context = readFileSync("src/components/layout/pull-to-refresh-context.tsx", "utf8");
    const pullToRefresh = readFileSync("src/components/layout/pull-to-refresh.tsx", "utf8");
    const mainShell = readFileSync("src/components/layout/mobile-main-shell.tsx", "utf8");
    const indicator = readFileSync("src/components/layout/pull-to-refresh-indicator.tsx", "utf8");

    expect(context).toContain("mainRef");
    expect(context).toContain("indicatorRef");
    expect(pullToRefresh).toContain("requestAnimationFrame");
    expect(pullToRefresh).toContain("mainRef");
    expect(pullToRefresh).not.toContain('document.querySelector("main")');
    expect(mainShell).toContain("ref={mainRef}");
    expect(indicator).toContain("ref={indicatorRef}");
  });

  it("keeps the lighter mobile header blur", () => {
    const source = readFileSync("src/components/layout/mobile-header.tsx", "utf8");

    expect(source).toContain("backdrop-blur-sm");
    expect(source).not.toContain("backdrop-blur-md");
  });

  it("gates Vercel networking hints behind the existing env flag", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const conditionalBlock =
      layout.match(/enableVercelInsights \? \(([\s\S]*?)\) : null/)?.[1] ?? "";

    expect(layout).toContain("enableVercelInsights ?");
    expect(conditionalBlock).toContain('rel="preconnect"');
    expect(conditionalBlock).toContain('rel="dns-prefetch" href="https://va.vercel-scripts.com"');
  });
});
