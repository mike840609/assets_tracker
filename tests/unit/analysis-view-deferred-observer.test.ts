import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("analysis deferred observer wiring", () => {
  it("tracks the rendered deferred sentinel instead of a stale keyed node", () => {
    const source = readFileSync("src/components/analysis/analysis-view.tsx", "utf8");

    expect(source).toContain(
      "const [deferredSentinelNode, setDeferredSentinelNode] = useState<HTMLDivElement | null>(null);",
    );
    expect(source.match(/ref=\{setDeferredSentinelNode\}/g)).toHaveLength(2);
    expect(source).toContain('{ rootMargin: "800px 0px" }');
    expect(source).toContain("}, [deferredSentinelNode, hasData, series, showDeferredCharts]);");
  });

  it("waits for the selected range before observing deferred charts", () => {
    const source = readFileSync("src/components/analysis/analysis-view.tsx", "utf8");

    expect(source).toContain("if (showDeferredCharts || !hasData || !series) return;");
    expect(source).toContain("}, [deferredSentinelNode, hasData, series, showDeferredCharts]);");
  });

  it("clears the failed range before retrying so the loading state is visible", () => {
    const source = readFileSync("src/components/analysis/analysis-view.tsx", "utf8");

    expect(source).toMatch(
      /onClick=\{\(\) => \{\s*setFailedRange\(null\);\s*setRetryToken\(\(value\) => value \+ 1\);\s*\}\}/,
    );
  });
});
