import path from "node:path";
import { expect, test } from "@playwright/test";

// axe-core is a direct devDependency; inject the browser build and run WCAG 2 A/AA.
const AXE_PATH = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
const PAGES = ["/", "/accounts", "/goals", "/history", "/projections", "/calendar", "/settings"];

for (const route of PAGES) {
  test(`no WCAG A/AA violations on ${route}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop layout scan");

    await page.goto(route);
    await page.waitForLoadState("networkidle");
    // Entrance animations fade text in from opacity 0; axe would measure contrast
    // mid-fade. Wait for every finite animation (infinite ones, like skeleton
    // pulses, never finish).
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    await page.addScriptTag({ path: AXE_PATH });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
      const result = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
      return result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      );
    });
    expect(violations).toEqual([]);
  });
}
