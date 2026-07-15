import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const recurringForms = [
  "src/components/accounts/recurring-investments.tsx",
  "src/components/accounts/recurring-cash-transactions.tsx",
];

describe.each(recurringForms)("%s", (path) => {
  it("uses the local calendar day for the start date", () => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain('import { localToday } from "@/lib/utils";');
    expect(source.match(/localToday\(\)/g)).toHaveLength(2);
    expect(source).not.toContain("todayDateOnly");
    expect(source).not.toContain("new Date().toISOString().slice(0, 10)");
  });
});

describe("history issue #592 regressions", () => {
  it("renders baseline and flat snapshot days with a neutral heatmap color", () => {
    const source = readFileSync("src/components/history/history-heatmap.tsx", "utf8");
    expect(source).toContain("if (day.change === null || day.change === 0)");
    expect(source).toContain('bgClass = "bg-muted-foreground/30 dark:bg-muted-foreground/25"');
  });

  it("keeps pull-to-refresh pending through the router transition", () => {
    const source = readFileSync("src/components/history/history-pull-refresh.tsx", "utf8");
    expect(source).toContain("const [isPending, startTransition] = useTransition()");
    expect(source).toContain("const resolveRef = useRef<(() => void) | null>(null)");
    expect(source).toContain("if (!isPending && resolveRef.current)");
    expect(source).toContain("startTransition(() =>");
    expect(source).toContain("router.refresh()");
  });
});
