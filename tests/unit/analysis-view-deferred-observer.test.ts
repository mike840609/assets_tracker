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
    expect(source).toContain("}, [deferredSentinelNode, showDeferredCharts]);");
  });
});
